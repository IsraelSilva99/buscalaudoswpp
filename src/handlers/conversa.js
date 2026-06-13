const db = require('../services/db');
const whatsapp = require('../services/whatsapp');
const laudosApi = require('../services/laudos');
const { TEXTOS, obterSaudacao } = require('../utils/textos');

// Função para simular o tempo de digitação e envio (pausa)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processarMensagem(numero, textoRecebido, messageId) {
    // Aciona o efeito digitando oficial da v21.0
    await whatsapp.enviarDigitando(messageId);

    const texto = textoRecebido.trim();
    const textoNormalizado = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Intercepta botão de enviar PDF quando fica pronto
    if (texto.startsWith('SEND_PDF_')) {
        const partes = texto.split('_');
        if (partes.length >= 4) {
            const doc = partes[2];
            const cod = partes[3];
            await whatsapp.enviarTexto(numero, TEXTOS.BUSCANDO);
            const laudoValido = await laudosApi.obterPdfLaudo(doc, cod);
            if (laudoValido && !laudoValido.error) {
                await whatsapp.enviarDocumento(numero, laudoValido.base64, `Laudo_${cod}.pdf`);
                await db.registrarEntregaPdf(numero);
                await sleep(2000);
                await whatsapp.enviarTexto(numero, TEXTOS.PDF_ENVIADO);
                await db.criarSessao(numero, 'AGUARDANDO_AVALIACAO');
                await sleep(1500);
                const secoesLista = [{
                    title: "Selecione uma nota",
                    rows: [
                        { id: "nota_5", title: "5 - Excelente" },
                        { id: "nota_4", title: "4 - Muito Bom" },
                        { id: "nota_3", title: "3 - Bom" },
                        { id: "nota_2", title: "2 - Regular" },
                        { id: "nota_1", title: "1 - Ruim" }
                    ]
                }];
                await whatsapp.enviarLista(numero, TEXTOS.PESQUISA_SATISFACAO, "Dar Nota", secoesLista);
            } else {
                await whatsapp.enviarTexto(numero, 'Desculpe, ocorreu um erro ao baixar seu PDF. Por favor, inicie o atendimento novamente mandando um "Oi".');
            }
        }
        return;
    }

    // 0. Intercepta comando de relatório administrativo
    if (textoNormalizado === 'relatorio') {
        const adminNumbersStr = process.env.ADMIN_NUMBERS || '';
        const adminNumbers = adminNumbersStr.split(',').map(n => n.trim());
        if (adminNumbers.includes(numero)) {
            await processarComandoRelatorio(numero);
            return;
        }
    }

    // 1. Verifica Aceite da LGPD
    const lgpdAceito = await db.verificarLgpd(numero);

    // Recupera Sessão
    let sessao = await db.obterSessao(numero);

    if (!lgpdAceito) {
        return etapaLgpd(numero, texto, sessao);
    }

    // Cria sessão se já aceitou LGPD mas não tinha sessão ativa
    if (!sessao) {
        sessao = await db.criarSessao(numero, 'AGUARDANDO_DOC');
        await whatsapp.enviarTexto(numero, obterSaudacao());
        await sleep(1500);
        await whatsapp.enviarTexto(numero, TEXTOS.PEDIR_DOC);
        return;
    }

    // Máquina de estados
    switch (sessao.etapa) {
        case 'AGUARDANDO_DOC':
            return etapaAguardandoDoc(numero, texto, sessao);
        case 'AGUARDANDO_CODIGO':
            return etapaAguardandoCodigo(numero, texto, sessao);
        case 'AGUARDANDO_AVALIACAO':
            return etapaAvaliacao(numero, texto, sessao);
        default:
            await db.deletarSessao(numero);
            break;
    }
}

// ─── Funções de Etapa ────────────────────────────────────────────────────────

