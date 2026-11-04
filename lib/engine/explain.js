// Beginner-facing explanations (Spanish from Spain). Every block answers four questions:
// what am I seeing, why does it matter, is it good or bad in this context, what to look at next.
// Text is built from this company's own numbers; nothing here is a buy/sell recommendation.

import { isNum } from './util.js';

const pc = (v, d = 1) => (isNum(v) ? `${(v * 100).toFixed(d).replace('.', ',')}%` : 'N/D');
const x = (v, d = 1) => (isNum(v) ? `${v.toFixed(d).replace('.', ',')}x` : 'N/D');
const money = (v, sym = '$') => (isNum(v) ? `${sym}${v.toFixed(2).replace('.', ',')}` : 'N/D');

export function explainQuality(q, inp, profile) {
  if (q.score == null) {
    return { id: 'quality', title: 'Calidad del negocio', que: 'Mide si el negocio gana mucho dinero con lo que invierte, si lo convierte en caja y si aguanta los malos años.', porQue: 'Un buen negocio compone valor con el tiempo; uno flojo exige que el precio sea muy bajo para compensar.', bueno: q.reasonNull, investigar: ['Revisa las cuentas anuales completas (10-K) en la web de la SEC o de la propia empresa.'] };
  }
  const roicTxt = isNum(q.roic) ? `Gana un ${pc(q.roic)} sobre el dinero invertido en el negocio (ROIC), frente a un coste del capital de ${pc(q.costOfCapital)}.` : 'No hay un ROIC fiable.';
  const verdict = q.score >= 75 ? 'Es un resultado sólido' : q.score >= 55 ? 'Es un resultado aceptable con aspectos por vigilar' : 'Es un resultado débil';
  const weak = Object.entries(q.components).sort((a, b) => a[1].score - b[1].score)[0];
  return {
    id: 'quality', title: 'Calidad del negocio',
    que: `${roicTxt} La puntuación ${q.score}/100 resume rentabilidad, márgenes, caja y balance.`,
    porQue: 'Un negocio que gana bastante más que su coste del capital crea valor con cada euro que reinvierte; si gana menos, crecer destruye valor.',
    bueno: `${verdict} (${profile.label.toLowerCase()}). ${weak ? `Su punto más débil: ${weak[1].detail}.` : ''} Calidad financiera no es lo mismo que ventaja competitiva: ${q.moat.note}`,
    investigar: [
      'Por qué la competencia no le quita esos márgenes (marca, costes de cambio, escala).',
      weak ? `Cómo ha evolucionado: ${weak[1].detail}.` : 'Cómo han evolucionado los márgenes en los últimos 5 años.',
    ],
  };
}

export function explainMomentum(m) {
  const base = {
    confirmed_improvement: 'El negocio mejora de forma consistente en más de un periodo.',
    possible_improvement: 'Hay señales de mejora, pero todavía en un solo periodo: puede ser un rebote puntual.',
    stable: 'No hay cambios relevantes en ninguna dirección.',
    mixed: 'Unas señales mejoran y otras empeoran.',
    possible_deterioration: 'Hay señales de empeoramiento, pero aún en un solo periodo.',
    confirmed_deterioration: 'El negocio empeora de forma consistente en más de un periodo.',
    insufficient: 'No hay datos para comparar periodos.',
  }[m.status];
  const good = m.indicators.filter((i) => i.signal > 0).map((i) => i.label.toLowerCase());
  const bad = m.indicators.filter((i) => i.signal < 0).map((i) => i.label.toLowerCase());
  return {
    id: 'momentum', title: 'Crecimiento y evolución',
    que: `Clasificación: ${m.label}. ${base}${m.ttmNote ? ' ' + m.ttmNote : ''}`,
    porQue: 'El precio de una acción se mueve por lo que se espera del futuro; ver si los números mejoran o empeoran antes de que sea obvio es lo que más ayuda a no llegar tarde.',
    bueno: m.status === 'insufficient' ? 'Sin datos suficientes no se emite opinión.' : `Mejoran: ${good.join(', ') || 'ninguno'}. Empeoran: ${bad.join(', ') || 'ninguno'}.`,
    investigar: ['Comprueba si el último trimestre confirma el cambio de tendencia.', ...(m.limitations.slice(0, 2))],
  };
}

