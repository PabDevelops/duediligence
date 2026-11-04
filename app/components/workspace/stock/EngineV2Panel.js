'use client';
// Presentation of the V2 analysis engine (lib/engine): five independent dimensions, five-year
// scenarios, early signals, data quality and sources. Deliberately calm: one summary strip,
// then collapsible blocks that answer "what am I seeing / why does it matter / is it good or
// bad here / what to look at next". Uses the cream/lime palette of the stock page.

import { NEW_COLORS as C, VERDICT_BADGE } from '../../new/theme';
import { formatCurrency } from '../../../../lib/formatters';

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px', color: C.ink };
const eyebrow = { fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em' };
const body = { fontSize: '13px', color: '#45413A', lineHeight: 1.6 };

const pct = (v, d = 1) => (v == null ? 'N/D' : `${(v * 100).toFixed(d).replace('.', ',')}%`);
const signed = (v, d = 1) => (v == null ? 'N/D' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d).replace('.', ',')}%`);

function tierFor(score, invert = false) {
  if (score == null) return null;
  const s = invert ? 100 - score : score;
  return s >= 65 ? 'good' : s >= 40 ? 'caution' : 'bad';
}

function Dimension({ title, score, label, note, invert }) {
  const tier = tierFor(score, invert);
  const color = tier ? VERDICT_BADGE[tier].dot : C.border;
  return (
    <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <div style={eyebrow}>{title.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '20px', fontWeight: 800, color: score == null ? C.text3 : C.ink }}>{score == null ? 'N/D' : score}</span>
        {score != null && <span style={{ fontSize: '11px', color: C.text3 }}>/100</span>}
      </div>
      <div aria-hidden="true" style={{ height: '6px', borderRadius: '20px', background: C.borderSoft, overflow: 'hidden' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: color }} />
      </div>
      <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{label}</div>
      {note && <div style={{ fontSize: '10px', color: C.text3, lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}

// Potencial shows the word (and a range when a different reasonable weighting lands on a
// different word) instead of the bare 0-100 number: "67" implies a precision the model doesn't
// have — potential.sensitivity already proves that by recomputing the score under 4 weight sets,
// it just wasn't shown. The number stays in the data (still usable to sort/filter stocks
// elsewhere), it just isn't the headline here.
function rangeText(range) {
  return `${range.low} a ${range.high.replace(/^Potencial /, '')}`;
}

function PotentialDimension({ potential }) {
  const text = potential.score == null ? 'No concluyente' : potential.sensitivity?.labelRange ? rangeText(potential.sensitivity.labelRange) : potential.label;
  return (
    <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <div style={eyebrow}>POTENCIAL</div>
      <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>{text}</div>
      {potential.score == null
        ? <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{potential.reason}</div>
        : potential.sensitivity?.labelRange && <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>Cambia según cómo se pondere; no lo tomes como una cifra única.</div>}
    </div>
  );
}

function Block({ block, extra, defaultOpen }) {
  return (
    <details open={defaultOpen} style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '10px' }}>
      <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 800, listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <span>{block.title}</span><span aria-hidden="true" style={{ color: C.text3 }}>+</span>
      </summary>
      <div style={{ ...body, display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
        <div><div style={eyebrow}>QUÉ ESTOY VIENDO</div>{block.que}</div>
        <div><div style={eyebrow}>POR QUÉ IMPORTA</div>{block.porQue}</div>
        <div><div style={eyebrow}>¿ES BUENO O MALO AQUÍ?</div>{block.bueno}</div>
        <div>
          <div style={eyebrow}>QUÉ INVESTIGAR DESPUÉS</div>
          <ul style={{ margin: '4px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {block.investigar.filter(Boolean).map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
        {extra}
      </div>
    </details>
  );
}

function Scenarios({ engine, sym }) {
  const s = engine.scenarios;
  if (s.status !== 'ok') {
    return (
      <div style={{ ...body, background: C.bg, borderRadius: '12px', padding: '12px 14px' }}>
        <strong>Sin escenarios a cinco años.</strong> {s.reason}
        {s.requiredConditions && <div style={{ marginTop: '8px' }}>{s.requiredConditions.text}</div>}
      </div>
    );
  }
  const price = engine.price;
  const c = s.scenarios.find((x) => x.key === 'central');
  const isBank = s.model === 'bank_justified_pb';
  const mos = c.marginOfSafety;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '12px', color: C.text2 }}>Método: <strong>{s.modelLabel}</strong>. {s.notProbabilities}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <div>
          <div style={eyebrow}>PRECIO ACTUAL</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatCurrency(price, sym)}</div>
        </div>
        <div>
          <div style={eyebrow}>VALOR RAZONABLE HOY (CENTRAL)</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{c.fairValueToday != null ? formatCurrency(c.fairValueToday, sym) : 'N/D'}</div>
          <div style={{ fontSize: '11px', color: C.text3 }}>lo que valdría hoy según el escenario central</div>
        </div>
        <div>
          <div style={eyebrow}>MARGEN DE SEGURIDAD</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: mos == null ? C.ink : mos >= 0 ? C.green : C.red }}>{mos == null ? 'N/D' : signed(mos, 0)}</div>
          <div style={{ fontSize: '11px', color: C.text3 }}>{mos == null ? 'sin valor razonable disponible' : mos >= 0 ? 'el precio está por debajo del valor razonable estimado' : 'el precio está por encima del valor razonable estimado'}</div>
        </div>
        <div>
          <div style={eyebrow}>PRECIO MÁXIMO DE ENTRADA</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{c.maxEntryPrice != null ? formatCurrency(c.maxEntryPrice, sym) : 'N/D'}</div>
          <div style={{ fontSize: '11px', color: C.text3 }}>para exigir un {pct(s.requiredReturn, 0)} anual (referencia ajustable, no una garantía)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        {s.scenarios.map((sc) => (
          <div key={sc.key} style={{ border: `1px solid ${sc.key === 'central' ? C.ink : C.border}`, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: C.text2 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: C.ink }}>{sc.label}</div>
            {isBank ? (
              <>
                <div>ROE sostenido: {pct(sc.assumptions.roeYear5)}</div>
                <div>Coste del capital: {pct(sc.assumptions.costOfEquity)}</div>
                <div>P/valor contable justificado: {sc.justifiedPriceToBook}x</div>
              </>
            ) : (
              <>
                <div>Crecimiento de ingresos: {pct(sc.assumptions.growthYear1)} el año 1, {pct(sc.assumptions.growthYear5)} el año 5</div>
                <div>Margen operativo año 5: {pct(sc.assumptions.marginYear5)}</div>
                <div>{sc.assumptions.exitMultiple != null ? `Múltiplo terminal: ${sc.assumptions.exitMultiple}x EBIT` : `Tasa de descuento: ${pct(sc.assumptions.discountRate)} · crecimiento final ${pct(sc.assumptions.terminalGrowth)}`}</div>
                <div>Acciones año 5: {(sc.sharesYear5 / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 0 })} M</div>
              </>
            )}
            <div style={{ marginTop: '4px', color: C.ink }}>Valor por acción en 5 años: <strong>{sc.valueYear5 != null ? formatCurrency(sc.valueYear5, sym) : 'N/D'}</strong></div>
            <div style={{ color: sc.cagr == null ? C.ink : sc.cagr >= 0 ? C.green : C.red, fontWeight: 700 }}>Rentabilidad anual desde hoy: {signed(sc.cagr)}</div>
          </div>
        ))}
      </div>

      <ul style={{ ...body, margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {s.conditions.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
      {s.warnings.length > 0 && (
        <div style={{ fontSize: '12px', color: '#8A5E12', background: VERDICT_BADGE.caution.bg, borderRadius: '12px', padding: '10px 12px', lineHeight: 1.5 }}>
          {s.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      {s.sensitivity?.verySensitive && (
        <div style={{ fontSize: '12px', color: C.text2 }}>Sensibilidad: el valor futuro varía un {pct(s.sensitivity.spreadGrowthMargin, 0)} del central al mover crecimiento y margen ±3 puntos.</div>
      )}
      <div style={{ fontSize: '11px', color: C.text3, lineHeight: 1.5 }}>
        Estimaciones, no hechos. El valor razonable y el valor futuro salen del negocio (ingresos, márgenes, reinversión, deuda neta y acciones), no de la evolución pasada de la cotización ni de los objetivos de los analistas.
      </div>
    </div>
  );
}

export default function EngineV2Panel({ engine, sym = '$' }) {
  if (!engine) return null;
  const { quality, momentum, valuation, risk, potential, signals, validation, explanations } = engine;
  const nonInfo = validation.issues.filter((i) => i.severity !== 'info');
  const infos = validation.issues.filter((i) => i.severity === 'info');
  const momentumScore = null;
  return (
    <>
      <div style={card}>
        <div>
          <div style={eyebrow}>CINCO PREGUNTAS, CINCO RESPUESTAS SEPARADAS</div>
          <div style={{ fontSize: '12px', color: C.text2, marginTop: '4px' }}>
            {engine.profile.label}. Un negocio excelente puede ser una mala compra a un precio excesivo, y uno mediocre puede estar barato sin que eso garantice nada.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <Dimension title="Calidad" score={quality.score} label={quality.score == null ? 'No concluyente' : 'Del negocio, sin mirar el precio'} note={quality.score == null ? quality.reasonNull : null} />
          <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={eyebrow}>CRECIMIENTO</div>
            <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>{momentum.label}</div>
            <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{momentum.status === 'insufficient' ? momentum.reason : `${momentum.positives} ${momentum.positives === 1 ? 'señal a favor' : 'señales a favor'}, ${momentum.negatives} en contra`}</div>
          </div>
          <Dimension title="Valoración" score={valuation.score} label={valuation.label} note={valuation.score == null ? valuation.reasonNull : (valuation.confidence === 'baja' ? 'Confianza baja: pocos métodos aplicables' : null)} />
          <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={eyebrow}>RIESGO</div>
            <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>{risk.label}</div>
            <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{risk.counts.confirmed} {risk.counts.confirmed === 1 ? 'confirmado' : 'confirmados'}, {risk.counts.potential} {risk.counts.potential === 1 ? 'posible' : 'posibles'}, {risk.counts.notEvaluable} no {risk.counts.notEvaluable === 1 ? 'evaluable' : 'evaluables'}</div>
          </div>
          <PotentialDimension potential={potential} />
        </div>
        {potential.pattern && <div style={{ ...body, background: C.bg, borderRadius: '12px', padding: '10px 12px' }}>{potential.pattern.text}</div>}
        {potential.caps?.length > 0 && <div style={{ fontSize: '12px', color: C.text2 }}>{potential.caps.join(' ')}</div>}
        <div style={{ fontSize: '11px', color: C.text3 }}>{potential.notAdvice ?? 'Las puntuaciones no son recomendaciones de compra ni de venta.'}</div>

        <Block block={explanations.quality} defaultOpen={false} extra={quality.score != null && (
          <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {Object.entries(quality.components).map(([k, v]) => <div key={k}>{v.score}/100 · {v.detail}</div>)}
            {quality.notes.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        )} />
        <Block block={explanations.momentum} extra={(
          <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>Base de comparación: {momentum.basis}.</div>
            {momentum.indicators.map((i) => <div key={i.id}>{i.label}: {i.reading}</div>)}
          </div>
        )} />
        <Block block={explanations.valuation} extra={(
          <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {valuation.methods.map((m) => <div key={m.id}>{m.label}: {String(m.value).replace('.', ',')}x · rango orientativo del sector {m.band.map((b) => String(Math.round(b * 10) / 10).replace('.', ',')).join(' / ')}x</div>)}
            {valuation.discarded.length > 0 && <div>No se usan: {valuation.discarded.map((d) => `${d.label} (${d.reason})`).join('; ')}</div>}
            <div>{valuation.historicalValuation.note}</div>
          </div>
        )} />
        <Block block={explanations.risk} extra={(
          <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {risk.items.map((i) => <div key={i.id}><strong>{i.label}:</strong> {{ confirmed: 'riesgo confirmado', potential: 'riesgo potencial', none_detected: 'no detectado', not_evaluable: 'no evaluable' }[i.status]}. {i.evidence}</div>)}
          </div>
        )} />
      </div>

      <div style={card}>
        <div style={eyebrow}>A 5 AÑOS VISTA (estimación fundamental, no una promesa)</div>
        <Scenarios engine={engine} sym={sym} />
        <Block block={explanations.scenarios} />
      </div>

      {signals.signals.length > 0 && (
        <div style={card}>
          <div style={eyebrow}>SEÑALES FUNDAMENTALES RECIENTES</div>
          <div style={{ fontSize: '12px', color: C.text2 }}>{signals.note}</div>
          {signals.signals.map((s) => (
            <details key={s.id} style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 700, listStyle: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.type === 'positive' ? C.green : C.red, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{s.title}</span>
                <span style={{ fontSize: '11px', color: C.text3, fontWeight: 600 }}>confianza {s.confidence}</span>
              </summary>
              <div style={{ ...body, fontSize: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>Dato:</strong> {s.value} ({s.period})</div>
                <div><strong>Comparación:</strong> {s.comparison}</div>
                <div><strong>Lectura:</strong> {s.interpretation}</div>
                <div><strong>Lo confirmaría:</strong> {s.confirms}</div>
                <div><strong>Lo invalidaría:</strong> {s.invalidates}</div>
                <div style={{ color: C.text3 }}>Fuente: {s.source}</div>
              </div>
            </details>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={eyebrow}>FUENTES Y CALIDAD DE LOS DATOS</div>
        <div style={{ ...body, fontSize: '12px' }}>
          {engine.sources.financials}. {engine.sources.periodNote} {engine.sources.benchmarkNote}
          {engine.sources.lastFilingDate ? ` Último informe publicado: ${engine.sources.lastFilingDate}.` : ' La fecha de publicación del último informe no está disponible.'}
        </div>
        {nonInfo.length > 0 && (
          <ul style={{ ...body, fontSize: '12px', margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {nonInfo.map((i) => <li key={i.code} style={{ color: i.severity === 'error' ? C.red : '#8A5E12' }}>{i.message}</li>)}
          </ul>
        )}
        {infos.length > 0 && (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '12px', color: C.text2, fontWeight: 700 }}>{infos.length} notas informativas sobre los datos</summary>
            <ul style={{ ...body, fontSize: '12px', margin: '6px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {infos.map((i) => <li key={i.code}>{i.message}</li>)}
            </ul>
          </details>
        )}
        <div style={{ fontSize: '11px', color: C.text3 }}>{engine.disclaimer}</div>
      </div>
    </>
  );
}