async function etapaLgpd(numero, texto, sessao) {
    if (!sessao || sessao.etapa !== 'AGUARDANDO_LGPD') {
        sessao = await db.criarSessao(numero, 'AGUARDANDO_LGPD');
        await whatsapp.enviarTexto(numero, obterSaudacao());
        await sleep(1500); // Pausa para parecer humano
        const fs = require('fs');
        const path = require('path');
        const pdfPath = path.join(__dirname, '..', '..', 'termos.pdf');

        if (fs.existsSync(pdfPath)) {
            const buffer = fs.readFileSync(pdfPath);
            const base64 = buffer.toString('base64');
            await whatsapp.enviarDocumento(numero, base64, 'Termos_HMASP.pdf', TEXTOS.LGPD_TERMOS);
            await sleep(1500); // Pausa para o arquivo carregar na tela
        } else {
            console.log('⚠️ Arquivo termos.pdf não encontrado na raiz do projeto. Nenhuma política enviada.');
            await whatsapp.enviarTexto(numero, TEXTOS.LGPD_TERMOS);
        }

        await sleep(1200); // Pausa
        await whatsapp.enviarBotoes(numero, TEXTOS.LGPD_PERGUNTA, ['SIM', 'NÃO']);
        return;
    }

    // Trata resposta do botão da LGPD
    if (texto.toUpperCase() === 'SIM') {
        await db.aceitarLgpd(numero);
        sessao = await db.criarSessao(numero, 'AGUARDANDO_DOC');
        await whatsapp.enviarTexto(numero, TEXTOS.PEDIR_DOC);
    } else {
        await whatsapp.enviarTexto(numero, TEXTOS.LGPD_BLOQUEIO);
        await db.deletarSessao(numero);
    }
}

async function etapaAguardandoDoc(numero, texto, sessao) {
    // Regra simples: apenas números
    if (!/^\d+$/.test(texto)) {
        await whatsapp.enviarTexto(numero, TEXTOS.PEDIR_DOC);
        return;
    }

    // Consulta API BuscaLaudos
    const exames = await laudosApi.consultarExames(texto);
    if (!exames || exames.length === 0) {
        const docAttempts = (sessao.docAttempts || 0) + 1;
        if (docAttempts >= 3) {
            await whatsapp.enviarTexto(numero, TEXTOS.ERRO_TENTATIVAS);
            await db.deletarSessao(numero);
        } else {
            await db.atualizarSessao(numero, { docAttempts });
            await whatsapp.enviarTexto(numero, TEXTOS.ERRO_DOC_NAO_ENCONTRADO);

            // Se errou a primeira vez, manda a imagem de exemplo
            if (docAttempts === 1) {
                await sleep(1500);
                await whatsapp.enviarImagemUrl(numero, process.env.EXEMPLO_PRECCP_URL, '_Veja no exemplo acima onde encontrar o número._');
            }
        }
        return;
    }

    // Salva o documento na sessão e avança
    await db.atualizarSessao(numero, {
        documento: texto,
        etapa: 'AGUARDANDO_CODIGO',
        docAttempts: 0
    });
    await whatsapp.enviarTexto(numero, TEXTOS.PEDIR_CODIGO);
}

