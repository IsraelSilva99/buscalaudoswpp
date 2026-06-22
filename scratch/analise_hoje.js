const fs = require('fs');
require('dotenv').config({ path: '.env' });

async function query(table, select = '*', extraParams = '') {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}?select=${select}${extraParams}`;
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Error fetching ${table}:`, err);
    return [];
  }
  return await res.json();
}

async function analisarHoje() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const startOfDayMs = hoje.getTime();
  const startOfDayIso = hoje.toISOString();

  console.log('--- ANÁLISE DE ATENDIMENTOS DE HOJE ---');
  console.log(`Data Base: ${startOfDayIso}`);

  // 1. Known Numbers
  const knownNumbers = await query('known_numbers', '*', `&firstSeenAt=gte.${startOfDayMs}`);
  console.log(`\nNovos pacientes hoje: ${knownNumbers.length}`);

  // 2. Entregas de PDF
  const deliveries = await query('pdf_deliveries', '*', `&createdAt=gte.${startOfDayMs}`);
  console.log(`\nLaudos entregues hoje: ${deliveries.length}`);

  // 3. Exames Pendentes (EM ANALISE)
  const pendentes = await query('pending_results', '*', `&createdAt=gte.${startOfDayMs}`);
  console.log(`\nExames em análise (pendentes) hoje: ${pendentes.length}`);

  // 4. Feedbacks
  const feedbacks = await query('feedback_scores', '*', `&created_at=gte.${startOfDayIso}`);
  console.log(`\nFeedbacks hoje: ${feedbacks.length}`);
  if (feedbacks.length > 0) {
      const counts = {1:0, 2:0, 3:0, 4:0, 5:0};
      feedbacks.forEach(f => counts[f.score] = (counts[f.score] || 0) + 1);
      console.log('Distribuição das notas:', counts);
  }

  // 5. Histórico de Chat (Erros e Comportamentos Curiosos)
  // Fetch messages from today
  const messages = await query('chat_messages', '*', `&created_at=gte.${startOfDayIso}&order=created_at.asc`);
  console.log(`\nTotal de mensagens trocadas hoje: ${messages.length}`);
  
  // Agrupar por número
  const msgsPorNumero = {};
  messages.forEach(m => {
      if (!msgsPorNumero[m.numero]) msgsPorNumero[m.numero] = [];
      msgsPorNumero[m.numero].push(m);
  });

  console.log(`Pacientes ativos no chat hoje: ${Object.keys(msgsPorNumero).length}`);

  // Buscar comportamentos curiosos:
  // - Quantos erraram o documento?
  // - Quantos mandaram "não tenho"?
  // - Quantos desistiram?
  let naoTenhoCount = 0;
  let erroDocCount = 0;
  let erroAtendimentoCount = 0;

  Object.values(msgsPorNumero).forEach(hist => {
      hist.forEach(m => {
          if (m.role === 'user') {
              const text = m.mensagem.toLowerCase();
              if (text.includes('não tenho') || text.includes('nao tenho') || text.includes('esqueci') || text.includes('perdi')) {
                  naoTenhoCount++;
              }
          } else {
              const text = m.mensagem;
              if (text.includes('Desculpe, não encontrei nenhum exame')) erroDocCount++;
              if (text.includes('O Código de Atendimento informado está incorreto')) erroAtendimentoCount++;
          }
      });
  });

  console.log(`\n--- COMPORTAMENTOS CURIOSOS ---`);
  console.log(`Vezes que os pacientes disseram "Não tenho / Esqueci": ${naoTenhoCount}`);
  console.log(`Vezes que o bot respondeu "Documento não encontrado": ${erroDocCount}`);
  console.log(`Vezes que o bot respondeu "Código de Atendimento incorreto": ${erroAtendimentoCount}`);

}

analisarHoje().catch(console.error);
