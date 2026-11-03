// Translates the existing CBS/OPPO/GQS quality score into a plain yes/maybe/no verdict,
// separating "is this a good business" (score100) from "is it a good price right now"
// (oppo, the valuation leg of the same score) — a hyped stock can be a fine company at a
// bad price, which is exactly the case someone acting on a tip needs flagged separately.
// Shared by /start's checker, the Dashboard's watchlist preview badges (tier/label only),
// and the stock page's verdict card (the full dimensions/reasons object).
//
// The verdict is split into three dimensions — quality, valuation, risk — each one leading
// with a real number from this company (ROIC, P/FCF, net debt/equity...) rather than a canned
// sentence, and falling back to an explicit "not enough data for this" instead of asserting
// something the inputs don't support. `reasons` is kept as a flat array (same 2-4 short
// sentences, derived from the same three dimensions) purely for backwards compatibility with
// callers that just render a bullet list.
export function stockVerdict(easyMode, companyName) {
  if (!easyMode) return null;
  const {
    score100, oppo, cbs, gqs, moat,
    roicForScore, netDebtToEquity, trueFcfYield, truePfcf, growthCagrPct,
    cashRunwayYears, shareDilution,
  } = easyMode;
  const cheap = oppo >= 3.2;
  const expensive = oppo < 2.5;
  const qualityHigh = (cbs + gqs) / 2 >= 3.5;
  const qualityLow = (cbs + gqs) / 2 < 2.5;

  let tier, label, emoji;
  if (score100 >= 70 && !expensive) { tier = 'good'; label = 'Pinta bien'; emoji = '✅'; }
  else if (score100 >= 70 && expensive) { tier = 'caution'; label = 'Negocio bueno, pero caro ahora'; emoji = '⚠️'; }
  else if (score100 >= 40) { tier = 'caution'; label = 'Dudoso ahora mismo'; emoji = '⚠️'; }
  else { tier = 'bad'; label = 'Mucho cuidado'; emoji = '🚫'; }

  const pct1 = (v) => v == null ? null : `${v.toFixed(1)}%`;

  // --- Calidad del negocio: hecho (ROIC real) + interpretación, nunca al revés ---
  let quality;
  if (roicForScore != null) {
    quality = `${companyName} genera un retorno sobre el capital invertido (ROIC) del ${pct1(roicForScore)}. `
      + (qualityHigh
        ? 'Junto con sus márgenes y su deuda, es un negocio que convierte bien el dinero que reinvierte en más beneficio.'
        : qualityLow
        ? 'Junto con sus márgenes y su deuda, es una rentabilidad floja para lo que necesita reinvertir en el negocio.'
        : 'Es una rentabilidad intermedia: ni destaca ni preocupa especialmente frente a otras empresas de tamaño similar.');
  } else {
    quality = `No hay un ROIC fiable disponible para ${companyName} con los datos actuales, así que esta parte del veredicto se apoya en menos información de lo habitual` +
      (qualityHigh ? ' — aun así, el resto de márgenes y deuda disponibles es sólido.'
        : qualityLow ? ', y lo poco disponible tampoco es tranquilizador.'
        : ', y el resto de datos disponibles es intermedio.');
  }

  // --- Valoración: hecho (múltiplo real) + la hipótesis que lo hace "caro" o "barato" ---
  let valuation;
  if (truePfcf != null && truePfcf > 0) {
    valuation = `Cotiza a ${truePfcf.toFixed(1)} veces la caja libre que genera al año` +
      (trueFcfYield != null ? ` (una rentabilidad por caja libre del ${pct1(trueFcfYield)})` : '') + '. ' +
      (expensive
        ? 'Es un múltiplo alto para este negocio — el precio de hoy ya parece llevar metido bastante optimismo sobre su futuro.'
        : cheap
        ? 'Es un múltiplo contenido para lo que el negocio genera — hay margen si los resultados se mantienen o mejoran.'
        : 'No está ni especialmente caro ni especialmente barato frente a lo que genera ahora mismo.');
  } else {
    valuation = `No hay suficiente caja libre o capitalización fiable para calcular un múltiplo de valoración claro de ${companyName} ahora mismo, así que esta parte del veredicto tiene menos base de la habitual.`;
  }

  // --- Riesgos: cada frase cuelga de un dato real disponible; si no hay ninguno, se dice así ---
  const riskFacts = [];
  if (netDebtToEquity != null) {
    if (netDebtToEquity < 0) riskFacts.push('tiene más caja que deuda, lo que le da colchón frente a imprevistos');
    else if (netDebtToEquity > 1.2) riskFacts.push(`carga con una deuda relativamente alta frente a su patrimonio (deuda neta sobre capital de ${netDebtToEquity.toFixed(1)}x)`);
  }
  if (cashRunwayYears != null) riskFacts.push(`si sigue quemando caja al ritmo actual, le quedarían aproximadamente ${cashRunwayYears.toFixed(1)} años de colchón`);
  if (shareDilution != null && shareDilution > 15) riskFacts.push(`ha diluido a sus accionistas cerca de un ${pct1(shareDilution)} en los últimos años`);
  if (moat === 'NONE') riskFacts.push('con los datos disponibles (ROIC y margen operativo) no se detecta una ventaja competitiva clara frente a rivales');
  else if (moat === 'UNKNOWN') riskFacts.push('no hay suficientes datos (ROIC ni margen operativo) para saber si tiene una ventaja competitiva duradera — no es que se haya comprobado que no la tiene');

  const risks = riskFacts.length
    ? `Lo más relevante a vigilar: ${riskFacts.join('; ')}.`
    : 'Con los datos disponibles no saltan señales de riesgo destacadas — eso no garantiza que no existan, solo que no las capta este modelo; revisa el apartado de qué investigar más abajo.';

  const reasons = [quality, valuation, risks];
  if (moat === 'WIDE') reasons.push('Tiene una ventaja competitiva amplia: le cuesta más a la competencia quitarle terreno.');
  else if (moat === 'NARROW') reasons.push('Tiene cierta ventaja frente a la competencia, aunque no enorme.');

  return {
    tier, label, emoji,
    dimensions: { quality, valuation, risks },
    reasons,
  };
}