async function etapaAguardandoCodigo(numero, texto, sessao) {
    await whatsapp.enviarTexto(numero, TEXTOS.BUSCANDO);
    const laudoValido = await laudosApi.obterPdfLaudo(sessao.documento, texto);

    if (laudoValido && laudoValido.error) {
        if (laudoValido.error === 'EM_ANALISE') {
            await db.salvarExamePendente(numero, sessao.documento, texto);
            await whatsapp.enviarTexto(numero, 'Seu exame ainda está em análise. Se o laudo sair nas próximas 24 horas, enviarei um aviso automático por aqui. Após esse prazo, por favor, envie uma nova mensagem para consultar. Obrigado!');
            await db.deletarSessao(numero);
            return;
        } else {
            const codeAttempts = (sessao.codeAttempts || 0) + 1;
            if (codeAttempts >= 3) {
                await whatsapp.enviarTexto(numero, TEXTOS.ERRO_TENTATIVAS);
                await db.deletarSessao(numero);
            } else {
                await db.atualizarSessao(numero, { codeAttempts });
                await whatsapp.enviarTexto(numero, TEXTOS.CODIGO_INVALIDO);

                // Se errou a primeira vez, manda a imagem de exemplo
                if (codeAttempts === 1) {
                    await sleep(1500);
                    await whatsapp.enviarImagemUrl(numero, process.env.EXEMPLO_ATENDIMENTO_URL, '_Veja no exemplo acima onde encontrar o número de atendimento._');
                }
            }
            return;
        }
    } else if (!laudoValido) {
        const codeAttempts = (sessao.codeAttempts || 0) + 1;
        if (codeAttempts >= 3) {
            await whatsapp.enviarTexto(numero, TEXTOS.ERRO_TENTATIVAS);
            await db.deletarSessao(numero);
        } else {
            await db.atualizarSessao(numero, { codeAttempts });
            await whatsapp.enviarTexto(numero, TEXTOS.CODIGO_INVALIDO);

            // Se errou a primeira vez, manda a imagem de exemplo
            if (codeAttempts === 1) {
                await sleep(1500);
                await whatsapp.enviarImagemUrl(numero, process.env.EXEMPLO_ATENDIMENTO_URL, '_Veja no exemplo acima onde encontrar o número de atendimento._');
            }
        }
        return;
    }

    // Envia o PDF e vai para avaliação
    await whatsapp.enviarDocumento(numero, laudoValido.base64, `Laudo_${texto}.pdf`);
    await db.registrarEntregaPdf(numero); // Registra a entrega para as métricas de conversão
    await sleep(2000); // Espera o tempo do arquivo subir um pouco
    await whatsapp.enviarTexto(numero, TEXTOS.PDF_ENVIADO);

    await db.atualizarSessao(numero, { etapa: 'AGUARDANDO_AVALIACAO', codeAttempts: 0 });

    await sleep(1500);
    const secoesLista = [{
        title: "Selecione uma nota",
        rows: [
            { id: "nota_5", title: "5 - Excelente" },
            { id: "nota_4", title: "4 - Muito Bom" },
            { id: "nota_3", title: "3 - Bom" },
            { id: "nota_2", title: "2 - Regular" },
            { id: "nota_1", title: "1 - Ruim" }
        ]
    }];
    await whatsapp.enviarLista(numero, TEXTOS.PESQUISA_SATISFACAO, "Dar Nota", secoesLista);
}

async function etapaAvaliacao(numero, texto, sessao) {
    // O texto recebido pode vir como "nota_5", extraímos o número
    let notaString = texto;
    if (texto.startsWith('nota_')) {
        notaString = texto.replace('nota_', '');
    }
    const nota = parseInt(notaString);
    if (isNaN(nota) || nota < 1 || nota > 5) {
        await whatsapp.enviarTexto(numero, 'Por favor, selecione uma das opções da lista de 1 a 5.');
        return;
    }

    await db.registrarFeedback(numero, nota);
    await whatsapp.enviarTexto(numero, TEXTOS.FIM_ATENDIMENTO);
    await db.deletarSessao(numero);
}

