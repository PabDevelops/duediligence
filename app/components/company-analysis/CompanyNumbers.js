import { currencySymbol, financialAmount } from '../../../lib/currencyPresentation';
import { getCompanyHeaderScores } from '../../../lib/companyHeaderScores';
import { scoreCoverageDetails } from '../../../lib/scoreCoverageDetails';
import { isTierAdjusted } from '../../../lib/marketCap';
import { formatCurrency } from '../../../lib/formatters';
import { NEW_COLORS as C } from '../new/theme';
import { EditableFinancialValue } from './FinancialEditor';
export const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

// A P/E or P/FCF past this is almost always a near-zero-denominator artifact (a company right
// at breakeven), not a genuinely priced-in premium — shown as "N/D" rather than a four/five
// digit number that reads as a bug. Same threshold the real stock page uses.
const NM_MULTIPLE = 300;

const pct = (v, forceSign = false) => v == null ? null : `${forceSign && v > 0 ? '+' : ''}${v.toFixed(1)}%`;
// A multiple at or below zero (a net loss, or negative free cash flow) isn't "cheap" — it
// isn't a multiple at all — so it's treated the same as unavailable, not shown as a signed number.
const mult = (v) => v == null || v <= 0 ? null : v > NM_MULTIPLE ? 'N/M' : v.toFixed(2);
const money = (v, sym) => v == null ? null : formatCurrency(v, sym);
const days = (v) => v == null ? null : `${v} días`;

// Preserve the existing per-metric colors. Only the three dimension scores below use
// the calibrated policy; these financial statistics retain their original calculations.
const scoreColor = (s) => s == null ? C.ink : s >= 4 ? C.green : s >= 3 ? C.ink : C.red;