// A small bank of concrete research questions, selected by the same real signals
// stockVerdict() reads above (cheap/expensive, quality, growth, moat) — so the questions fit
// this company's actual numbers instead of repeating one fixed list on every ticker.
// Deliberately phrased as things to go verify, never as buy/sell guidance.
export function investigateQuestions(easyMode) {
  if (!easyMode) return [];
  const { oppo, cbs, gqs, moat, growthCagrPct } = easyMode;
  const cheap = oppo >= 3.2;
  const expensive = oppo < 2.5;
  const qualityLow = (cbs + gqs) / 2 < 2.5;
  const growing = growthCagrPct != null && growthCagrPct > 8;
  const slowing = growthCagrPct != null && growthCagrPct < 3;

  const qs = [];
  if (expensive) {
    qs.push('¿Está creciendo lo suficientemente rápido como para justificar este precio?');
    qs.push('¿Su generación de caja libre está mejorando o empeorando trimestre a trimestre?');
  } else if (cheap) {
    qs.push('¿Por qué cotiza tan barata — hay un riesgo real que el precio ya está descontando, o es una oportunidad que el mercado está pasando por alto?');
  }
  if (qualityLow) {
    qs.push('¿Qué está fallando exactamente en sus márgenes o su deuda, y hay señales de que esté mejorando?');
  }
  if (slowing) {
    qs.push('¿A qué se debe la desaceleración de sus ingresos, y parece temporal o estructural?');
  } else if (growing) {
    qs.push('¿Ese ritmo de crecimiento es sostenible, o depende de un empujón puntual (una adquisición, un año de comparación fácil)?');
  }
  if (moat === 'UNKNOWN' || moat === 'NONE') {
    qs.push('¿Qué le impediría a un competidor replicar lo que hace esta empresa?');
  }
  qs.push('¿Cómo se compara con otras empresas de su mismo sector en crecimiento, márgenes y valoración?');

  return [...new Set(qs)].slice(0, 4);
}