async function processarComandoRelatorio(numero) {
    const data = await db.obterMetricasRelatorio();
    if (!data) {
        await whatsapp.enviarTexto(numero, '❌ Ocorreu um erro ao gerar o relatório consolidado.');
        return;
    }

    const ETAPAS_LABEL = {
        'INICIO': 'Início (Boas-vindas)',
        'AGUARDANDO_LGPD': 'Aguardando LGPD',
        'AGUARDANDO_DOC': 'Aguardando PRECCP',
        'AGUARDANDO_CODIGO': 'Aguardando Nº Atendimento',
        'AGUARDANDO_AVALIACAO': 'Aguardando Nota'
    };

    let etapasTexto = '';
    if (data.sessoes.etapas.length === 0) {
        etapasTexto = '• Nenhuma sessão ativa no momento\n';
    } else {
        data.sessoes.etapas.forEach(item => {
            const label = ETAPAS_LABEL[item.etapa] || item.etapa;
            etapasTexto += `• ${label}: *${item.total}*\n`;
        });
    }

    const feedbackTotal = data.feedback.total;
    const feedbackMedia = data.feedback.media;
    const mediaEstrelas = feedbackMedia > 0 ? feedbackMedia.toFixed(2) : '0.00';

    const comDificuldade = data.sessoes.comDificuldade;
    const descDificuldade = comDificuldade > 0
        ? ` (PRECCP: *${data.sessoes.dificuldades.docErros}* | Atendimento: *${data.sessoes.dificuldades.codeErros}*)`
        : '';

    let tempoMedioTexto = 'N/D';
    if (data.tempoMedioMs > 0) {
        const totalSegundos = Math.round(data.tempoMedioMs / 1000);
        const minutos = Math.floor(totalSegundos / 60);
        const segundos = totalSegundos % 60;
        tempoMedioTexto = minutos > 0 ? `${minutos}m ${segundos}s` : `${segundos}s`;
    }

    const reportMsg = `*RELATÓRIO BOT HMASP*
━━━━━━━━━━━━━━━━━━━━━━━━

👥 *Contatos & Privacidade:*
• Total de contatos: *${data.contatos.total}*
• Aceitaram LGPD: *${data.contatos.aceitosLgpd}* (${data.contatos.total > 0 ? Math.round((data.contatos.aceitosLgpd / data.contatos.total) * 100) : 0}%)

💬 *Sessões Ativas no Momento:*
• Total em andamento: *${data.sessoes.total}*
• Aguardando laudo (Fila 24h): *${data.examesPendentes}*
• Com dificuldades (erros): *${comDificuldade}*${descDificuldade}

⏳ *Estágios das Conversas:*
${etapasTexto}
📉 *Métricas de Uso (Arquivos Baixados):*
• Hoje: *${data.conversao.hoje.entregues}*
• Esta Semana: *${data.conversao.semana.entregues}*
• Este Mês: *${data.conversao.mes.entregues}*
• Tempo médio do atendimento: *${tempoMedioTexto}*

🎯 *Taxa de Conclusão (Novos Pacientes):*
• Hoje: ${data.conversao.hoje.taxa === 'N/D' ? '*N/D* (Sem novos pacientes)' : `*${data.conversao.hoje.taxa}%* concluíram o fluxo`}
• Esta Semana: ${data.conversao.semana.taxa === 'N/D' ? '*N/D* (Sem novos pacientes)' : `*${data.conversao.semana.taxa}%* concluíram o fluxo`}
• Este Mês: ${data.conversao.mes.taxa === 'N/D' ? '*N/D* (Sem novos pacientes)' : `*${data.conversao.mes.taxa}%* concluíram o fluxo`}

⭐ *Avaliações dos Pacientes:*
• Total recebidas: *${feedbackTotal}*
• Média Geral: *${mediaEstrelas} / 5.00*

*Detalhamento das Notas:*
• 5 (Excelente): *${data.feedback.breakdown[5]}*
• 4 (Muito Bom): *${data.feedback.breakdown[4]}*
• 3 (Bom): *${data.feedback.breakdown[3]}*
• 2 (Regular): *${data.feedback.breakdown[2]}*
• 1 (Ruim): *${data.feedback.breakdown[1]}*

━━━━━━━━━━━━━━━━━━━━━━━━
_Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`;

    await whatsapp.enviarTexto(numero, reportMsg);
}

module.exports = { processarMensagem };