export function explainValuation(v, inp, scenarios, quality) {
  if (v.score == null) {
    return { id: 'valuation', title: 'Valoración actual', que: 'Compara lo que pagas con lo que el negocio genera.', porQue: 'Pagar de más por una buena empresa puede dar una mala inversión.', bueno: v.reasonNull, investigar: ['Busca ratios sobre ventas y la posibilidad de beneficios futuros en los informes trimestrales.'] };
  }
  const used = v.methods.map((m) => `${m.label} ${x(m.value)}`).join(', ');
  const opposite = quality.score != null && ((quality.score >= 70 && v.score < 40) || (quality.score < 45 && v.score >= 65));
  return {
    id: 'valuation', title: 'Valoración actual',
    que: `${v.label} (${v.score}/100). Métodos usados: ${used || 'rentabilidad implícita'}.${v.impliedReturn ? ' ' + v.impliedReturn.note : ''}`,
    porQue: 'El mismo negocio puede ser una ganga o un mal trato según el precio que pagues; un múltiplo bajo no es siempre barato y uno alto no siempre es caro.',
    bueno: `${opposite ? (quality.score >= 70 ? 'La empresa genera caja y tiene buenos márgenes, pero su cotización exige un crecimiento futuro elevado. Puede ser un buen negocio sin ser una compra atractiva al precio actual. ' : 'Parece barata, pero su negocio es débil: que cotice barata no garantiza que vaya a recuperar su valor. ') : ''}${v.notes.join(' ')}`.trim(),
    investigar: [`Descartados para esta empresa: ${v.discarded.slice(0, 3).map((d) => d.label).join(', ') || 'ninguno'}.`, 'Compara con su propia valoración histórica (no disponible aquí).'],
  };
}

export function explainRisk(r) {
  const confirmed = r.items.filter((i) => i.status === 'confirmed').map((i) => i.label.toLowerCase());
  const potential = r.items.filter((i) => i.status === 'potential').map((i) => i.label.toLowerCase());
  return {
    id: 'risk', title: 'Riesgos',
    que: `${r.label}. Confirmados: ${confirmed.join(', ') || 'ninguno'}. Posibles: ${potential.join(', ') || 'ninguno'}. No evaluables: ${r.counts.notEvaluable} de ${r.counts.total}.`,
    porQue: 'Conocer lo que puede salir mal importa más que conocer lo que puede salir bien.',
    bueno: r.caveat || 'Se han podido evaluar todas las categorías.',
    investigar: ['Lee la sección de factores de riesgo del informe anual (10-K).', 'Mira clientes principales, proveedores clave y vencimientos de deuda: no están en las fuentes estructuradas.'],
  };
}

export function explainScenarios(s, inp, sym = '$') {
  if (s.status !== 'ok') {
    return { id: 'scenarios', title: 'Escenarios a cinco años', que: 'Una estimación de lo que valdría la acción dentro de cinco años según qué pase con el negocio.', porQue: 'Ayuda a ver qué tendría que ocurrir para que la inversión tuviera sentido.', bueno: s.reason, investigar: s.requiredConditions ? [s.requiredConditions.text] : ['Sin beneficios positivos o sin datos de balance no se puede proyectar.'] };
  }
  const c = s.scenarios.find((e) => e.key === 'central');
  return {
    id: 'scenarios', title: 'Escenarios a cinco años',
    que: `Con el escenario central, cada acción valdría ${money(c.valueYear5, sym)} dentro de cinco años, una rentabilidad anual de ${pc(c.cagr)} desde el precio de hoy. Método: ${s.modelLabel}.`,
    porQue: `Para ganar un ${pc(s.requiredReturn, 0)} anual, no deberías pagar más de ${money(c.maxEntryPrice, sym)} por acción hoy en este escenario.`,
    bueno: s.warnings.join(' ') || 'Los supuestos no activan avisos especiales.',
    investigar: [...s.conditions.slice(0, 3), s.notProbabilities],
  };
}
