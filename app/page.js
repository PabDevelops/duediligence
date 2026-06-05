'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const router = useRouter();

  function go(t) {
    const tk = (t || ticker).toUpperCase().trim();
    if (!tk) return;
    router.push(`/stock/${tk}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-hidden">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-xs font-bold">DD</div>
          <span className="font-medium tracking-tight">DueDiligence</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
          <a href="#como" className="hover:text-white transition-colors">Cómo funciona</a>
          <a href="#metodologia" className="hover:text-white transition-colors">Metodología</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-24 pb-20">
        {/* Glow background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-sm text-emerald-400 mb-8">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
            Datos en tiempo real · SEC EDGAR + Alpha Vantage
          </div>

          <h1 className="text-5xl md:text-7xl font-medium tracking-tight leading-tight mb-6">
            Análisis fundamental<br />
            <span className="text-emerald-400">sin opiniones</span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            15 preguntas. 5 dimensiones. Evidencia directa de los filings SEC.
            El veredicto lo decides tú.
          </p>

          {/* Search */}
          <div className="flex gap-3 max-w-md mx-auto mb-6">
            <input
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 text-white uppercase placeholder:normal-case placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 text-base transition-colors"
              placeholder="Ticker: AAPL, MSFT, NVDA..."
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && go()}
              maxLength={6}
            />
            <button onClick={() => go()}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-4 rounded-xl font-medium transition-colors text-base whitespace-nowrap">
              Analizar →
            </button>
          </div>

          <div className="flex gap-2 justify-center flex-wrap">
            {['AAPL', 'MSFT', 'NVDA', 'ASML', 'VISA', 'GOOGL'].map(t => (
              <button key={t} onClick={() => go(t)}
                className="px-3 py-1.5 border border-zinc-800 rounded-lg text-sm text-zinc-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-zinc-800/50 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-8 text-center">
          {[
            { val: '8.000+', label: 'Empresas US' },
            { val: '15', label: 'Preguntas DD' },
            { val: '5', label: 'Dimensiones' },
            { val: '100%', label: 'Datos primarios' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-medium text-emerald-400 mb-1">{s.val}</div>
              <div className="text-sm text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como" className="py-24 px-8 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Cómo funciona</h2>
          <p className="text-zinc-400 max-w-lg mx-auto">Tres pasos para pasar de ticker a veredicto fundamentado.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Ingresa el ticker',
              desc: 'Escribe cualquier ticker del mercado US. Cargamos automáticamente datos de SEC EDGAR y Alpha Vantage.',
              icon: '⌨',
            },
            {
              step: '02',
              title: 'Revisa las métricas',
              desc: 'Market Cap, P/E, márgenes, crecimiento, deuda, ROE, FCF histórico y gráfico de precio. Todo en una pantalla.',
              icon: '📊',
            },
            {
              step: '03',
              title: 'Completa el due diligence',
              desc: '15 preguntas en 5 dimensiones. Cada respuesta requiere evidencia citada del filing. Sin opiniones externas.',
              icon: '✓',
            },
          ].map(s => (
            <div key={s.step} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="text-6xl font-bold text-zinc-800 absolute top-4 right-4">{s.step}</div>
              <div className="text-3xl mb-4">{s.icon}</div>
              <h3 className="text-lg font-medium mb-2">{s.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Metodología */}
      <section id="metodologia" className="py-24 px-8 bg-zinc-900/30 border-y border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">Las 5 dimensiones</h2>
            <p className="text-zinc-400 max-w-lg mx-auto">Cada empresa se analiza a través del mismo framework. Sin excepciones.</p>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {[
              { num: '1', name: 'Gestión', desc: 'Cumplimiento de guidance, compensación y estabilidad del equipo directivo.' },
              { num: '2', name: 'Concentración', desc: 'Diversificación de clientes, geografías y líneas de producto.' },
              { num: '3', name: 'Tendencia Operativa', desc: 'Evolución de márgenes, FCF per share y retorno sobre capital.' },
              { num: '4', name: 'Calidad de Beneficios', desc: 'Conversión de beneficios a caja, accruals y calidad contable.' },
              { num: '5', name: 'Transparencia', desc: 'Guidance cuantitativo, disclosure de riesgos y reporting por segmento.' },
            ].map(d => (
              <div key={d.num} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 text-sm font-medium mb-3">{d.num}</div>
                <h3 className="font-medium mb-2 text-sm">{d.name}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-8 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">
            Empieza tu análisis ahora
          </h2>
          <p className="text-zinc-400 mb-8">Sin cuenta. Sin tarjeta. Solo el ticker.</p>
          <div className="flex gap-3 max-w-sm mx-auto">
            <input
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white uppercase placeholder:normal-case placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Ticker..."
              onKeyDown={e => { if (e.key === 'Enter') { const tk = e.target.value.toUpperCase().trim(); if (tk) router.push(`/stock/${tk}`); }}}
              maxLength={6}
            />
            <button onClick={() => go()}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-3 rounded-xl font-medium transition-colors">
              Ir →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 px-8 py-6 flex items-center justify-between text-sm text-zinc-600">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-emerald-500 rounded flex items-center justify-center text-xs font-bold text-white">DD</div>
          <span>DueDiligence</span>
        </div>
        <div>Datos de SEC EDGAR y Alpha Vantage · No es asesoramiento de inversión</div>
      </footer>

    </main>
  );
}