export function StatSection({ title, intro, stats }) {
  const visible = stats;
  if (visible.length === 0) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>{title}</h2>
      {intro && <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginBottom: '18px' }}>{intro}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: intro ? 0 : '18px' }}>
        {visible.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', paddingBottom: '14px', borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '3px' }}>{s.label}</div>
              {s.periodNote && <div style={{ fontSize: '11px', color: C.text2 }}>{s.periodNote}</div>}
              <details style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}><summary style={{ cursor: 'pointer' }}>¿Qué significa?</summary>{s.explain}</details>
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, whiteSpace: s.manual||s.editField==='roa'?'normal':'nowrap', flexShrink: s.manual||s.editField==='roa'?1:0, minWidth:0, textAlign:s.manual||s.editField==='roa'?'right':undefined, color: s.color ?? C.ink }}><EditableFinancialValue target={s.editField} label={s.editLabel||s.label} point={s.editPoint}>{s.value ?? 'N/D'}</EditableFinancialValue></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QualityBreakdown({ easyMode, data, analysis }) {
  if (!easyMode) return null;
  const scores = getCompanyHeaderScores(easyMode, data, analysis);
  const dimensionColors = { growth: '#226D3A', value: '#245FA6', quality: '#7440A1' };
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>Growth, Value y Quality</h2>
      <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginBottom: '18px' }}>
        Tres puntuaciones independientes, sin nota global. La ventaja competitiva (moat) se muestra por separado y no se suma.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {scores.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: dimensionColors[p.id], flexShrink: 0 }}>
              {p.tier ?? p.indicative?.tier ?? 'N/D'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{p.name}</div>
              {p.interpretationLabel && <div style={{ fontSize: '12px', fontWeight: 700, color: C.text2 }}>{p.interpretationLabel}</div>}
              {p.indicative && <div style={{ fontSize: '12px', color: C.text2 }}>Orientativa · {Math.round(p.coverage * 100)}% cobertura · confianza baja</div>}
              <details style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}><summary style={{ cursor: 'pointer' }}>Por qué tiene esta nota</summary>{p.indicative ? `${p.indicative.description} ${p.description}` : p.description}</details>
              <details style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Componentes y datos necesarios · {Math.round(p.coverage * 100)}% de cobertura</summary>
                <p>La cobertura mide los componentes disponibles, no su verificación. Los periodos no documentados se indican expresamente. Las entradas manuales mantienen sus advertencias.</p>
                {scoreCoverageDetails(p, data, analysis).map(component => (
                  <div key={component.id} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 0', overflowWrap: 'anywhere' }}>
                    <strong>{component.label}</strong>
                    <div>{component.status} · peso {Math.round(component.weight * 100)}%{component.score != null ? ` · ${Math.round(component.score)}/100` : ''}</div>
                    <div>{component.reason}</div>
                    <div><strong>Periodo:</strong> {component.periodUsed}</div>
                    {component.warnings.map(warning=><div key={warning}><strong>Advertencia:</strong> {warning}</div>)}
                    {component.action && <div style={{ marginTop: '4px' }}><strong>Qué necesitas:</strong> {component.action}</div>}
                    <details style={{ marginTop: '4px' }}><summary>Entradas y periodos disponibles{component.score == null ? ' (no utilizados)' : ''}</summary>
                      {component.inputs.map(input => <div key={input.field}>{input.label}: {input.available ? input.period : 'N/D'}{component.score != null && !input.available ? ' · esta alternativa no se ha utilizado' : ''}</div>)}
                    </details>
                  </div>
                ))}
              </details>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: easyMode.moatColor, flexShrink: 0, textAlign: 'center', padding: '0 2px' }}>
            {easyMode.moat === 'WIDE' ? 'AMPLIO' : easyMode.moat === 'NARROW' ? 'ALGO' : easyMode.moat === 'UNKNOWN' ? 'S/D' : 'NINGUNO'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>MOAT (VENTAJA COMPETITIVA)</div>
            <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>
              {easyMode.moat === 'UNKNOWN'
                ? 'No hay suficientes datos (ROIC ni margen operativo) para saber si esta empresa tiene algo que la proteja de la competencia a largo plazo — no es que se haya comprobado que no la tiene, es que no se puede valorar todavía.'
                : easyMode.moat === 'NONE'
                ? 'Con los datos disponibles (ROIC y margen operativo), no se detecta algo que la proteja claramente de la competencia a largo plazo: marca fuerte, costes más bajos, efecto red...'
                : 'Si tiene algo que la protege de la competencia a largo plazo: marca fuerte, costes más bajos, efecto red...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RangeBar52W({ data, sym }) {
  if (!data.high52 || !data.low52 || !data.currentPrice) return null;
  const rangePct = Math.max(0, Math.min(100, ((data.currentPrice - data.low52) / (data.high52 - data.low52)) * 100));
  const color = rangePct < 30 ? C.green : rangePct > 75 ? C.red : C.ink;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>Rango de 52 semanas</h2>
      <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginBottom: '18px' }}>
        Dónde está el precio de hoy comparado con su punto más bajo y más alto del último año.
      </div>
      <div style={{ position: 'relative', height: '6px', background: C.borderSoft, borderRadius: '4px', marginBottom: '8px' }}>
        <div style={{ position: 'absolute', left: `${rangePct}%`, top: '-4px', width: '3px', height: '14px', background: color, borderRadius: '2px', transform: 'translateX(-1.5px)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.text2 }}>
        <span>{formatCurrency(data.low52, sym)} · mínimo</span>
        <span style={{ fontWeight: 700, color }}>
          {rangePct < 30 ? 'Cerca del mínimo' : rangePct > 75 ? 'Cerca del máximo' : 'En medio del rango'}
        </span>
        <span>{formatCurrency(data.high52, sym)} · máximo</span>
      </div>
    </div>
  );
}

