import { computeETFQualityScore } from './etfQuality';

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
    // The ROIC is read against the usual cost of capital (about 8-10% for most listed
    // companies), NOT against the composite quality score: a 20.8% ROIC is excellent in its own
    // right, whatever other weaknesses the company may have. Those are described separately.
    const roicReading = roicForScore >= 15
      ? 'claramente por encima del coste habitual del capital (en torno al 8-10%): cada euro que reinvierte crea valor.'
      : roicForScore >= 9
      ? 'por encima del coste habitual del capital (8-10%), aunque sin un margen amplio.'
      : roicForScore >= 5
      ? 'cerca del coste habitual del capital (8-10%): crecer no crea mucho valor extra.'
      : 'por debajo del coste habitual del capital (8-10%): crecer, en estas condiciones, destruiría valor.';
    const rest = qualityHigh
      ? 'Sus márgenes, su caja y su deuda acompañan.'
      : qualityLow
      ? 'Eso sí, sus márgenes, su caja o su deuda tienen puntos débiles que conviene revisar por separado.'
      : 'Sus márgenes y su deuda son intermedios.';
    quality = `${companyName} genera un retorno sobre el capital invertido (ROIC) del ${pct1(roicForScore)}, ${roicReading} ${rest}`;
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
    // Exposed so callers can reconcile this (growth-agnostic, multiple-only) read with the
    // entry-price projection card, which assumes growth continues — the two can legitimately
    // disagree for a high-growth name, and that needs explaining, not hiding.
    expensive, cheap,
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

// Same shape and reasoning as stockVerdict() above, for ETFs/funds: three dimensions — coste,
// liquidez, diversificación — each citing the fund's real numbers (TER%, AUM/volumen,
// concentración en las 10 mayores posiciones) via computeETFQualityScore (lib/etfQuality.js),
// with an honest "no hay datos" instead of guessing when a factor isn't reported. Previously
// three separate, duplicated single-tier verdict functions existed (app/(main)/etfs/page.js,
// app/(main)/etfs/[ticker]/page.js, app/start/page.js) with none of them citing real numbers —
// this replaces all three.
export function etfVerdict(etf) {
  if (!etf) return null;
  const quality = computeETFQualityScore(etf);
  if (!quality) return null;
  const { composite, factors } = quality;

  let tier, label, emoji;
  if (composite == null) { tier = 'caution'; label = 'Pocos datos para valorarlo'; emoji = '❓'; }
  else if (composite >= 70) { tier = 'good'; label = 'Fondo sólido'; emoji = '✅'; }
  else if (composite >= 40) { tier = 'caution'; label = 'Normalito'; emoji = '⚠️'; }
  else { tier = 'bad'; label = 'Cuidado'; emoji = '🚫'; }

  // --- Coste: hecho (TER real) + interpretación ---
  let cost;
  if (factors.cost.available) {
    cost = `Cobra un ${etf.expenseRatio} al año de comisión de gestión (TER). ` +
      (factors.cost.score >= 70
        ? 'Es una comisión baja — apenas resta a tu rentabilidad a largo plazo.'
        : factors.cost.score >= 40
        ? 'Es una comisión intermedia: ni de las más baratas ni de las más caras del mercado.'
        : 'Es una comisión alta para un fondo — compárala con otros que sigan el mismo índice o sector antes de decidir.');
  } else {
    cost = 'No encontramos la comisión anual (TER) de este fondo con los datos disponibles — revísala en el folleto antes de invertir, es de los datos más importantes para un fondo.';
  }

  // --- Liquidez: hecho (patrimonio/volumen reales) + interpretación ---
  let liquidity;
  if (factors.liquidity.available) {
    const facts = [];
    if (etf.aum && etf.aum !== 'See Prospectus') facts.push(`gestiona ${etf.aum}`);
    if (etf.volume && etf.volume !== 'N/A') facts.push(`mueve de media ${etf.volume} participaciones al día`);
    liquidity = (facts.length ? `Este fondo ${facts.join(' y ')}. ` : '') +
      (factors.liquidity.score >= 70
        ? 'Es grande y líquido — no deberías tener problemas para comprar o vender sin mover el precio.'
        : factors.liquidity.score >= 40
        ? 'Tiene un tamaño o volumen moderado, suficiente para la mayoría de inversores particulares.'
        : 'Es pequeño o se mueve poco — podrías notar más diferencia entre el precio al que quieres comprar y al que realmente te ejecutan la orden.');
  } else {
    liquidity = 'No hay datos fiables de patrimonio gestionado ni de volumen para este fondo, así que no podemos valorar su liquidez.';
  }

  // --- Diversificación: hecho (concentración real) + interpretación ---
  let diversification;
  if (factors.diversification.available) {
    const top10 = etf.holdings.slice(0, 10).reduce((sum, h) => sum + (parseFloat(h.weight) || 0), 0);
    diversification = `Sus 10 mayores posiciones concentran un ${top10.toFixed(1)}% del fondo. ` +
      (factors.diversification.score >= 70
        ? 'Está bien repartido — ninguna empresa individual pesa demasiado sobre el resultado.'
        : factors.diversification.score >= 40
        ? 'Tiene una concentración moderada en sus posiciones principales.'
        : 'Está bastante concentrado en pocas posiciones — el resultado depende mucho de cómo les vaya a esas empresas en concreto, más que de un índice amplio.');
  } else {
    diversification = 'Este fondo no reporta sus posiciones con los datos disponibles, así que no podemos valorar cuánto reparte el riesgo entre distintas empresas.';
  }

  const reasons = [cost, liquidity, diversification];

  return {
    tier, label, emoji,
    dimensions: { cost, liquidity, diversification },
    reasons,
  };
}

// Same bank-of-questions pattern as investigateQuestions() above, adapted to what actually
// matters for a fund: whether the cost is justified, how exposed it is to a handful of
// positions, and whether it's liquid enough for how you'd actually use it. Deliberately not
// buy/sell guidance, same as the stock version.
export function investigateEtfQuestions(etf, quality) {
  if (!quality) return [];
  const { factors } = quality;
  const expensePct = parseFloat(etf.expenseRatio);
  const qs = [];

  if (factors.cost.available && !Number.isNaN(expensePct) && expensePct > 0.4) {
    qs.push('¿Hay un fondo que siga el mismo índice o sector con una comisión más baja?');
  }
  if (factors.diversification.available && factors.diversification.score < 40) {
    qs.push('¿Qué pasaría con el fondo si sus posiciones principales tuvieran un mal año?');
  } else if (!factors.diversification.available) {
    qs.push('¿Qué tipo de activos tiene realmente este fondo, ya que no reporta sus posiciones?');
  }
  if (factors.liquidity.available && factors.liquidity.score < 40) {
    qs.push('¿Vas a necesitar vender con rapidez en algún momento? Con poco volumen, el precio de venta podría no ser el que esperas.');
  }
  if (etf.category === 'sector') {
    qs.push('¿Estás cómodo concentrando parte de tu dinero en un solo sector en vez de en el mercado general?');
  }
  qs.push('¿El índice o sector que sigue se solapa con otros fondos o acciones que ya tienes?');

  return [...new Set(qs)].slice(0, 4);
}
