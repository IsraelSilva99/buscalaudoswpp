import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../supabase';
import { Users, FileText, Star, MessageCircle, Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, Clock, Clock3 } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

interface Metrics {
  totalMessages: number;
  activePatients: number;
  pdfDeliveries: number;
  avgRating: number;
  totalRatings: number;
  avgTime: string;
  totalErros: number;
  pendingExams: number;
}

interface ChartEntry {
  date: string;
  messages: number;
  bot: number;
  user: number;
}

interface RatingEntry {
  name: string;
  value: number;
}

interface PendingExam {
  id: string;
  numero: string;
  documento: string;
  createdAt: string;
}

interface ChartsData {
  dailyMessages: ChartEntry[];
  ratingsDistribution: RatingEntry[];
  pendingList: PendingExam[];
}

export default function DashboardView() {
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<Metrics>({
    totalMessages: 0,
    activePatients: 0,
    pdfDeliveries: 0,
    avgRating: 0,
    totalRatings: 0,
    avgTime: '0s',
    totalErros: 0,
    pendingExams: 0
  });

  const [chartsData, setChartsData] = useState<ChartsData>({
    dailyMessages: [],
    ratingsDistribution: [],
    pendingList: []
  });

  // Função auxiliar para driblar o limite de 1000 linhas do Supabase
  const fetchAll = async (queryBuilder: any) => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, err } = await queryBuilder.range(from, from + step - 1);
      if (err) throw err;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < step) hasMore = false;
        else from += step;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  useEffect(() => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) return;

    const fetchDashboardData = async (isBackground = false) => {
      if (!isBackground) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const now = new Date();
        let startDate = startOfDay(now);
        let endDate = endOfDay(now);

        if (dateRange === '7days') {
          startDate = startOfDay(subDays(now, 6));
        } else if (dateRange === '30days') {
          startDate = startOfDay(subDays(now, 29));
        } else if (dateRange === 'all') {
          startDate = new Date(0); // Epoch - Pega tudo
        } else if (dateRange === 'custom') {
          startDate = startOfDay(new Date(customStart + 'T00:00:00'));
          endDate = endOfDay(new Date(customEnd + 'T23:59:59'));
        }

        const startIso = startDate.toISOString();
        const endIso = endDate.toISOString();
        const startMs = startDate.getTime();
        const endMs = endDate.getTime();

        // Parallel Fetch com Paginação (Bypass limite 1000)
        const [
          messages,
          deliveries,
          feedbacks,
          sessions,
          pendings
        ] = await Promise.all([
          fetchAll(supabase.from('chat_messages').select('numero, created_at, role').gte('created_at', startIso).lte('created_at', endIso)),
          fetchAll(supabase.from('pdf_deliveries').select('numero, createdAt, timeTakenMs').gte('createdAt', startMs).lte('createdAt', endMs)),
          fetchAll(supabase.from('feedback_scores').select('score, createdAt').gte('createdAt', startMs).lte('createdAt', endMs)),
          fetchAll(supabase.from('sessions').select('numero, createdAt, docAttempts, codeAttempts').gte('createdAt', startMs).lte('createdAt', endMs)),
          fetchAll(supabase.from('pending_results').select('id, numero, documento, codigoAtendimento, createdAt').order('createdAt', { ascending: false }))
        ]);

        // Calculate Metrics
        const uniquePatients = new Set((messages || []).map(m => m.numero)).size;
        const totalMsgs = (messages || []).length;
        const totalPdfs = (deliveries || []).length;
        const activePendings = (pendings || []).length;

        // Tempo Médio de Entrega
        let totalTime = 0;
        let validTimeCount = 0;
        (deliveries || []).forEach(d => {
          if (d.timeTakenMs > 0) {
            totalTime += d.timeTakenMs;
            validTimeCount++;
          }
        });
        let avgTimeStr = '0s';
        if (validTimeCount > 0) {
          const totalSeconds = Math.round(totalTime / validTimeCount / 1000);
          if (totalSeconds >= 60) {
            const m = Math.floor(totalSeconds / 60);
            const s = totalSeconds % 60;
            avgTimeStr = `${m}m ${s}s`;
          } else {
            avgTimeStr = `${totalSeconds}s`;
          }
        }

        // Dificuldades
        let totalErros = 0;
        (sessions || []).forEach(s => {
          if (s.docAttempts > 0) totalErros += s.docAttempts;
          if (s.codeAttempts > 0) totalErros += s.codeAttempts;
        });

        let sumRating = 0;
        const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        (feedbacks || []).forEach(f => {
          sumRating += f.score;
          ratingCounts[f.score] += 1;
        });
        const avg = feedbacks && feedbacks.length > 0 ? (sumRating / feedbacks.length).toFixed(1) : 0;

        setMetrics({
          totalMessages: totalMsgs,
          activePatients: uniquePatients,
          pdfDeliveries: totalPdfs,
          avgRating: Number(avg),
          totalRatings: (feedbacks || []).length,
          avgTime: avgTimeStr,
          totalErros: totalErros,
          pendingExams: activePendings
        });

        // Calculate Charts Data
        const dailyMap = new Map<string, ChartEntry>();

        if (dateRange === 'today') {
          for (let i = 0; i < 24; i++) {
            const hourStr = `${i.toString().padStart(2, '0')}:00`;
            dailyMap.set(hourStr, { date: hourStr, messages: 0, bot: 0, user: 0 });
          }
          (messages || []).forEach(m => {
            const d = new Date(m.created_at);
            const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
            if (dailyMap.has(hourStr)) {
              const entry = dailyMap.get(hourStr)!;
              entry.messages += 1;
              if (m.role === 'user') entry.user += 1;
              else entry.bot += 1;
            }
          });
        } else {
          // Pre-fill days map only if not 'all'
          if (dateRange !== 'all') {
            let currentDay = new Date(startDate);
            while (currentDay <= endDate) {
              const dateStr = format(currentDay, 'dd/MM', { locale: ptBR });
              dailyMap.set(dateStr, { date: dateStr, messages: 0, bot: 0, user: 0 });
              currentDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
            }
          }

          (messages || []).forEach(m => {
            const dateStr = format(new Date(m.created_at), 'dd/MM', { locale: ptBR });
            if (!dailyMap.has(dateStr)) {
              dailyMap.set(dateStr, { date: dateStr, messages: 0, bot: 0, user: 0 });
            }
            const entry = dailyMap.get(dateStr)!;
            entry.messages += 1;
            if (m.role === 'user') entry.user += 1;
            else entry.bot += 1;
          });
        }

        let dailyArray = Array.from(dailyMap.values());

        // If 'all', sort chronologically as they were added dynamically
        if (dateRange === 'all') {
          dailyArray = dailyArray.sort((a, b) => {
            const [da, ma] = a.date.split('/');
            const [db, mb] = b.date.split('/');
            const timeA = new Date(now.getFullYear(), parseInt(ma) - 1, parseInt(da)).getTime();
            const timeB = new Date(now.getFullYear(), parseInt(mb) - 1, parseInt(db)).getTime();
            return timeA - timeB;
          });
        }

        // 2. Ratings Distribution
        const ratingsArray = Object.entries(ratingCounts)
          .filter(([_, count]) => count > 0)
          .map(([score, count]) => ({
            name: `Nota ${score}`,
            value: count
          }));

        setChartsData({
          dailyMessages: dailyArray,
          ratingsDistribution: ratingsArray,
          pendingList: (pendings || []).slice(0, 15) // top 15 list
        });

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        if (!isBackground) {
          setError("Não foi possível carregar os dados. Verifique a conexão.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData(false);

    // Auto-refresh a cada 10 segundos para tempo real silenciado
    const intervalId = setInterval(() => {
      fetchDashboardData(true);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [dateRange, customStart, customEnd]);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#0b141a]">
        <div className="bg-white dark:bg-[#111b21] p-6 rounded-2xl border border-rose-200 dark:border-rose-900/30 text-center max-w-md shadow-sm">
          <p className="text-rose-600 dark:text-rose-400 font-medium mb-4">{error}</p>
          <button
            onClick={() => { setError(null); setIsLoading(true); setDateRange('today'); }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-8 flex flex-col overflow-y-auto bg-slate-50 dark:bg-[#0b141a]">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard Analítico</h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-1">Visão geral do desempenho do assistente virtual</p>
        </div>

        {/* Date Filter */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex bg-white dark:bg-[#111b21] rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-800">
            {(['today', '7days', '30days', 'all', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${dateRange === range
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
              >
                {range === 'today' ? 'Hoje' : range === '7days' ? '7 Dias' : range === '30days' ? '30 Dias' : range === 'all' ? 'Tudo' : 'Personalizado'}
              </button>
            ))}
          </div>

          {/* Filtro Personalizado Inputs */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 animate-fadeIn bg-white dark:bg-[#111b21] p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500 transition-colors"
              />
              <span className="text-slate-400 dark:text-slate-500 text-sm">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          )}
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6 mb-8">
        <StatCard
          title="Pacientes"
          value={metrics.activePatients}
          icon={<Users className="w-6 h-6 text-blue-500" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Laudos"
          value={metrics.pdfDeliveries}
          icon={<FileText className="w-6 h-6 text-emerald-500" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Mensagens"
          value={metrics.totalMessages}
          icon={<MessageCircle className="w-6 h-6 text-purple-500" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Aguardando"
          value={metrics.pendingExams}
          subtitle="pendentes"
          icon={<Clock3 className="w-6 h-6 text-orange-500" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Tempo Médio"
          value={metrics.avgTime}
          subtitle="de entrega"
          icon={<Clock className="w-6 h-6 text-indigo-500" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Avaliação"
          value={metrics.avgRating > 0 ? metrics.avgRating : 'N/A'}
          subtitle={`${metrics.totalRatings} avaliações`}
          icon={<Star className="w-6 h-6 text-amber-400 fill-amber-400" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Dificuldades"
          value={metrics.totalErros}
          subtitle="erros digitação"
          icon={<ArrowDownRight className="w-6 h-6 text-rose-500" />}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111b21] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Volume de Interações</h3>
            <span className="text-sm text-slate-500 flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> {dateRange === 'today' ? 'Hoje (por hora)' : `Últimos ${dateRange.replace('days', ' dias')}`}</span>
          </div>
          <div className="h-[300px] w-full">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartsData.dailyMessages} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b' }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="messages" name="Mensagens" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMessages)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-[#111b21] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">Satisfação (Notas)</h3>
          <div className="flex-1 flex items-center justify-center">
            {isLoading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            ) : chartsData.ratingsDistribution.length === 0 ? (
              <span className="text-base text-slate-400">Sem avaliações no período</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.ratingsDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartsData.ratingsDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '14px' }}
                    itemStyle={{ color: '#111b21' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '14px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Pending Exams List */}
      <div className="bg-white dark:bg-[#111b21] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Últimos Laudos Pendentes</h3>
          <span className="text-sm font-medium px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 rounded-full">
            {metrics.pendingExams} aguardando
          </span>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div></div>
          ) : chartsData.pendingList.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-base">Nenhum laudo pendente no momento.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Data</th>
                  <th className="pb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Paciente</th>
                  <th className="pb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Documento</th>
                  <th className="pb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {chartsData.pendingList.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 text-slate-600 dark:text-slate-300">{format(new Date(p.createdAt), 'dd/MM HH:mm')}</td>
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{p.numero}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{p.documento}</td>
                    <td className="py-3">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                        Processando
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  isLoading?: boolean;
}

function StatCard({ title, value, subtitle, icon, trend, trendUp, isLoading }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-[#111b21] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${trendUp ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' : 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</h4>
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          ) : (
            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</span>
          )}
          {subtitle && <span className="text-xs text-slate-400 font-medium truncate max-w-[80px]" title={subtitle}>{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}
