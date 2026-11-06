"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import NewNav from '../../../../components/new/NewNav';
import FinancialDataNotice from '../../../../components/new/FinancialDataNotice';
import FinancialCoverageBadge from '../../../../components/new/FinancialCoverageBadge';
import {FinancialEditorProvider} from '../../../../components/company-analysis/FinancialEditor';
import EngineV2Panel from '../../../../components/workspace/stock/EngineV2Panel';
import { QualityBreakdown, RangeBar52W, StatSection, numberSections, hasFundamentals } from '../../../../components/company-analysis/CompanyNumbers';
import FinancialStatements, { GrowthHistory } from '../../../../components/company-analysis/FinancialStatements';
import { useStockData } from '../../../../../lib/hooks/useStockData';
import { useEntryPriceProjection } from '../../../../../lib/hooks/useEntryPriceProjection';
import { computeEasyMode } from '../../../../../lib/financialCalculations';
import { currencySymbol, presentAnalysis } from '../../../../../lib/currencyPresentation';
import './analysis.css';
const sections = [['resumen', 'Resumen'], ['crecimiento', 'Crecimiento'], ['calidad', 'Rentabilidad y calidad'], ['valoracion', 'Valoración'], ['riesgos', 'Riesgos'], ['estados-financieros', 'Estados financieros']];
function Shell({
  children
}) {
  return <div className="analysis-shell"><main className="analysis-container"><NewNav active="inicio" />{children}</main></div>;
}
export default function AnalysisContent({ ticker, initialData }) {
  const {
    data,
    error,
    loading,
    refetch,
    reload,
    refreshing
  } = useStockData(ticker, { initialData });
  const projection = useEntryPriceProjection({
    ticker,
    data
  });
  const easyMode = useMemo(() => data ? computeEasyMode(data, hasFundamentals(data)) : null, [data]);
  const engine = useMemo(() => presentAnalysis(projection.engine, data), [projection.engine, data]);
  if (loading) return <Shell><p role="status">Cargando análisis de {ticker}…</p></Shell>;
  if (!data || error) return <Shell><h1>Análisis completo</h1><p role="alert">No encontramos {ticker}. Comprueba el ticker o inténtalo de nuevo.</p><button onClick={refetch}>Reintentar</button><Link href="/">Volver al inicio</Link></Shell>;
  const sym = currencySymbol(data.currency);
  const stats = numberSections(data, easyMode, ticker, sym, projection.engine);
  const block = section => engine ? <EngineV2Panel engine={engine} sym={sym} section={section} /> : <p>Análisis N/D: faltan datos para evaluar esta dimensión.</p>;
  const metrics = indices => indices.map(i => stats[i] ? <StatSection key={stats[i].title} {...stats[i]} /> : null);
  const signals = engine?.signals?.signals || [];
  return <FinancialEditorProvider ticker={ticker} data={data} onSaved={reload}><Shell>
    <Link href={`/stock/${ticker}`} style={{
      color: 'inherit',
      fontSize: 13,
      fontWeight: 700,
      textDecoration: 'none'
    }}>← Volver a la ficha de {data.name || ticker}</Link>
    <header><h1 style={{
        margin: '0 0 6px',
        fontSize: 28,
        letterSpacing: '-.03em'
      }}>Análisis completo</h1><p style={{
        margin: 0,
        fontSize: 13
      }}>{data.name || ticker} · {ticker}</p><p style={{
        fontSize: 12,
        lineHeight: 1.6
      }}>Del negocio a sus cifras, riesgos y valoración. Despliega «¿Qué significa?» para ver las explicaciones o accede directamente a los estados financieros.</p><p style={{
        fontSize: 11
      }}>Cotización y escenarios: {data.currency || 'moneda N/D'}. Los importes contables identifican su moneda y periodo. No se realizan conversiones nuevas.</p></header>
    <FinancialCoverageBadge data={data} easyMode={easyMode} analysis={projection.engine}/>
    <nav className="analysis-nav" aria-label="Secciones del análisis completo">{sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
    <section className="analysis-section" id="resumen" aria-labelledby="resumen-title"><h2 id="resumen-title">Resumen</h2><QualityBreakdown easyMode={easyMode} data={data} analysis={projection.engine} /><FinancialDataNotice data={data} /><div className="analysis-summary-columns">{[['Fortalezas', 'positive'], ['Debilidades y advertencias', 'negative']].map(([title, type]) => <article className="analysis-card" key={type}><h3>{title}</h3>{signals.some(s => s.type === type) ? <ul>{signals.filter(s => s.type === type).map(s => <li key={s.id}><a href="#crecimiento" style={{
                color: 'inherit'
              }}>{s.title}</a></li>)}</ul> : <p>No hay señales estructuradas suficientes para señalar {type === 'positive' ? 'fortalezas' : 'debilidades'}. Esto no confirma su ausencia.</p>}</article>)}</div><details className="analysis-card"><summary>Lectura técnica: cinco dimensiones</summary><p>Las dimensiones del análisis técnico se muestran por separado de las tres notas Growth, Value y Quality.</p>{block('resumen')}</details></section>
    <section className="analysis-section" id="crecimiento" aria-labelledby="crecimiento-title"><h2 id="crecimiento-title">Crecimiento</h2><GrowthHistory data={data} />{metrics([1])}{block('crecimiento')}</section>
    <section className="analysis-section" id="calidad" aria-labelledby="calidad-title"><h2 id="calidad-title">Rentabilidad y calidad</h2>{metrics([2, 3, 4])}{block('calidad')}</section>
    <section className="analysis-section" id="valoracion" aria-labelledby="valoracion-title"><h2 id="valoracion-title">Valoración</h2>{metrics([0, 5])}<RangeBar52W data={data} sym={sym} />{block('valoracion')}</section>
    <section className="analysis-section" id="riesgos" aria-labelledby="riesgos-title"><h2 id="riesgos-title">Riesgos</h2>{engine && <p style={{
        fontSize: 13
      }}>{engine.risk.counts.confirmed} confirmados · {engine.risk.counts.potential} posibles · {engine.risk.counts.notEvaluable} no evaluables. Despliega el análisis para revisar endeudamiento, dilución, concentración y volatilidad.</p>}{metrics([6])}{block('riesgos')}</section>
    <section className="analysis-section" id="estados-financieros" aria-labelledby="estados-title"><h2 id="estados-title">Estados financieros</h2><FinancialStatements data={data} />{block('fuentes')}</section>
    <button type="button" disabled={refreshing} onClick={refetch} style={{
      padding: 12,
      border: '1px solid #ECE1C9',
      borderRadius: 12,
      cursor: 'pointer',
      background: '#fff'
    }}>{refreshing ? 'Actualizando…' : '↻ Actualizar datos'}</button>
  </Shell></FinancialEditorProvider>;
}