export function numberSections(data, easyMode, ticker, sym, analysis) {
  const accounting = field => {
    const amount = financialAmount(data[field], data.financialPeriods?.[field] || data.financialIntegrity?.fields?.[field]?.period, data);
    return amount.value == null ? null : formatCurrency(amount.value, currencySymbol(amount.currency));
  };
  const annualCash=analysis?.valuation?.cashFlowBasis?.status==='matched'?analysis.valuation.cashFlowBasis:null;
  const truePfcf = annualCash ? analysis.valuation.multiples?.pfcf : easyMode?.truePfcf ?? data.pfcf;
  const trueFcfYield = annualCash ? analysis.valuation.multiples?.fcfYield==null?null:analysis.valuation.multiples.fcfYield*100 : easyMode?.trueFcfYield ?? data.fcfYield;
  const cashPeriodNote=annualCash?`${annualCash.basis} · ${annualCash.periodStart.split('-').reverse().join('/')}–${annualCash.periodEnd.split('-').reverse().join('/')} · ${annualCash.currency} · después de SBC`:null;
  const cashPoint=annualCash?(data.fcfHistory||[]).find(p=>p.periodStart===annualCash.periodStart&&p.periodEnd===annualCash.periodEnd&&p.basis===annualCash.basis):null;
  const currentRatio = data.currentAssetsVal && data.currentLiabilitiesVal ? data.currentAssetsVal / data.currentLiabilitiesVal : null;
  const capitalDiscipline = isTierAdjusted(easyMode?.capTier?.id);
  const cashRunway = data.fcfVal != null && data.fcfVal >= 0 ? 'No quema caja' : easyMode?.cashRunwayYears != null ? `${easyMode.cashRunwayYears.toFixed(1)} años` : null;
  // Just the signed money value — it used to carry a trailing "· tiene más caja que deuda"
  // clause baked into the bold, nowrap stat value itself, which on a negative (net-cash)
  // company overflowed its column and visually collided with the label next to it. That
  // distinction now lives in the explain line below (always shown) and the green/red color
  // (via deScore), not crammed into the number.
  const debtAmount = financialAmount(data.debtVal, data.financialPeriods?.debtVal, data);
  const cashAmount = financialAmount(data.cashVal, data.financialPeriods?.cashVal, data);
  const converted = data.financialPeriods?.debtVal?.fxRate || data.financialPeriods?.cashVal?.fxRate;
  const netDebtValue = data.netDebt == null ? null
    : converted ? debtAmount.value != null && cashAmount.value != null && debtAmount.currency === cashAmount.currency
      ? formatCurrency(debtAmount.value - cashAmount.value, currencySymbol(debtAmount.currency)) : null
    : (data.netDebt < 0 ? '-' : '') + formatCurrency(Math.abs(data.netDebt), sym);

  const sections = [
    {
      title: 'Valoración — ¿está cara o barata?',
      intro: 'Compara lo que pagas por la acción con lo que el negocio realmente gana o genera en caja.',
      stats: [
        { label: 'Capitalización bursátil', value: money(data.marketCap, sym), periodNote:data.shareClassEvidence&&data.sharesOutstanding===data.shareClassEvidence.total?`Incluye ordinarias con y sin voto · acciones declaradas a ${data.shareClassEvidence.asOf.split('-').reverse().join('/')}`:null, explain: 'Lo que vale la empresa entera en bolsa: precio de la acción × número de acciones.'+(data.shareClassEvidence&&data.sharesOutstanding===data.shareClassEvidence.total?` ${data.shareClassEvidence.priceAssumption}`:'') },
        { label: 'P/E — precio / beneficio', value: mult(data.pe), explain: 'Cuántas veces el beneficio anual actual estás pagando por la acción. No es un "plazo para recuperar la inversión" — ignora cómo cambiarán el crecimiento y los márgenes, así que solo tiene sentido comparado con empresas similares o con su propio historial.' },
        { label: 'P/FCF — precio / caja libre', value: mult(truePfcf), explain: 'Como el P/E, pero con el dinero que realmente genera el negocio (caja libre) en vez del beneficio contable — menos fácil de maquillar con decisiones contables.', color: scoreColor(easyMode?.pfcfScore) },
        { label: 'EV/EBITDA', value: data.evEbitda != null ? data.evEbitda.toFixed(2) : null, explain: 'El valor de la empresa, incluida su deuda, comparado con su beneficio operativo bruto. Útil para comparar empresas con distinta deuda, pero puede salir engañosamente bajo en negocios que necesitan invertir mucho en maquinaria o infraestructura cada año.' },
        { label: 'P/B — precio / valor contable', value: data.priceToBook != null ? data.priceToBook.toFixed(2) : null, explain: 'Cuánto pagas por cada euro de patrimonio neto que tiene la empresa en el balance. Pierde utilidad en negocios cuyo valor real está en marca, patentes o software — activos que el balance no recoge bien.' },
        { label: 'Rentabilidad por FCF', value: pct(trueFcfYield), explain: 'El reverso del P/FCF: cuánta caja libre genera la empresa cada año por cada euro que vale en bolsa.', color: scoreColor(easyMode?.fcfYieldScore) },
        { label: 'Rentabilidad por dividendo', value: data.dividendYield ? pct(+data.dividendYield) : null, explain: 'Cuánto te paga en dividendos al año por cada euro invertido, al precio de hoy.' },
      ],
    },
    {
      title: 'Crecimiento — ¿va a más o a menos?',
      intro: 'Cómo ha evolucionado el negocio, y cuánto reinvierte para seguir creciendo.',
      stats: [
        { label: 'Ingresos (interanual)', value: pct(data.revGrowth, true), explain: 'Cuánto han crecido — o caído — las ventas respecto al año pasado.', color: scoreColor(easyMode?.revGrowthScore) },
        { label: 'Beneficio por acción, crecimiento medio', value: pct(data.epsCagr, true), explain: 'El ritmo medio al que ha crecido el beneficio por acción en los últimos años.' },
        { label: 'I+D sobre ingresos', value: easyMode?.rdToRevenue != null ? pct(easyMode.rdToRevenue * 100) : null, explain: 'Qué parte de cada euro de ventas se reinvierte en investigación y desarrollo — más alto puede significar más innovación futura, pero menos beneficio hoy.' },
        { label: 'Pago en acciones sobre ingresos', value: easyMode?.sbcToRevenue != null ? pct(easyMode.sbcToRevenue * 100) : null, explain: 'Qué parte de los ingresos se destina a pagar a empleados con acciones en vez de dinero — demasiado alto diluye a los accionistas actuales.' },
      ],
    },
    {
      title: 'Rentabilidad — ¿gana dinero de verdad?',
      intro: 'De cada euro que entra, cuánto se queda la empresa en cada etapa — y qué devuelve por lo invertido.',
      stats: [
        { label: 'Margen bruto', value: pct(data.grossMargin), explain: 'De cada euro vendido, lo que queda tras pagar solo el coste directo de producir o comprar lo que vende.', color: scoreColor(easyMode?.gmScore) },
        { label: 'Margen operativo', value: pct(data.opMargin), explain: 'De cada euro vendido, lo que queda tras pagar también los gastos de operar el negocio día a día.', color: scoreColor(easyMode?.omScore) },
        { label: 'Margen neto', value: pct(data.netMargin), explain: 'De cada euro vendido, lo que llega al beneficio final, después de todos los gastos e impuestos.' },
        { label: 'ROE — retorno sobre el capital', value: pct(data.roe), explain: 'Cuánto beneficio genera la empresa por cada euro que han puesto los accionistas.' },
        { label: 'ROA — retorno sobre activos', value: pct(data.roa), explain: 'Cuánto beneficio genera la empresa por cada euro de activos que posee: edificios, maquinaria, caja...' },
        { label: 'ROIC — retorno sobre el capital invertido', value: pct(data.roic), explain: 'Cuánto beneficio genera por cada euro invertido en el negocio, venga de accionistas o de deuda. La métrica favorita de muchos inversores para juzgar si un negocio es realmente bueno.', color: scoreColor(easyMode?.roicScore) },
      ],
    },
    {
      title: 'Balance y salud financiera — ¿aguantaría una mala racha?',
      intro: 'Lo que la empresa tiene, lo que debe, y si podría pagar sus facturas a corto plazo.',
      stats: [
        { label: 'Activos totales', value: accounting('assetsVal'), explain: 'Todo lo que posee la empresa: caja, inventario, edificios, maquinaria...' },
        { label: 'Pasivos totales', value: accounting('totalLiabilitiesVal'), explain: 'Todo lo que debe la empresa a terceros: deuda, proveedores, impuestos pendientes...' },
        { label: 'Patrimonio neto', value: accounting('equityVal'), explain: 'Lo que quedaría para los accionistas si la empresa vendiera todo y pagara todas sus deudas.' },
        { label: 'Deuda neta', value: netDebtValue, explain: 'La deuda de la empresa menos el dinero en caja. Negativa significa que tiene más caja que deuda — una posición cómoda.', color: scoreColor(easyMode?.deScore) },
        { label: 'Caja disponible', value: accounting('cashVal'), explain: 'Dinero en efectivo e inversiones a corto plazo que la empresa tiene disponible ya mismo.' },
        { label: 'Deuda a largo plazo', value: accounting('debtVal'), explain: 'Préstamos y bonos que la empresa debe devolver a más de un año vista.' },
        { label: 'Deuda / capital (D/E)', value: data.debtToEquity != null ? data.debtToEquity.toFixed(2) : null, explain: 'Cuánta deuda tiene la empresa comparada con el dinero de los accionistas. Más alto significa más riesgo.', color: scoreColor(easyMode?.deScore) },
        { label: 'Ratio corriente', value: currentRatio != null ? currentRatio.toFixed(2) : null, explain: 'Si la empresa podría pagar sus deudas a corto plazo solo con lo que tiene a mano. Por encima de 1 es buena señal.', color: scoreColor(easyMode?.crScore) },
      ],
    },
    {
      title: 'Eficiencia operativa — ¿gestiona bien el día a día?',
      intro: 'Cuánto tarda en cobrar, vender su inventario y pagar a sus proveedores.',
      stats: [
        { label: 'Ciclo de conversión de caja', value: days(data.ccc), explain: 'Cuántos días tarda la empresa en convertir lo que gasta en producir o comprar en dinero cobrado de sus clientes. Menos días es mejor.' },
        { label: 'Rotación de inventario', value: data.inventoryTurnover != null ? `${data.inventoryTurnover.toFixed(1)}× / año` : null, explain: 'Cuántas veces al año la empresa vende y repone todo su inventario. Más alto suele ser más eficiente.' },
        { label: 'Días de cobro (DSO)', value: days(data.dso), explain: 'Cuántos días tarda de media en cobrar a sus clientes después de vender.' },
        { label: 'Días de inventario (DIO)', value: days(data.dio), explain: 'Cuántos días de media está el producto parado en el almacén antes de venderse.' },
        { label: 'Días de pago (DPO)', value: days(data.dpo), explain: 'Cuántos días tarda de media la empresa en pagar a sus propios proveedores.' },
      ],
    },
    {
      title: 'Por acción y mercado',
      intro: 'Lo que le toca a cada acción individual, y cómo se mueve en bolsa.',
      stats: [
        { label: 'Beneficio por acción (BPA)', value: accounting('eps'), explain: 'El beneficio total dividido entre el número de acciones — lo que "gana" cada acción individual.' },
        { label: 'Acciones en circulación', value: data.sharesOutstanding != null ? `${(data.sharesOutstanding / 1e6).toFixed(0)} millones` : null, explain: 'El número total de acciones que existen de esta empresa, repartidas entre todos sus dueños.' },
        { label: 'Beta', value: data.beta != null ? data.beta.toFixed(2) : null, explain: 'Cuánto se mueve la acción comparada con el mercado en general. Por encima de 1 significa que suele moverse más fuerte, para bien y para mal.' },
      ],
    },
  ];

  if (capitalDiscipline) {
    sections.push({
      title: 'Disciplina de capital — empresas pequeñas',
      intro: `${data.name || ticker} es una empresa de capitalización ${easyMode.capTier.label.toLowerCase()} — aquí es donde más importa vigilar si diluye a sus accionistas o se queda sin caja.`,
      stats: [
        { label: 'Dilución histórica', value: easyMode.shareDilution != null ? pct(easyMode.shareDilution, true) : null, explain: 'Cuánto ha aumentado el número de acciones en circulación con el tiempo. Más dilución significa que tu parte de la empresa se hace más pequeña aunque no vendas nada.' },
        { label: 'Colchón de caja', value: cashRunway, explain: 'Si la empresa quema caja, cuántos años le quedan antes de quedarse sin dinero al ritmo actual.' },
        { label: 'Participación de insiders', value: easyMode.insiderOwnershipPct != null ? pct(easyMode.insiderOwnershipPct) : null, explain: 'Qué porcentaje de la empresa es propiedad de sus propios directivos y fundadores. Más alto suele alinear sus intereses con los tuyos.' },
      ],
    });
  }

  const editFields={
    'Capitalización bursátil':'sharesOutstanding','P/E — precio / beneficio':'pe','P/FCF — precio / caja libre':'fcfVal',
    'EV/EBITDA':'evEbitda','P/B — precio / valor contable':'priceToBook','Rentabilidad por FCF':'fcfVal','Rentabilidad por dividendo':'dividendYield',
    'Ingresos (interanual)':'revGrowth','Beneficio por acción, crecimiento medio':'epsCagr','I+D sobre ingresos':'rdVal','Pago en acciones sobre ingresos':'sbcVal',
    'Margen bruto':'grossMargin','Margen operativo':'opMargin','Margen neto':'netMargin','ROE — retorno sobre el capital':'roe','ROA — retorno sobre activos':'roa','ROIC — retorno sobre el capital invertido':'roic',
    'Activos totales':'assetsVal','Pasivos totales':'totalLiabilitiesVal','Patrimonio neto':'equityVal','Deuda neta':'debtVal','Caja disponible':'cashVal','Deuda a largo plazo':'debtVal','Deuda / capital (D/E)':'debtToEquity','Ratio corriente':'currentAssetsVal',
    'Ciclo de conversión de caja':'ccc','Rotación de inventario':'inventoryTurnover','Días de cobro (DSO)':'dso','Días de inventario (DIO)':'dio','Días de pago (DPO)':'dpo',
    'Beneficio por acción (BPA)':'eps','Acciones en circulación':'sharesOutstanding','Beta':'beta','Colchón de caja':'cashVal','Participación de insiders':'insiderOwnershipPct',
    'Dilución histórica':data.sharesHistory?.at(-1)?.year?`history:sharesHistory:${data.sharesHistory.at(-1).year}`:null,
  };
  const labels={rdVal:'I+D (importe contable)',sbcVal:'Remuneración en acciones (importe contable)',fcfVal:'Flujo de caja libre (importe contable)',currentAssetsVal:'Activos corrientes (base del ratio)',debtVal:'Deuda (base del cálculo)',sharesOutstanding:'Acciones en circulación'};
  return sections.map(section=>({...section,stats:section.stats.map(stat=>{
    const cashStat=['P/FCF — precio / caja libre','Rentabilidad por FCF'].includes(stat.label);
    const target=cashStat&&cashPoint?.year?`history:fcfHistory:${cashPoint.year}`:editFields[stat.label];
    return {...stat,editField:target,manual:data.manualCorrections?.some(r=>r.target===target),editLabel:labels[editFields[stat.label]],editPoint:cashStat?cashPoint:stat.label==='Dilución histórica'?data.sharesHistory?.at(-1):undefined,periodNote:cashStat?cashPeriodNote:null};
  })}));
}
