// Translates the existing CBS/OPPO/GQS quality score into a plain yes/maybe/no verdict,
// separating "is this a good business" (score100) from "is it a good price right now"
// (oppo, the valuation leg of the same score) — a hyped stock can be a fine company at a
// bad price, which is exactly the case someone acting on a tip needs flagged separately.
// Shared by /start's checker and the new Dashboard's watchlist preview badges — one verdict,
// not two independently-drifting copies of the same thresholds.
export function stockVerdict(easyMode, companyName) {
  if (!easyMode) return null;
  const { score100, oppo, cbs, gqs, moat } = easyMode;
  const cheap = oppo >= 3.2;
  const expensive = oppo < 2.5;
  const qualityHigh = (cbs + gqs) / 2 >= 3.5;
  const qualityLow = (cbs + gqs) / 2 < 2.5;

  let tier, label, emoji;
  if (score100 >= 70 && !expensive) { tier = 'good'; label = 'Pinta bien'; emoji = '✅'; }
  else if (score100 >= 70 && expensive) { tier = 'caution'; label = 'Negocio bueno, pero caro ahora'; emoji = '⚠️'; }
  else if (score100 >= 40) { tier = 'caution'; label = 'Dudoso ahora mismo'; emoji = '⚠️'; }
  else { tier = 'bad'; label = 'Mucho cuidado'; emoji = '🚫'; }

  const reasons = [];
  if (expensive) reasons.push('Cotiza cara comparada con lo que gana — el precio ya podría llevar metido el optimismo.');
  else if (cheap) reasons.push('El precio parece razonable para lo que ofrece el negocio.');
  else reasons.push('El precio no está ni especialmente barato ni especialmente caro.');

  if (qualityHigh) reasons.push(`Los números de ${companyName} son sólidos: rentable y con buena gestión.`);
  else if (qualityLow) reasons.push(`Los números de ${companyName} no son muy sólidos ahora mismo.`);
  else reasons.push(`Los números de ${companyName} son normalitos, ni destacan ni preocupan.`);

  if (moat === 'WIDE') reasons.push('Tiene una ventaja clara frente a la competencia, difícil de copiar.');
  else if (moat === 'NARROW') reasons.push('Tiene cierta ventaja frente a la competencia, aunque no enorme.');

  return { tier, label, emoji, reasons };
}
