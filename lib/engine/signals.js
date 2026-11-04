// Fundamental early signals: structured data only. Press headlines are never evidence here.
// Every signal carries the figure, period, source, comparison, reading, confidence and what
// would confirm or invalidate it. When the data for an indicator does not exist, the signal
// is NOT generated (nothing is invented).

import { isNum, fmtMoney } from './util.js';

const SRC_Y = 'Estados financieros anuales (SEC EDGAR / Yahoo Finance)';
const SRC_Q = 'Estados financieros trimestrales (SEC EDGAR / Yahoo Finance)';

function conf(consecutive) { return consecutive >= 3 ? 'alta' : consecutive === 2 ? 'media' : 'baja'; }

function streak(snaps, pred) {
  let n = 0;
  for (let i = snaps.length - 1; i >= 0; i--) { if (pred(snaps[i], snaps[i - 1])) n++; else break; }
  return n;
}

export function computeSignals(inp, momentum) {
  const out = [];
  const snaps = momentum.snapshots || [];
  const src = momentum.basis?.startsWith('trimestral') ? SRC_Q : SRC_Y;
  const last = snaps[snaps.length - 1];
  const prev = snaps[snaps.length - 2];
  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  if (last && prev && isNum(last.revYoY) && isNum(prev.revYoY)) {
    if (prev.revYoY < 0 && last.revYoY > prev.revYoY + 0.02) {
      const n = streak(snaps, (s, p) => p && isNum(s.revYoY) && isNum(p.revYoY) && s.revYoY > p.revYoY);
      out.push({ id: 'early_recovery', type: 'positive', title: 'Primeros indicios de recuperación', value: `ingresos ${pct(prev.revYoY)} → ${pct(last.revYoY)}`, period: `${prev.period} a ${last.period}`, source: src, comparison: `La caída de ingresos se ha reducido ${((last.revYoY - prev.revYoY) * 100).toFixed(1)} puntos frente al periodo anterior.`, interpretation: 'La caída se modera, aún no es crecimiento. Un solo periodo no confirma un cambio de tendencia.', confidence: conf(n), confirms: 'Dos o más periodos seguidos con mejor crecimiento y margen estable o al alza.', invalidates: 'Que el siguiente periodo vuelva a empeorar o que la mejora venga solo de una comparación fácil.' });
    }
    if (last.revYoY > 0 && last.revYoY - prev.revYoY >= 0.03) {
      const n = streak(snaps, (s, p) => p && isNum(s.revYoY) && isNum(p.revYoY) && s.revYoY - p.revYoY > 0.01);
      out.push({ id: 'growth_acceleration', type: 'positive', title: 'Aceleración del crecimiento', value: `ingresos ${pct(prev.revYoY)} → ${pct(last.revYoY)}`, period: `${prev.period} a ${last.period}`, source: src, comparison: `El crecimiento sube ${((last.revYoY - prev.revYoY) * 100).toFixed(1)} puntos.`, interpretation: 'El negocio crece más deprisa que en el periodo anterior.', confidence: conf(n), confirms: 'Otro periodo con crecimiento igual o superior sin que el margen se resienta.', invalidates: 'Que el crecimiento vuelva por debajo del periodo anterior, o que proceda de adquisiciones y no de ventas propias.' });
    }
    if (last.revYoY > 0 && prev.revYoY > 0 && last.revYoY - prev.revYoY <= -0.04) {
      out.push({ id: 'growth_deceleration', type: 'negative', title: 'Desaceleración del crecimiento', value: `ingresos ${pct(prev.revYoY)} → ${pct(last.revYoY)}`, period: `${prev.period} a ${last.period}`, source: src, comparison: `El crecimiento baja ${Math.abs((last.revYoY - prev.revYoY) * 100).toFixed(1)} puntos.`, interpretation: 'Sigue creciendo pero a menor ritmo; importa si el precio asume que mantendrá el ritmo anterior.', confidence: conf(1), confirms: 'Otro periodo con menor crecimiento.', invalidates: 'Una recuperación del ritmo en el siguiente periodo.' });
    }
  }
  if (last && isNum(last.marginDelta)) {
    if (last.marginDelta >= 0.01) {
      const n = streak(snaps, (s) => isNum(s.marginDelta) && s.marginDelta > 0.005);
      out.push({ id: 'margin_expansion', type: 'positive', title: 'Expansión de márgenes', value: `margen operativo ${(last.marginDelta * 100 >= 0 ? '+' : '')}${(last.marginDelta * 100).toFixed(1)} puntos`, period: last.period, source: src, comparison: 'Frente al mismo periodo del año anterior.', interpretation: 'Gana más por cada euro vendido.', confidence: conf(n), confirms: 'Que se mantenga en los siguientes periodos sin recortar inversión clave.', invalidates: 'Que el margen vuelva a caer o que la mejora sea por un ingreso extraordinario.' });
    } else if (last.marginDelta <= -0.01) {
      const n = streak(snaps, (s) => isNum(s.marginDelta) && s.marginDelta < -0.005);
      out.push({ id: 'margin_compression', type: 'negative', title: 'Deterioro de márgenes', value: `margen operativo ${(last.marginDelta * 100).toFixed(1)} puntos`, period: last.period, source: src, comparison: 'Frente al mismo periodo del año anterior.', interpretation: 'Gana menos por cada euro vendido.', confidence: conf(n), confirms: 'Que continúe cayendo en el siguiente periodo.', invalidates: 'Que el margen se recupere o que la caída sea por una partida puntual.' });
    }
  }
  // FCF trend (annual)
  const f = inp.fcfH.slice(-4);
  if (f.length >= 3) {
    const rising = f.every((x, i) => i === 0 || x.val > f[i - 1].val);
    const falling = f.every((x, i) => i === 0 || x.val < f[i - 1].val);
    if (rising && f[f.length - 1].val > 0) out.push({ id: 'fcf_improvement', type: 'positive', title: 'Mejora sostenida del flujo de caja libre', value: `${f.length} años seguidos al alza`, period: `${f[0].year} a ${f[f.length - 1].year}`, source: SRC_Y, comparison: `De ${fmtMoney(f[0].val)} a ${fmtMoney(f[f.length - 1].val)}.`, interpretation: 'Cada año deja más caja disponible para el accionista.', confidence: f.length >= 4 ? 'alta' : 'media', confirms: 'Que el flujo siga creciendo sin que el capex quede artificialmente recortado.', invalidates: 'Que la subida venga de recortar inversión o de cobros adelantados.' });
    if (falling) out.push({ id: 'fcf_deterioration', type: 'negative', title: 'Deterioro del flujo de caja libre', value: `${f.length} años seguidos a la baja`, period: `${f[0].year} a ${f[f.length - 1].year}`, source: SRC_Y, comparison: `De ${fmtMoney(f[0].val)} a ${fmtMoney(f[f.length - 1].val)}.`, interpretation: 'Genera menos caja cada año, aunque el beneficio contable no lo refleje todavía.', confidence: f.length >= 4 ? 'alta' : 'media', confirms: 'Otro año de caída.', invalidates: 'Que la caída sea por inversión de crecimiento con retorno visible.' });
  }
  // Debt reduction
  const d = inp.debtH.slice(-3);
  if (d.length >= 2 && d[0].val > 0 && d[d.length - 1].val <= d[0].val * 0.85) out.push({ id: 'debt_reduction', type: 'positive', title: 'Reducción de deuda', value: `${((1 - d[d.length - 1].val / d[0].val) * 100).toFixed(0)}% menos deuda`, period: `${d[0].year} a ${d[d.length - 1].year}`, source: SRC_Y, comparison: `De ${fmtMoney(d[0].val)} a ${fmtMoney(d[d.length - 1].val)}.`, interpretation: 'Menos presión financiera y menos intereses.', confidence: d.length >= 3 ? 'media' : 'baja', confirms: 'Que continúe sin necesitar nueva financiación.', invalidates: 'Que la deuda vuelva a subir o se pague emitiendo acciones.' });
  // Guidance revisions: only from structured data
  if (inp.guidance && Array.isArray(inp.guidance.revisions) && inp.guidance.revisions.length) {
    const r = inp.guidance.revisions.slice(-2);
    const up = r.filter((x) => x.direction === 'up').length;
    const down = r.filter((x) => x.direction === 'down').length;
    if (up > down) out.push({ id: 'guidance_up', type: 'positive', title: 'Revisión positiva de previsiones', value: `${up} subida(s)`, period: r.map((x) => x.period).join(', '), source: inp.guidance.source || 'Previsiones de la empresa', comparison: 'Frente a su guía anterior.', interpretation: 'La dirección espera resultados mejores que antes.', confidence: up >= 2 ? 'media' : 'baja', confirms: 'Que los resultados reales cumplan la nueva guía.', invalidates: 'Que no se cumpla en el siguiente trimestre.' });
    if (down > up) out.push({ id: 'guidance_down', type: 'negative', title: 'Revisión a la baja de previsiones', value: `${down} recorte(s)`, period: r.map((x) => x.period).join(', '), source: inp.guidance.source || 'Previsiones de la empresa', comparison: 'Frente a su guía anterior.', interpretation: 'La dirección espera resultados peores que antes.', confidence: down >= 2 ? 'media' : 'baja', confirms: 'Otro recorte o resultados por debajo de la guía.', invalidates: 'Que los resultados superen la guía recortada.' });
  }
  // Earnings worsening
  const ni = inp.niH.slice(-3);
  if (ni.length >= 3 && ni.every((x, i) => i === 0 || x.val < ni[i - 1].val) && ni[0].val > 0) out.push({ id: 'earnings_worsening', type: 'negative', title: 'Empeoramiento de beneficios', value: `beneficio neto a la baja ${ni.length} años`, period: `${ni[0].year} a ${ni[ni.length - 1].year}`, source: SRC_Y, comparison: `De ${fmtMoney(ni[0].val)} a ${fmtMoney(ni[ni.length - 1].val)}.`, interpretation: 'El beneficio retrocede de forma continuada.', confidence: 'media', confirms: 'Otro año de caída.', invalidates: 'Que la caída corresponda a una partida extraordinaria puntual.' });
  // Financial quality deterioration: cash conversion falling
  if (inp.niH.length >= 3 && inp.fcfH.length >= 3) {
    const conv = inp.niH.slice(-3).map((n) => { const x = inp.fcfH.find((y) => y.y === n.y); return x && n.val > 0 ? x.val / n.val : null; });
    if (conv.every(isNum) && conv[0] > conv[1] && conv[1] > conv[2] && conv[2] < 0.6) out.push({ id: 'quality_deterioration', type: 'negative', title: 'Deterioro de la calidad del beneficio', value: `caja libre / beneficio: ${conv.map((c) => `${(c * 100).toFixed(0)}%`).join(' → ')}`, period: 'últimos 3 años', source: SRC_Y, comparison: 'Cada año una parte menor del beneficio se convierte en caja.', interpretation: 'Los beneficios contables podrían estar apoyándose en partidas que no son caja.', confidence: 'media', confirms: 'Otro año de conversión más baja.', invalidates: 'Que se recupere por encima del 80%.' });
  }
  // Dilution
  if (last && isNum(last.shareYoY) && last.shareYoY > 0.03) out.push({ id: 'dilution_increase', type: 'negative', title: 'Aumento significativo de la dilución', value: `acciones +${(last.shareYoY * 100).toFixed(1)}%`, period: last.period, source: src, comparison: 'Frente al mismo periodo del año anterior.', interpretation: 'Cada acción tuya representa una parte menor de la empresa.', confidence: conf(streak(snaps, (s) => isNum(s.shareYoY) && s.shareYoY > 0.02)), confirms: 'Otro periodo con más acciones en circulación.', invalidates: 'Que sea una ampliación puntual con un destino que genere retorno.' });
  return { signals: out, positives: out.filter((s) => s.type === 'positive').length, negatives: out.filter((s) => s.type === 'negative').length, note: 'Solo se generan señales con datos estructurados; los titulares de prensa no cuentan como prueba.' };
}
