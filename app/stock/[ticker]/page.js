'use client';
import { useState, useEffect, use } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (val) => {
  if (val === null || val === undefined) return 'N/A';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};

const NAV = [
  { key: 'overview', label: 'Stock Overview' },
  { key: 'quality', label: 'Quality Scorecard' },
  { key: 'financials', label: 'Financials' },
  { key: 'dcf', label: 'Dynamic DCF' },
];

const QUESTIONS = [
  { dim: 'Gestión', text: '¿El equipo directivo cumplió su guidance trimestral?' },
  { dim: 'Gestión', text: '¿La compensación ejecutiva está alineada con métricas de largo plazo?' },
  { dim: 'Gestión', text: '¿Hubo cambios significativos en el C-suite en los últimos 12 meses?' },
  { dim: 'Concentración', text: '¿El top-3 de clientes representa menos del 30% de ingresos?' },
  { dim: 'Concentración', text: '¿Opera en más de un segmento geográfico relevante?' },
  { dim: 'Concentración', text: '¿El producto principal representa menos del 50% de ingresos?' },
  { dim: 'Tendencia Operativa', text: '¿El margen operativo mejoró en los últimos 3 años?' },
  { dim: 'Tendencia Operativa', text: '¿El FCF/share creció >8% CAGR en los últimos 5 años?' },
  { dim: 'Tendencia Operativa', text: '¿El ROIC supera el WACC estimado?' },
  { dim: 'Calidad Beneficios', text: '¿El ratio FCF/Net Income supera 0.8x promedio de 3 años?' },
  { dim: 'Calidad Beneficios', text: '¿Las accruals como % de activos son inferiores al 5%?' },
  { dim: 'Calidad Beneficios', text: '¿El crecimiento de receivables no dobla el de revenues?' },
  { dim: 'Transparencia', text: '¿La empresa provee guidance cuantitativo trimestral?' },
  { dim: 'Transparencia', text: '¿El 10-K incluye riesgos materiales específicos del negocio?' },
  { dim: 'Transparencia', text: '¿Los segmentos permiten calcular márgenes por unidad de negocio?' },
];

const DIMS = ['Gestión', 'Concentración', 'Tendencia Operativa', 'Calidad Beneficios', 'Transparencia'];

const ScoreRing = ({ score, size = 80 }) => {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const fill = score !== null ? (circ * (1 - score / 100)) : circ;
  const color = score === null ? '#3f3f46' : score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color} fontSize="16" fontWeight="500">
        {score ?? '—'}
      </text>
    </svg>
  );
};

const MetricCard = ({ title, value, score, description, children }) => {
  const color = score === null ? '#a1a1aa' : score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }}></div>
          <span className="text-sm text-zinc-300">{title}</span>
        </div>
        {score !== null && (
          <span className="text-sm font-medium" style={{ color }}>
            {score}<span className="text-zinc-600 text-xs">/100</span>
          </span>
        )}
      </div>
      <div className="text-3xl font-medium mt-3 mb-1" style={{ color }}>{value}</div>
      {description && <p className="text-xs text-zinc-500 mb-3">{description}</p>}
      {children}
    </div>
  );
};

