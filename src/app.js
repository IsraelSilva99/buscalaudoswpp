const express = require('express');
const db = require('./services/db');
const conversa = require('./handlers/conversa');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// 1. Rota de verificação do Webhook (GET da Meta)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verificado com sucesso pela Meta!');
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

const NodeCache = require('node-cache');
const processedMessages = new NodeCache({ stdTTL: 300, checkperiod: 120 });

// 2. Rota de recebimento de mensagens (POST da Meta)
app.post('/webhook', async (req, res) => {
    // Retorna 200 imediatamente para a Meta não reenviar a mensagem
    res.sendStatus(200);

    try {
        const entry = req.body?.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const msg = value?.messages?.[0];

        // Ignora status de mensagens ou mensagens de sistema
        if (!msg || !msg.from) return;

        // Evita processar a mesma mensagem duas vezes (Meta Retries)
        if (processedMessages.has(msg.id)) {
            console.log(`Mensagem duplicada ignorada (Meta Retry): ${msg.id}`);
            return;
        }
        processedMessages.set(msg.id, true);

        const numero = msg.from;
        let texto = '';

        if (msg.type === 'text') {
            texto = msg.text.body;
        } else if (msg.type === 'interactive') {
            // Captura o clique do botão de SIM/NÃO ou resposta da Lista
            texto = msg.interactive.button_reply?.id || msg.interactive.button_reply?.title || msg.interactive.list_reply?.id || '';
        } else if (['audio', 'image', 'video', 'document', 'sticker'].includes(msg.type)) {
            // Trata formatos de mídia informando que o bot não suporta
            const whatsapp = require('./services/whatsapp');
            await whatsapp.enviarTexto(
                numero,
                'Desculpe, sou um assistente virtual em texto e ainda não consigo entender áudios, imagens ou figurinhas. 😅\n\nPor favor, digite a sua resposta usando o teclado!'
            );
            return;
        }

        if (texto) {
            console.log(`Mensagem recebida de ${numero}: "${texto}"`);
            await conversa.processarMensagem(numero, texto, msg.id);
        }
    } catch (err) {
        console.error('Erro ao processar mensagem do webhook:', err.message);
        try {
            const entry = req.body?.entry?.[0];
            const msg = entry?.changes?.[0]?.value?.messages?.[0];
            const numero = msg?.from;
            if (numero) {
                const whatsapp = require('./services/whatsapp');
                await whatsapp.enviarTexto(
                    numero,
                    'Estamos enfrentando uma instabilidade momentânea. Por favor, tente novamente em alguns minutos.'
                );
            }
        } catch (fallbackErr) {
            console.error('Erro ao enviar mensagem de fallback:', fallbackErr.message);
        }
    }
});

// Verificação periódica de inatividade (roda a cada 1 minuto)
const whatsapp = require('./services/whatsapp');
setInterval(async () => {
    try {
        const expiradas = await db.getExpiredSessions();
        if (expiradas.length > 0) {
            for (const numero of expiradas) {
                await whatsapp.enviarTexto(
                    numero,
                    'Como ficamos um tempinho sem nos falar, encerrei este atendimento por motivos de segurança. Mas não se preocupe! Quando precisar acessar seu resultado, é só me mandar um "Oi" novamente.'
                );
            }
            await db.deleteExpiredSessions(expiradas);
        }
    } catch (err) {
        console.error('Erro ao limpar sessões expiradas:', err.message);
    }
}, 60 * 1000);

// Verificação periódica de laudos pendentes (24h)
const PENDING_INTERVAL = (process.env.PENDING_CHECK_INTERVAL_MINUTES || 15) * 60 * 1000;
setInterval(async () => {
    try {
        const laudosApi = require('./services/laudos');
        const whatsapp = require('./services/whatsapp');
        
        // Limpa pendentes que já passaram de 24h
        await db.removerExamesPendentesExpirados();
        
        // Busca os pendentes que ainda estão na janela
        const pendentes = await db.obterExamesPendentes();
        for (const p of pendentes) {
            const laudo = await laudosApi.obterPdfLaudo(p.documento, p.codigoAtendimento);
            if (laudo && !laudo.error) {
                // PDF ficou pronto!
                await whatsapp.enviarBotaoPDF(p.numero, p.documento, p.codigoAtendimento);
                await db.removerExamePendente(p.id);
            }
        }
    } catch (err) {
        console.error('Erro na checagem de laudos pendentes:', err.message);
    }
}, PENDING_INTERVAL);

app.listen(PORT, () => {
    console.log(`🚀 Bot HMASP ativo e rodando na porta ${PORT}`);
});
