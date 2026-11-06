'use client';
// Presentation of the V2 analysis engine (lib/engine): five independent dimensions, five-year
// scenarios, early signals, data quality and sources. Deliberately calm: one summary strip,
// then collapsible blocks that answer "what am I seeing / why does it matter / is it good or
// bad here / what to look at next". Uses the cream/lime palette of the stock page.

import { NEW_COLORS as C, VERDICT_BADGE, TIER_COLORS } from '../../new/theme';
import { formatCurrency } from '../../../../lib/formatters';
import { TIER_LABELS, TIER_NAMES, TIER_DESCRIPTIONS, tierForScore } from '../../../../lib/engine/tierScale';

// lib/engine/quality.js's `components` are keyed by the same names as QUALITY_WEIGHTS — no
// human-readable title attached there (just a score + a detail sentence that already reads fine
// on its own), so the title lives here, UI-side, rather than threaded through the engine.
const QUALITY_COMPONENT_LABEL = {
  returns: 'Rentabilidad (ROIC)', operatingMargin: 'Margen operativo', grossMargin: 'Margen bruto',
  fcfGeneration: 'Generación de caja libre', cashConversion: 'Conversión a caja',
  marginStability: 'Estabilidad de márgenes', balance: 'Balance', reinvestment: 'Reinversión',
  capitalEvolution: 'Evolución del capital',
};
const SIGNAL_DOT_COLOR = { mejora: C.green, empeora: C.red, neutral: C.text3, 'N/D': C.text3 };
const RISK_STATUS_DOT_COLOR = { confirmed: C.red, potential: '#C98A1F', none_detected: C.green, not_evaluable: C.text3 };
const RISK_STATUS_TEXT = { confirmed: 'riesgo confirmado', potential: 'riesgo potencial', none_detected: 'no detectado', not_evaluable: 'no evaluable' };

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px', color: C.ink };
const eyebrow = { fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em' };
const body = { fontSize: '13px', color: '#45413A', lineHeight: 1.6 };

const pct = (v, d = 1) => (v == null ? 'N/D' : `${(v * 100).toFixed(d).replace('.', ',')}%`);
const signed = (v, d = 1) => (v == null ? 'N/D' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d).replace('.', ',')}%`);

// Shared tier-letter card for Calidad/Valoración/Potencial — all three recompute their score
// under alternate weightings (lib/engine/quality.js, valuation.js, potential.js) and widen into
// a range when a different reasonable weighting lands on a different tier, same mechanism in all
// three. A bare "67/100" implied a precision the model doesn't have; the letter (and the range
// when there's one) is the headline instead — the number stays in the data for sorting/filtering
// elsewhere. `tier` is a real tier letter or null (never the engine's own "No concluyente"
// string literal — callers normalize that at the call site).
function TierDimension({ title, tier, range, reasonNull }) {
  if (tier == null) {
    return (
      <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <div style={eyebrow}>{title.toUpperCase()}</div>
        <div style={{ fontSize: '15px', fontWeight: 800, color: C.text3 }}>No concluyente</div>
        <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{reasonNull}</div>
      </div>
    );
  }
  const display = range ? `${range.low}–${range.high}` : tier;
  return (
    <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <div style={eyebrow}>{title.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '30px', height: '30px', padding: '0 6px', borderRadius: '8px', background: TIER_COLORS[tier], color: '#fff', fontSize: '14px', fontWeight: 800, flexShrink: 0 }}>{display}</span>
        {!range && <span style={{ fontSize: '12px', fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{TIER_NAMES[tier]}</span>}
      </div>
      {range && <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>Cambia según cómo se pondere; no lo tomes como una cifra única.</div>}
    </div>
  );
}

// Riesgo's own scale runs the opposite way (higher level = worse), so its tier has no natural
// weight-set range the way the other three do — just the letter, plus the same confirmed/
// posible/no evaluable counts this block already showed before the tier existed.
function RiskDimension({ risk }) {
  return (
    <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={eyebrow}>RIESGO</div>
      {risk.tier == null ? (
        <div style={{ fontSize: '15px', fontWeight: 800, color: C.text3 }}>No concluyente</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '30px', height: '30px', padding: '0 6px', borderRadius: '8px', background: TIER_COLORS[risk.tier], color: '#fff', fontSize: '14px', fontWeight: 800, flexShrink: 0 }}>{risk.tier}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{TIER_NAMES[risk.tier]}</span>
        </div>
      )}
      <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{risk.counts.confirmed} {risk.counts.confirmed === 1 ? 'confirmado' : 'confirmados'}, {risk.counts.potential} {risk.counts.potential === 1 ? 'posible' : 'posibles'}, {risk.counts.notEvaluable} no {risk.counts.notEvaluable === 1 ? 'evaluable' : 'evaluables'}</div>
    </div>
  );
}

// Explainer for the shared tier scale — same letters/names/descriptions everywhere one shows up
// (Calidad, Valoración, Riesgo, Potencial), collapsed by default so it doesn't compete with the
// actual numbers for attention.
function TierLegend() {
  return (
    <details style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '10px' }}>
      <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: C.text2, listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <span>Escala de calificación · Bulltrace</span><span aria-hidden="true" style={{ color: C.text3 }}>+</span>
      </summary>
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[...TIER_LABELS].reverse().map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '30px', height: '30px', padding: '0 6px', borderRadius: '8px', background: TIER_COLORS[t], color: '#fff', fontSize: '14px', fontWeight: 800, flexShrink: 0 }}>{t}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.ink }}>{TIER_NAMES[t]}</div>
              <div style={{ fontSize: '11px', color: C.text2 }}>{TIER_DESCRIPTIONS[t]}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '30px', height: '30px', padding: '0 6px', borderRadius: '8px', background: C.border, color: C.text3, fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>—</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.ink }}>No evaluable</div>
            <div style={{ fontSize: '11px', color: C.text2 }}>No hay datos suficientes para calcular esta nota.</div>
          </div>
        </div>
      </div>
    </details>
  );
}

// Per-metric row with its own 0-100 score (quality components, valuation methods) — a mini bar
// instead of plain "87/100 · texto" stacked lines, same visual language as the tier cards above
// (bar + color from the shared tier ramp). Reused across blocks instead of each one formatting
// its metrics differently.
function MetricBar({ label, score, detail }) {
  const color = score == null ? C.text3 : TIER_COLORS[tierForScore(score)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: C.ink }}>{label}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color }}>{score == null ? 'N/D' : `${score}/100`}</span>
      </div>
      <div aria-hidden="true" style={{ height: '6px', borderRadius: '20px', background: C.borderSoft, overflow: 'hidden' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: color }} />
      </div>
      {detail && <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{detail}</div>}
    </div>
  );
}

// Per-metric row for a categorical (not 0-100) signal — momentum indicators (mejora/empeora/
// neutral) and risk items (confirmed/potential/none_detected/not_evaluable): a colored dot next
// to the label instead of a bar, since there's no score to fill one with.
function MetricDot({ label, dotColor, statusText, detail }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: C.ink }}>{label}</span>
        {statusText && <span style={{ fontSize: '11px', color: C.text2 }}>· {statusText}</span>}
      </div>
      {detail && <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4, marginLeft: '15px' }}>{detail}</div>}
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

export default function EngineV2Panel({ engine, sym = '$', section = 'all' }) {
  if (!engine) return null;
  const { quality, momentum, valuation, risk, potential, signals, validation, explanations } = engine;
  const nonInfo = validation.issues.filter((i) => i.severity !== 'info');
  const infos = validation.issues.filter((i) => i.severity === 'info');
  return (
    <>
      {(section === 'all' || section === 'resumen') && <div style={card}>
        <div>
          <div style={eyebrow}>CINCO PREGUNTAS, CINCO RESPUESTAS SEPARADAS</div>
          <div style={{ fontSize: '12px', color: C.text2, marginTop: '4px' }}>
            {engine.profile.label}. Un negocio excelente puede ser una mala compra a un precio excesivo, y uno mediocre puede estar barato sin que eso garantice nada.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <TierDimension title="Calidad" tier={quality.score != null ? quality.label : null} range={quality.sensitivity?.labelRange} reasonNull={quality.reasonNull} />
          <div style={{ background: C.bg, borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={eyebrow}>CRECIMIENTO</div>
            <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>{momentum.label}</div>
            <div style={{ fontSize: '11px', color: C.text2, lineHeight: 1.4 }}>{momentum.status === 'insufficient' ? momentum.reason : `${momentum.positives} ${momentum.positives === 1 ? 'señal a favor' : 'señales a favor'}, ${momentum.negatives} en contra`}</div>
          </div>
          <TierDimension title="Valoración" tier={valuation.tier} range={valuation.sensitivity?.tierRange} reasonNull={valuation.reasonNull} />
          <RiskDimension risk={risk} />
          <TierDimension title="Potencial" tier={potential.score != null ? potential.label : null} range={potential.sensitivity?.labelRange} reasonNull={potential.reason} />
        </div>
        {potential.pattern && <div style={{ ...body, background: C.bg, borderRadius: '12px', padding: '10px 12px' }}>{potential.pattern.text}</div>}
        {potential.caps?.length > 0 && <div style={{ fontSize: '12px', color: C.text2 }}>{potential.caps.join(' ')}</div>}
        <div style={{ fontSize: '11px', color: C.text3 }}>{potential.notAdvice ?? 'Las puntuaciones no son recomendaciones de compra ni de venta.'}</div>
        <TierLegend />

      </div>}

      {(section === 'all' || section === 'calidad') && <div style={card}>
        <Block block={explanations.quality} defaultOpen={false} extra={quality.score != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(quality.components).map(([k, v]) => (
              <MetricBar key={k} label={QUALITY_COMPONENT_LABEL[k] ?? k} score={v.score} detail={v.detail} />
            ))}
            {quality.notes.length > 0 && (
              <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '4px', borderTop: `1px solid ${C.borderSoft}` }}>
                {quality.notes.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            )}
          </div>
        )} />
      </div>}
      {(section === 'all' || section === 'crecimiento') && <div style={card}>
        <Block block={explanations.momentum} extra={(
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: C.text3 }}>Base de comparación: {momentum.basis}.</div>
            {momentum.indicators.map((i) => (
              <MetricDot key={i.id} label={i.label} dotColor={SIGNAL_DOT_COLOR[i.reading]} statusText={i.reading} />
            ))}
          </div>
        )} />
      </div>}
      {(section === 'all' || section === 'valoracion') && <div style={card}>
        <Block block={explanations.valuation} extra={(
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {valuation.methods.map((m) => (
              <MetricBar key={m.id} label={m.label} score={m.score} detail={`${String(m.value).replace('.', ',')}x · rango orientativo del sector ${m.band.map((b) => String(Math.round(b * 10) / 10).replace('.', ',')).join(' / ')}x`} />
            ))}
            {(valuation.discarded.length > 0 || valuation.historicalValuation.note) && (
              <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '4px', borderTop: `1px solid ${C.borderSoft}` }}>
                {valuation.discarded.length > 0 && <div>No se usan: {valuation.discarded.map((d) => `${d.label} (${d.reason})`).join('; ')}</div>}
                <div>{valuation.historicalValuation.note}</div>
              </div>
            )}
          </div>
        )} />
      </div>}
      {(section === 'all' || section === 'riesgos') && <div style={card}>
        <Block block={explanations.risk} extra={(
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {risk.items.map((i) => (
              <MetricDot key={i.id} label={i.label} dotColor={RISK_STATUS_DOT_COLOR[i.status]} statusText={RISK_STATUS_TEXT[i.status]} detail={i.evidence} />
            ))}
          </div>
        )} />
      </div>}

      {(section === 'all' || section === 'valoracion') && <div style={card}>
        <div style={eyebrow}>A 5 AÑOS VISTA (estimación fundamental, no una promesa)</div>
        <Scenarios engine={engine} sym={sym} />
        <Block block={explanations.scenarios} />
      </div>}

      {(section === 'all' || section === 'crecimiento') && signals.signals.length > 0 && (
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

      {(section === 'all' || section === 'fuentes') && <div style={card}>
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
      </div>}
    </>
  );
}
