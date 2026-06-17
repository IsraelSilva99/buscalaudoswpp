const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
global.WebSocket = WebSocket;
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

// --- LGPD / Contatos Conhecidos ---
async function verificarLgpd(numero) {
    const now = Date.now();
    const { data } = await supabase.from('known_numbers').select('lgpdAccepted').eq('numero', numero);
    if (!data || data.length === 0) {
        await supabase.from('known_numbers').insert([
            { numero, firstSeenAt: now, lastSeenAt: now }
        ]);
        return false;
    }
    return data[0].lgpdAccepted;
}

async function aceitarLgpd(numero) {
    await supabase.from('known_numbers').update({ lgpdAccepted: true }).eq('numero', numero);
}

// --- Proteção Anti Brute-Force ---
async function verificarBloqueio(numero) {
    const { data } = await supabase.from('known_numbers').select('blockedUntil').eq('numero', numero);
    if (data && data.length > 0) {
        const blockedUntil = Number(data[0].blockedUntil || 0);
        return blockedUntil > Date.now();
    }
    return false;
}

async function bloquearContato(numero) {
    // Busca blockCount atual
    const { data } = await supabase.from('known_numbers').select('blockCount').eq('numero', numero);
    let blockCount = 0;
    if (data && data.length > 0) {
        blockCount = Number(data[0].blockCount || 0);
    }
    
    // Incrementa contagem de bloqueios
    blockCount += 1;
    
    // Exponential backoff
    let minutosBloqueio = 30; // 1º bloqueio: 30 minutos
    if (blockCount === 2) minutosBloqueio = 120; // 2º bloqueio: 2 horas
    if (blockCount >= 3) minutosBloqueio = 1440; // 3º bloqueio em diante: 24 horas
    
    const blockedUntil = Date.now() + (minutosBloqueio * 60 * 1000);
    
    await supabase.from('known_numbers').update({ blockCount, blockedUntil }).eq('numero', numero);
    
    // Exclui a sessão para zerar tentativas e obrigar a recomeçar
    await deletarSessao(numero);
}

// --- Controle de Sessão ---
async function obterSessao(numero) {
    const now = Date.now();
    const { data } = await supabase.from('sessions').select('*').eq('numero', numero);
    if (!data || data.length === 0) return null;
    const row = data[0];

    if (Number(row.expiresAt) < now) {
        await supabase.from('sessions').delete().eq('numero', numero);
        return null;
    }
    return row;
}

async function criarSessao(numero, etapa = 'INICIO') {
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;
    await supabase.from('sessions').upsert(
        { numero, etapa, createdAt: now, expiresAt, docAttempts: 0, codeAttempts: 0 },
        { onConflict: 'numero' }
    );
    return { numero, etapa };
}

async function atualizarSessao(numero, campos) {
    const now = Date.now();
    campos.expiresAt = now + 10 * 60 * 1000;
    await supabase.from('sessions').update(campos).eq('numero', numero);
}

async function deletarSessao(numero) {
    await supabase.from('sessions').delete().eq('numero', numero);
}

// --- Pesquisa de Satisfação (CSAT) ---
async function registrarFeedback(numero, score) {
    const now = Date.now();
    await supabase.from('feedback_scores').upsert(
        { numero, score, createdAt: now, updatedAt: now },
        { onConflict: 'numero' }
    );
}

async function getExpiredSessions() {
    const now = Date.now();
    const { data } = await supabase.from('sessions').select('numero, etapa').lt('expiresAt', now);
    return data || [];
}

async function deleteExpiredSessions(numeros) {
    if (numeros.length === 0) return;
    await supabase.from('sessions').delete().in('numero', numeros);
}

// --- Histórico de Entregas (Métricas de Conversão) ---
async function registrarEntregaPdf(numero) {
    const now = Date.now();
    try {
        const { data } = await supabase.from('sessions').select('createdAt').eq('numero', numero);
        let timeTakenMs = 0;
        if (data && data.length > 0) {
            timeTakenMs = now - data[0].createdAt;
        }
        await supabase.from('pdf_deliveries').insert([{ numero, createdAt: now, timeTakenMs }]);
    } catch (err) {
        console.error('db:registrar-entrega-pdf-erro:', err.message);
    }
}

// --- Exames Pendentes ---
async function salvarExamePendente(numero, documento, codigoAtendimento) {
    const now = Date.now();
    
    // Verifica se o exame já está na fila de pendentes para esse usuário
    const { data } = await supabase
        .from('pending_results')
        .select('id')
        .eq('numero', numero)
        .eq('codigoAtendimento', codigoAtendimento);
        
    if (data && data.length > 0) {
        // Já existe, não insere duplicado
        return;
    }

    await supabase.from('pending_results').insert([
        { numero, documento, codigoAtendimento, createdAt: now }
    ]);
}

async function obterExamesPendentes() {
    const umDiaAtras = Date.now() - 24 * 60 * 60 * 1000;
    const { data } = await supabase.from('pending_results').select('*').gte('createdAt', umDiaAtras);
    return data || [];
}

async function removerExamePendente(id) {
    await supabase.from('pending_results').delete().eq('id', id);
}

