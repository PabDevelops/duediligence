import { computeETFQualityScore } from './etfQuality';
import { TIER_LABELS } from './engine/tierScale';

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

// V2 engine (lib/engine) equivalent of stockVerdict() above. Same shape, same plain-language
// level — one real number plus a reading, never a raw ratio dump — but sourced from the V2
// engine's quality/valuation/risk/potential dimensions instead of computeEasyMode, so this card
// agrees with the "Investigar a fondo" page's own numbers (same engine instance) instead of
// narrating a second, different verdict for the same ticker.
const SIMPLE_METHOD_PHRASE = {
  pe: 'veces el beneficio que genera al año',
  pfcf: 'veces la caja libre que genera al año',
  evEbitda: 'veces su beneficio operativo bruto, deuda incluida',
  evEbit: 'veces su beneficio operativo, deuda incluida',
  evSales: 'veces sus ventas, deuda incluida',
  pb: 'veces su valor contable',
};

export function engineVerdict(engine, companyName) {
  if (!engine) return null;
  const { quality, valuation, risk, potential } = engine;

  // potential.label is now a shared tier letter (S+/S/A/B/C/D/F — lib/engine/tierScale.js), not
  // the old bespoke "Potencial atractivo"/"Potencial desfavorable" strings. The old "atractivo"
  // cutoff (score >= 70) is tier A or above; the old "desfavorable" cutoff (score < 40) is tier D
  // or below — same thresholds, just read off the letter instead of a fixed string.
  const potentialTierIdx = potential.label ? TIER_LABELS.indexOf(potential.label) : -1;
  let tier, label, emoji;
  if (potential.score == null) { tier = 'caution'; label = 'No concluyente'; emoji = '❓'; }
  else if (potentialTierIdx >= TIER_LABELS.indexOf('A')) { tier = 'good'; label = 'Pinta bien'; emoji = '✅'; }
  else if (potentialTierIdx <= TIER_LABELS.indexOf('D')) { tier = 'bad'; label = 'Mucho cuidado'; emoji = '🚫'; }
  else { tier = 'caution'; label = potential.pattern?.id === 'good_business_expensive' ? 'Negocio bueno, pero caro ahora' : 'Dudoso ahora mismo'; emoji = '⚠️'; }

  // --- Calidad: la misma frase de rentabilidad (ROIC, o ROE para bancos/aseguradoras) que ya
  // respalda la nota de arriba — leída de quality.components.returns.detail (lib/engine/
  // quality.js) instead of rebuilt from quality.roic/costOfCapital directly, which stay null
  // for financial companies (scored off ROE, not ROIC) even when quality.score is valid:
  // reading off roic/costOfCapital alone used to wrongly show "no hay suficientes datos" for
  // every bank — confirmed against real data (Community Bancorp, CMTV: score 67, roic null). ---
  let quality_;
  if (quality.score != null) {
    const reading = quality.score >= 75 ? 'un resultado sólido.' : quality.score >= 55 ? 'un resultado aceptable, con aspectos por vigilar.' : 'un resultado débil.';
    const returnsDetail = quality.components?.returns?.detail;
    quality_ = returnsDetail ? `${companyName}: ${returnsDetail} — ${reading}` : `${companyName} obtiene una nota de calidad de ${quality.score}/100 — ${reading}`;
  } else {
    quality_ = quality.reasonNull ?? `No hay suficientes datos para valorar la calidad del negocio de ${companyName} con las cifras actuales.`;
  }

  // --- Valoración: un múltiplo real + la lectura simple, nunca la lista completa de métodos ---
  let valuation_;
  if (valuation.score != null) {
    const m = valuation.methods.find((x) => x.id === 'pfcf') || valuation.methods.find((x) => x.id === 'pe') || valuation.methods[0];
    // No "opposite" sentence here (good-business-expensive / cheap-weak-business) — that's
    // exactly what potential.pattern.text already says once, right under the badge above;
    // repeating it almost verbatim in this paragraph too was redundant.
    valuation_ = (m ? `Cotiza a ${m.value.toFixed(1)} ${SIMPLE_METHOD_PHRASE[m.id] ?? m.label.toLowerCase()}. ` : '') + `${valuation.label}.`;
  } else {
    valuation_ = valuation.reasonNull ?? `No hay suficiente información para calcular una valoración clara de ${companyName} ahora mismo.`;
  }

  // --- Riesgos: lo confirmado y lo posible, en una frase — igual de corto que antes ---
  const confirmed = risk.items.filter((i) => i.status === 'confirmed').map((i) => i.label.toLowerCase());
  const possible = risk.items.filter((i) => i.status === 'potential').map((i) => i.label.toLowerCase());
  const risks = confirmed.length || possible.length
    ? [confirmed.length ? `Confirmado: ${confirmed.join(', ')}.` : null, possible.length ? `Posible: ${possible.join(', ')}.` : null].filter(Boolean).join(' ')
    : 'Con los datos disponibles no saltan señales de riesgo destacadas — eso no garantiza que no existan, solo que no las capta este modelo; revisa el apartado de qué investigar más abajo.';

  const reasons = [quality_, valuation_, risks];
  if (potential.pattern?.text) reasons.push(potential.pattern.text);

  // --- Semáforo por dimensión: un vistazo a 3 puntos (verde/ámbar/rojo) antes de leer el texto.
  // Mismos cortes que ya usan `quality_`/`valuation_`/`expensive`/`cheap` arriba, para que el
  // punto de color nunca contradiga la frase que tiene al lado. 'unknown' (gris) cuando no hay
  // suficientes datos para esa dimensión — nunca se fuerza a rojo/verde sin dato real detrás.
  // Riesgos usa los mismos `confirmed`/`possible` que ya arma la frase de arriba, no
  // `risk.overall`: ese campo se marca "no_concluyente" en cuanto la cobertura de factores
  // evaluables baja de 50%, incluso con riesgos confirmados entre los que sí se pudieron evaluar
  // (confirmado con datos reales: PNC sale con 3 riesgos confirmados en el texto pero
  // risk.overall='no_concluyente') — habría puesto el punto en gris justo al lado de un texto
  // listando riesgos confirmados, contradiciéndolo.
  const dimensionLevels = {
    quality: quality.score == null ? 'unknown' : quality.score >= 70 ? 'good' : quality.score >= 40 ? 'caution' : 'bad',
    valuation: valuation.score == null ? 'unknown' : valuation.score >= 65 ? 'good' : valuation.score >= 40 ? 'caution' : 'bad',
    risks: confirmed.length >= 2 ? 'bad' : confirmed.length === 1 || possible.length >= 1 ? 'caution' : 'good',
  };

  return {
    tier, label, emoji,
    dimensions: { quality: quality_, valuation: valuation_, risks },
    dimensionLevels,
    reasons,
    pattern: potential.pattern,
    expensive: valuation.score != null && valuation.score < 40,
    cheap: valuation.score != null && valuation.score >= 65,
  };
}

// Same "what to look into next" idea as investigateQuestions() below, pulled straight from the
// V2 engine's own per-dimension "qué investigar después" (lib/engine/explain.js) instead of a
// second, separately-maintained question bank — deduped and capped at 4, same as before.
export function engineInvestigateQuestions(engine) {
  if (!engine?.explanations) return [];
  const { quality, valuation, risk, scenarios } = engine.explanations;
  const qs = [...(quality?.investigar ?? []), ...(valuation?.investigar ?? []), ...(risk?.investigar ?? []), ...(scenarios?.investigar ?? [])].filter(Boolean);
  return [...new Set(qs)].slice(0, 4);
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