export default function StockPage({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [answers, setAnswers] = useState({});
  const [evidence, setEvidence] = useState({});

  useEffect(() => {
    fetch(`/api/stock?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return; } setData(d); })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [ticker]);

  const getDimScore = (dim) => {
    const indices = QUESTIONS.map((q, i) => q.dim === dim ? i : -1).filter(i => i >= 0);
    const answered = indices.filter(i => answers[i] === 'SI' || answers[i] === 'NO');
    if (!answered.length) return null;
    return Math.round((answered.filter(i => answers[i] === 'SI').length / answered.length) * 100);
  };

  const totalScore = () => {
    const scores = DIMS.map(d => getDimScore(d)).filter(s => s !== null);
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-emerald-400 mb-1">Cargando SEC EDGAR...</div>
        <div className="text-zinc-500 text-sm">{ticker}</div>
      </div>
    </main>
  );

  if (error) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 text-lg mb-4">{error}</div>
        <a href="/" className="text-zinc-500 text-sm hover:text-white">← Volver</a>
      </div>
    </main>
  );

  const score = totalScore();
  const answeredCount = Object.keys(answers).filter(k => answers[k]).length;
  const revChartData = data.revHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const marginData = data.revHistory.map((r, i) => ({ year: r.year, margin: data.opMargin ?? 0 }));

  const qualityScore = score ?? 0;
  const dimScores = DIMS.map(d => ({ name: d.slice(0, 4), score: getDimScore(d) ?? 0 }));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Topbar */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center gap-3 sticky top-0 bg-zinc-950 z-10">
        <a href="/" className="flex items-center gap-2 mr-2">
          <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-xs font-bold">DD</div>
          <span className="text-sm font-medium">DueDiligence</span>
        </a>
        <span className="text-zinc-700">/</span>
        <a href="/" className="text-zinc-500 text-sm hover:text-white">Home</a>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm">{ticker}</span>
        <span className="text-zinc-700">/</span>
        <span className="text-emerald-400 text-sm">{NAV.find(n => n.key === tab)?.label}</span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-52 shrink-0 border-r border-zinc-800 min-h-screen p-4 sticky top-12 self-start">
          <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3 px-2">Analysis</div>
          <div className="space-y-0.5">
            {NAV.map(n => (
              <button key={n.key} onClick={() => setTab(n.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  tab === n.key ? 'bg-emerald-500/15 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}>
                {n.label}
              </button>
            ))}
          </div>

          {score !== null && (
            <div className="mt-6 p-4 bg-zinc-900 rounded-xl text-center border border-zinc-800">
              <ScoreRing score={score} size={72} />
              <div className="text-xs text-zinc-500 mt-2">Score DD</div>
              <div className="text-xs text-zinc-600">{answeredCount}/15</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-8">

          {/* Company header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-lg font-bold text-emerald-400">
              {ticker.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-medium tracking-tight">{data.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-zinc-500 text-sm">{ticker}</span>
                <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=10-K`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs border border-zinc-700 px-2 py-0.5 rounded text-zinc-500 hover:border-emerald-500 hover:text-emerald-400 transition-colors">
                  SEC EDGAR ↗
                </a>
              </div>
            </div>
          </div>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Revenue TTM', val: fmt(data.revVal), delta: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% YoY` : null, good: data.revGrowth > 0 },
                  { label: 'Net Income', val: fmt(data.niVal), delta: null },
                  { label: 'Cash Flow Op.', val: fmt(data.fcfVal), delta: null },
                  { label: 'Total Assets', val: fmt(data.assetsVal), delta: null },
                ].map(m => (
                  <div key={m.label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{m.label}</div>
                    <div className="text-2xl font-medium">{m.val}</div>
                    {m.delta && <div className={`text-xs mt-1 ${m.good ? 'text-emerald-400' : 'text-red-400'}`}>{m.delta}</div>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-sm text-zinc-300">Revenue Growth</span>
                    </div>
                    <span className="text-sm font-medium text-emerald-400">{data.revGrowth !== null ? `+${data.revGrowth}%` : 'N/A'}</span>
                  </div>
                  <div className={`text-3xl font-medium mt-2 mb-1 ${data.revGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">{data.revGrowth > 10 ? 'Por encima del 10% CAGR, fuerte compounder' : 'Crecimiento moderado'}</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={revChartData} barSize={28}>
                      <XAxis dataKey="year" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={v => [`$${v}B`, 'Revenue']} contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {revChartData.map((_, i) => <Cell key={i} fill={i === revChartData.length - 1 ? '#10b981' : '#10b98144'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-sm text-zinc-300">Margen Operativo</span>
                    </div>
                    <span className="text-sm font-medium text-emerald-400">{data.opMargin !== null ? `${data.opMargin}%` : 'N/A'}</span>
                  </div>
                  <div className={`text-3xl font-medium mt-2 mb-1 ${data.opMargin > 15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {data.opMargin !== null ? `${data.opMargin}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">{data.opMargin > 20 ? 'Márgenes fuertes, ventaja competitiva visible' : 'Márgenes en rango normal'}</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={marginData}>
                      <XAxis dataKey="year" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={v => [`${v}%`, 'Margen Op.']} contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="margin" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Margen Operativo', val: data.opMargin !== null ? `${data.opMargin}%` : 'N/A', good: data.opMargin > 15, desc: data.opMargin > 20 ? 'Márgenes excepcionales' : 'Márgenes normales' },
                  { label: 'Margen Neto', val: data.netMargin !== null ? `${data.netMargin}%` : 'N/A', good: data.netMargin > 10, desc: data.netMargin > 15 ? 'Alta rentabilidad neta' : 'Rentabilidad moderada' },
                  { label: 'Crecimiento YoY', val: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}%` : 'N/A', good: data.revGrowth > 0, desc: data.revGrowth > 20 ? 'Crecimiento acelerado' : 'Crecimiento estable' },
                ].map(m => (
                  <div key={m.label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{m.label}</div>
                    <div className={`text-2xl font-medium ${m.good ? 'text-emerald-400' : 'text-red-400'}`}>{m.val}</div>
                    <div className="text-xs text-zinc-600 mt-1">{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUALITY SCORECARD */}
          {tab === 'quality' && (
            <div>
              <div className="flex items-center gap-6 mb-8 p-6 bg-zinc-900 rounded-xl border border-zinc-800">
                <ScoreRing score={score} size={100} />
                <div>
                  <div className="text-2xl font-medium mb-1">
                    {score !== null ? (score >= 70 ? 'Negocio de calidad' : score >= 40 ? 'Calidad moderada' : 'Señales de alerta') : 'Completa el análisis'}
                  </div>
                  <p className="text-zinc-400 text-sm max-w-md">
                    {score !== null
                      ? `Score basado en ${answeredCount} de 15 preguntas respondidas a partir de filings SEC.`
                      : 'Responde las preguntas de cada dimensión para obtener el score de due diligence.'}
                  </p>
                  <div className="text-xs text-zinc-600 mt-2">Heurísticas fundamentales · No es una señal de compra/venta</div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 col-span-2 lg:col-span-4">
                  <div className="text-xs text-zinc-500 uppercase tracking-wide mb-4">Score por dimensión</div>
                  <div className="grid grid-cols-5 gap-3">
                    {DIMS.map(dim => {
                      const s = getDimScore(dim);
                      const color = s === null ? '#3f3f46' : s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={dim} className="text-center">
                          <ScoreRing score={s} size={64} />
                          <div className="text-xs text-zinc-500 mt-2 leading-tight">{dim}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {DIMS.map((dim, di) => (
                  <div key={dim}>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                      <div className="text-xs uppercase tracking-widest text-zinc-500">{di + 1}. {dim}</div>
                      {getDimScore(dim) !== null && (
                        <div className={`text-sm font-medium ${getDimScore(dim) >= 70 ? 'text-emerald-400' : getDimScore(dim) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {getDimScore(dim)}/100
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {QUESTIONS.map((q, qi) => q.dim !== dim ? null : (
                        <div key={qi} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                          <p className="text-sm text-zinc-200 mb-3 leading-relaxed">P{qi + 1}. {q.text}</p>
                          <div className="flex gap-2 mb-3">
                            {['SI', 'NO', 'N/A'].map(opt => (
                              <button key={opt} onClick={() => setAnswers(prev => ({ ...prev, [qi]: opt }))}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                                  answers[qi] === opt
                                    ? opt === 'SI' ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : opt === 'NO' ? 'bg-red-500 border-red-500 text-white'
                                    : 'bg-zinc-600 border-zinc-600 text-white'
                                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                                }`}>
                                {opt}
                              </button>
                            ))}
                          </div>
                          {answers[qi] && (
                            <input
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                              placeholder="Evidencia del filing (cita exacta)..."
                              value={evidence[qi] || ''}
                              onChange={e => setEvidence(prev => ({ ...prev, [qi]: e.target.value }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FINANCIALS */}
          {tab === 'financials' && (
            <div>
              <h2 className="text-xl font-medium mb-6">Financials — SEC EDGAR</h2>
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-zinc-800">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Income Statement</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-5 py-3 text-zinc-500 font-medium">Métrica</th>
                      {data.revHistory.map(r => (
                        <th key={r.year} className="text-right px-4 py-3 text-zinc-500 font-medium">{r.year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Revenue', values: data.revHistory.map(r => fmt(r.val)) },
                      { label: 'Op. Income', values: data.revHistory.map(() => '—') },
                      { label: 'Net Income', values: data.revHistory.map(() => '—') },
                      { label: 'Cash Flow Op.', values: data.revHistory.map(() => '—') },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3 text-zinc-400">{row.label}</td>
                        {row.values.map((v, j) => (
                          <td key={j} className="text-right px-4 py-3 text-white">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                <div className="text-xs text-zinc-500 uppercase tracking-wide mb-4">Revenue histórico</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revChartData} barSize={40}>
                    <XAxis dataKey="year" tick={{ fill: '#52525b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}B`} />
                    <Tooltip formatter={v => [`$${v}B`, 'Revenue']} contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {revChartData.map((_, i) => <Cell key={i} fill={i === revChartData.length - 1 ? '#10b981' : '#10b98155'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-zinc-600 mt-4">Datos de SEC EDGAR (XBRL). No constituye asesoramiento de inversión.</p>
            </div>
          )}

          {/* DCF */}
          {tab === 'dcf' && (
            <div>
              <h2 className="text-xl font-medium mb-6">Dynamic DCF</h2>
              <div className="bg-zinc-900 rounded-xl p-10 text-center border border-zinc-800">
                <div className="text-5xl mb-4 text-zinc-700">$</div>
                <p className="text-zinc-400 mb-2 font-medium">Valoración DCF automática</p>
                <p className="text-zinc-600 text-sm max-w-sm mx-auto">Próximamente — se calculará automáticamente usando los datos del 10-K más reciente via API de Anthropic.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}