async function removerExamesPendentesExpirados() {
    const umDiaAtras = Date.now() - 24 * 60 * 60 * 1000;
    await supabase.from('pending_results').delete().lt('createdAt', umDiaAtras);
}

// --- Obtenção de Métricas Consolidadas para Relatório Admin ---
async function obterMetricasRelatorio() {
    const now = new Date();
    const inicioDia = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const inicioSemana = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    try {
        const { data: known } = await supabase.from('known_numbers').select('*');
        const totalContatos = known ? known.length : 0;
        const aceitosLgpd = known ? known.filter(k => k.lgpdAccepted).length : 0;

        const { data: sessoes } = await supabase.from('sessions').select('*');
        const totalSessoes = sessoes ? sessoes.length : 0;
        
        const etapasMap = {};
        let docErros = 0;
        let codeErros = 0;
        if (sessoes) {
            sessoes.forEach(s => {
                etapasMap[s.etapa] = (etapasMap[s.etapa] || 0) + 1;
                if (s.docAttempts > 0) docErros++;
                if (s.codeAttempts > 0) codeErros++;
            });
        }
        const distribuicaoEtapas = Object.keys(etapasMap).map(etapa => ({ etapa, total: etapasMap[etapa] }));
        const totalDificuldades = docErros + codeErros;

        const { data: feedbacks } = await supabase.from('feedback_scores').select('*');
        let fb = { total: 0, media: 0, score_5: 0, score_4: 0, score_3: 0, score_2: 0, score_1: 0 };
        if (feedbacks && feedbacks.length > 0) {
            fb.total = feedbacks.length;
            const sumScore = feedbacks.reduce((acc, f) => {
                fb[`score_${f.score}`] = (fb[`score_${f.score}`] || 0) + 1;
                return acc + f.score;
            }, 0);
            fb.media = sumScore / feedbacks.length;
        }

        const { data: deliveries } = await supabase.from('pdf_deliveries').select('*');
        let tempoMedioMs = 0;
        if (deliveries && deliveries.length > 0) {
            const validDeliveries = deliveries.filter(d => d.timeTakenMs > 0);
            if (validDeliveries.length > 0) {
                const totalTime = validDeliveries.reduce((acc, d) => acc + d.timeTakenMs, 0);
                tempoMedioMs = totalTime / validDeliveries.length;
            }
        }

        const obterConversao = (timestampInicio) => {
            const entregues = deliveries ? deliveries.filter(d => d.createdAt >= timestampInicio).length : 0;
            
            if (!known) return { entregues, iniciados: 0, convertidos: 0, taxa: 'N/D' };
            const usersInPeriod = known.filter(k => k.firstSeenAt >= timestampInicio);
            const iniciados = usersInPeriod.length;
            const convertidos = usersInPeriod.filter(k => deliveries && deliveries.some(d => d.numero === k.numero)).length;
            const taxa = iniciados === 0 ? 'N/D' : Math.round((convertidos / iniciados) * 100);
            
            return { entregues, iniciados, convertidos, taxa };
        };

        const hoje = obterConversao(inicioDia);
        const semana = obterConversao(inicioSemana);
        const mes = obterConversao(inicioMes);

        const { data: pending } = await supabase.from('pending_results').select('id');
        const examesPendentes = pending ? pending.length : 0;

        return {
            contatos: { total: totalContatos, aceitosLgpd },
            sessoes: {
                total: totalSessoes,
                etapas: distribuicaoEtapas,
                comDificuldade: totalDificuldades,
                dificuldades: { docErros, codeErros }
            },
            feedback: {
                total: fb.total,
                media: fb.media,
                breakdown: {
                    5: fb.score_5,
                    4: fb.score_4,
                    3: fb.score_3,
                    2: fb.score_2,
                    1: fb.score_1
                }
            },
            conversao: { hoje, semana, mes },
            tempoMedioMs,
            examesPendentes
        };
    } catch (err) {
        console.error('Erro ao obter métricas de relatório:', err.message);
        return null;
    }
}

// --- Histórico de Chat (Painel Web) ---
async function salvarMensagemChat(numero, role, mensagem) {
    try {
        await supabase.from('chat_messages').insert([{ numero, role, mensagem }]);
    } catch (err) {
        console.error('Erro ao salvar mensagem no chat:', err.message);
    }
}

async function obterHistoricoChat(numero) {
    const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('numero', numero)
        .order('created_at', { ascending: true });
    return data || [];
}

// --- Controle de Contatos (Nomes de Perfil) ---
async function salvarContato(numero, name) {
    const now = new Date().toISOString();
    const { error } = await supabase.from('contacts').upsert(
        { numero, name, updated_at: now },
        { onConflict: 'numero' }
    );
    if (error) {
        console.error("Erro no upsert contacts:", error.message);
    }
}

module.exports = {
    verificarLgpd,
    aceitarLgpd,
    verificarBloqueio,
    bloquearContato,
    obterSessao,
    criarSessao,
    atualizarSessao,
    deletarSessao,
    registrarFeedback,
    getExpiredSessions,
    deleteExpiredSessions,
    registrarEntregaPdf,
    obterMetricasRelatorio,
    salvarExamePendente,
    obterExamesPendentes,
    removerExamePendente,
    removerExamesPendentesExpirados,
    salvarMensagemChat,
    obterHistoricoChat,
    salvarContato
};
