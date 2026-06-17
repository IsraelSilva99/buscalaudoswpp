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

        // Ignora mensagens muito antigas (ex: a Meta reenvia um backlog quando o ngrok cai e volta)
        if (msg.timestamp) {
            const msgTimestamp = parseInt(msg.timestamp, 10);
            const now = Math.floor(Date.now() / 1000); // Segundos
            if (now - msgTimestamp > 180) { // Mais velha que 3 minutos
                console.log(`Mensagem antiga ignorada (Backlog Meta): ${msg.id}`);
                return;
            }
        }

        // Evita processar a mesma mensagem duas vezes (Meta Retries)
        if (processedMessages.has(msg.id)) {
            console.log(`Mensagem duplicada ignorada (Meta Retry): ${msg.id}`);
            return;
        }
        processedMessages.set(msg.id, true);

        const numero = msg.from;
        
        // 1. Extrai e salva o nome de perfil do WhatsApp
        const contact = entry?.changes?.[0]?.value?.contacts?.[0];
        const profileName = contact?.profile?.name;
        if (profileName && numero) {
            await db.salvarContato(numero, profileName).catch(err => console.error("Erro ao salvar contato:", err.message));
        }

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
            for (const sessao of expiradas) {
                if (sessao.etapa !== 'AGUARDANDO_AVALIACAO') {
                    await whatsapp.enviarTexto(
                        sessao.numero,
                        'Como ficamos um tempinho sem nos falar, encerrei este atendimento por motivos de segurança. Mas não se preocupe! Quando precisar acessar seu resultado, é só me mandar um "Oi" novamente.'
                    );
                }
            }
            const numerosExpirados = expiradas.map(s => s.numero);
            await db.deleteExpiredSessions(numerosExpirados);
        }
    } catch (err) {
        console.error('Erro ao limpar sessões expiradas:', err.message);
    }
}, 60 * 1000);

// Verificação periódica de laudos pendentes (Fila 24h) via CRON
const cron = require('node-cron');
const horariospendentes = process.env.PENDING_CHECK_HOURS || "09:00,12:00,15:00";
const horas = horariospendentes.split(',').map(h => h.trim());

horas.forEach(hora => {
    const [h, m] = hora.split(':');
    if (!h || !m) return;
    
    cron.schedule(`${m} ${h} * * *`, async () => {
        try {
            console.log(`[CRON] Iniciando checagem de laudos pendentes (${hora})`);
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
            console.log(`[CRON] Checagem finalizada.`);
        } catch (err) {
            console.error('Erro na checagem de laudos pendentes (CRON):', err.message);
        }
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Bot HMASP ativo e rodando na porta ${PORT}`);
});

// Listener do Painel Web (Supabase Realtime)
const { createClient } = require('@supabase/supabase-js');
const supabasePanel = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

supabasePanel.channel('painel-supervisor')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const newMsg = payload.new;
        if (newMsg) {
            if (newMsg.role === 'supervisor') {
                if (newMsg.mensagem.startsWith('[[SYSTEM_FLAG]]')) {
                    const sysCmd = newMsg.mensagem.replace('[[SYSTEM_FLAG]]', '');
                    if (sysCmd === 'ATENDIMENTO_ENCERRADO') {
                        console.log(`[Painel] Encerrando atendimento manual para ${newMsg.numero}`);
                        try {
                            await db.deletarSessao(newMsg.numero);
                        } catch (err) {}
                    }
                } else if (newMsg.mensagem.startsWith('[[PDF_FLAG]]')) {
                    const base64 = newMsg.mensagem.replace('[[PDF_FLAG]]', '');
                    console.log(`[Painel] Enviando PDF manual para ${newMsg.numero}`);
                    try {
                        await db.criarSessao(newMsg.numero, 'ATENDIMENTO_HUMANO');
                        await whatsapp.enviarDocumento(newMsg.numero, base64, 'anexo_atendimento.pdf', 'Aqui está o documento que você solicitou.', false);
                    } catch (err) {
                        console.error('[Painel] Erro ao enviar PDF:', err.message);
                    }
                } else {
                    console.log(`[Painel] Enviando mensagem manual para ${newMsg.numero}`);
                    try {
                        await db.criarSessao(newMsg.numero, 'ATENDIMENTO_HUMANO');
                        await whatsapp.enviarTexto(newMsg.numero, newMsg.mensagem, false);
                    } catch (err) {
                        console.error('[Painel] Erro ao enviar mensagem:', err.message);
                    }
                }
            }
        }
    })
    .subscribe();
