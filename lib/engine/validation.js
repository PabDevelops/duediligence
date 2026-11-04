// Automatic data-quality checks. Legitimate negatives (losses, negative FCF, negative equity)
// are reported as information, never as errors. Impossible or inconsistent combinations are
// flagged with a severity so downstream scores can be withheld when the data is not usable.

import { isNum, fmtMoney } from './util.js';

const rel = (a, b) => (isNum(a) && isNum(b) && b !== 0 ? Math.abs(a - b) / Math.abs(b) : null);

export function validateInput(inp, now = new Date()) {
  const issues = [];
  const add = (code, severity, message, field = null) => issues.push({ code, severity, message, field });

  // 1. Market cap vs price x shares.
  if (isNum(inp.price) && isNum(inp.shares) && isNum(inp.marketCap)) {
    const implied = inp.price * inp.shares;
    const diff = rel(inp.marketCap, implied);
    if (diff != null && diff > 0.25) add('MKTCAP_MISMATCH', 'error', `La capitalización (${fmtMoney(inp.marketCap)}) difiere un ${(diff * 100).toFixed(0)}% de precio x acciones. Una de las dos cifras es incorrecta o hay varias clases de acciones.`, 'marketCap');
    else if (diff != null && diff > 0.10) add('MKTCAP_DRIFT', 'warning', `La capitalización difiere un ${(diff * 100).toFixed(0)}% de precio x acciones, posible desfase de actualización o varias clases de acciones.`, 'marketCap');
  }

  // 2. Enterprise value must be built once: market cap + debt - cash.
  if (inp.ev != null && isNum(inp.marketCap) && isNum(inp.debt) && isNum(inp.cash)) {
    const expected = inp.marketCap + inp.debt - inp.cash;
    if (Math.abs(inp.ev - expected) > Math.max(1, Math.abs(expected)) * 1e-9) add('EV_BUILD', 'error', 'El valor de empresa no coincide con capitalización + deuda - caja (posible doble resta de caja).', 'ev');
  }
  if (isNum(inp.netDebt) && isNum(inp.debt) && isNum(inp.cash) && Math.abs(inp.netDebt - (inp.debt - inp.cash)) > 1) {
    add('NETDEBT_BUILD', 'error', 'La deuda neta no es deuda menos caja: puede estar restándose la caja dos veces.', 'netDebt');
  }
  if (inp.debt == null || inp.cash == null) add('NETDEBT_INCOMPLETE', 'info', 'No se calcula deuda neta ni valor de empresa porque falta la deuda o la caja. No se sustituye el dato que falta por cero.', 'netDebt');

  // 3. Reported EV/EBITDA vs our own build.
  if (isNum(inp.evEbitdaReported) && inp.ev != null && inp.ebitda != null && inp.ebitda !== 0) {
    const ours = inp.ev / inp.ebitda;
    if (inp.evEbitdaReported < 0) add('EVEBITDA_NEGATIVE', 'info', 'El EV/EBITDA publicado es negativo: el EBITDA es negativo, el múltiplo no es una oportunidad ni se usa para valorar.', 'evEbitda');
    else if (rel(inp.evEbitdaReported, ours) > 0.25) add('EVEBITDA_MISMATCH', 'warning', `El EV/EBITDA de la fuente (${inp.evEbitdaReported.toFixed(1)}x) no coincide con el calculado aquí (${ours.toFixed(1)}x). Pueden usar periodos o definiciones de deuda distintos.`, 'evEbitda');
  } else if (isNum(inp.evEbitdaReported) && inp.evEbitdaReported < 0) {
    add('EVEBITDA_NEGATIVE', 'info', 'El EV/EBITDA publicado es negativo: el EBITDA es negativo, el múltiplo no se usa para valorar.', 'evEbitda');
  }

  // 4. EPS vs net income / shares (denominator check).
  if (isNum(inp.eps) && isNum(inp.ni) && isNum(inp.shares) && inp.shares > 0 && inp.ni !== 0) {
    const impliedEps = inp.ni / inp.shares;
    const d = rel(inp.eps, impliedEps);
    if (d != null && d > 0.35) add('EPS_DENOMINATOR', 'warning', `El BPA publicado (${inp.eps.toFixed(2)}) no cuadra con beneficio neto / acciones (${impliedEps.toFixed(2)}). Puede venir de otro periodo o de otro número de acciones (diluidas frente a básicas).`, 'eps');
  }

  // 5. Dilution is not SBC.
  if (isNum(inp.sbc) && inp.shareDilutionPct == null) add('DILUTION_UNKNOWN', 'info', 'Hay remuneración en acciones pero no se puede medir la dilución real (falta el historial de acciones). La remuneración en acciones no es lo mismo que la dilución.', 'shareDilution');
  if (inp.shareHistoryYears > 0 && inp.shareHistoryYears < 3) add('DILUTION_SHORT', 'info', 'El historial de acciones es corto: la dilución observada es poco fiable.', 'shareDilution');

  // 6. Impossible / inconsistent values.
  if (isNum(inp.rev) && inp.rev < 0) add('REV_NEGATIVE', 'error', 'Ingresos negativos: dato imposible.', 'rev');
  if (isNum(inp.price) && inp.price <= 0) add('PRICE_NONPOSITIVE', 'error', 'Precio no positivo.', 'price');
  if (isNum(inp.shares) && inp.shares <= 0) add('SHARES_NONPOSITIVE', 'error', 'Número de acciones no positivo.', 'shares');
  if (isNum(inp.grossMargin) && (inp.grossMargin > 1.0 || inp.grossMargin < -1)) add('GM_IMPOSSIBLE', 'error', 'Margen bruto fuera de rango posible.', 'grossMargin');
  if (isNum(inp.opMargin) && inp.opMargin > 1.0) add('OM_IMPOSSIBLE', 'error', 'Margen operativo superior al 100%.', 'opMargin');
  if (isNum(inp.roicReported) && inp.roicReported > 0 && isNum(inp.oi) && inp.oi <= 0) add('ROIC_SIGN_MISMATCH', 'warning', 'El ROIC es positivo pero el resultado operativo es negativo o cero: las cifras proceden probablemente de periodos o definiciones distintas (por ejemplo, un ROIC de otro proveedor). No se usa el ROIC para puntuar hasta aclararlo.', 'roic');
  if (isNum(inp.roicReported) && inp.roicReported > 1.5) add('ROIC_EXTREME', 'warning', 'ROIC superior al 150%: suele indicar un capital invertido muy pequeño o negativo, no una eficiencia real.', 'roic');
  if (isNum(inp.fcf) && isNum(inp.rev) && inp.rev > 0 && inp.fcf > inp.rev) add('FCF_GT_REV', 'warning', 'El flujo de caja libre supera a los ingresos, probable partida extraordinaria o dato erróneo.', 'fcf');
  if (isNum(inp.gp) && isNum(inp.rev) && inp.gp > inp.rev * 1.001) add('GP_GT_REV', 'error', 'El beneficio bruto supera a los ingresos.', 'gp');

  // 6a. Historical series must be mutually coherent (same years, margins that can exist).
  const badYears = inp.revH.filter((r) => {
    const o = inp.oiH.find((x) => x.y === r.y);
    return o && r.val > 0 && (o.val > r.val * 1.0001 || o.val < -r.val * 5);
  }).map((r) => r.year);
  if (badYears.length) add('HISTORY_INCONSISTENT', 'error', `En ${badYears.join(', ')} el resultado operativo es mayor que los ingresos (o una pérdida desproporcionada): las series históricas no son coherentes entre sí.`, 'history');
  if (inp.revH.some((r) => r.val < 0)) add('HISTORY_NEGATIVE_REVENUE', 'error', 'El historial contiene ingresos negativos.', 'history');

  // 6b. Captive finance arms: consolidated debt that dwarfs the equity value is usually the
  // financing arm's debt, which makes EV-based ratios and a net-debt bridge unreliable.
  if (isNum(inp.netDebt) && isNum(inp.marketCap) && inp.marketCap > 0 && inp.netDebt > 2 * inp.marketCap && (inp.industry || '').toLowerCase().match(/auto|equipment|machinery/)) {
    add('CAPTIVE_FINANCE_SUSPECT', 'warning', 'La deuda neta es más del doble de la capitalización en un sector con financieras propias: probablemente incluye la deuda de la división financiera. EV/EBITDA y el puente de deuda no son fiables aquí.', 'debt');
  }

  // 7. Legitimate negatives, reported as information only.
  if (isNum(inp.oi) && inp.oi < 0) add('LOSS_MAKING', 'info', 'Resultado operativo negativo: es un dato legítimo, no un error.', 'oi');
  if (isNum(inp.fcf) && inp.fcf < 0) add('NEGATIVE_FCF', 'info', 'Flujo de caja libre negativo: es un dato legítimo, no un error.', 'fcf');
  if (isNum(inp.equity) && inp.equity < 0) add('NEGATIVE_EQUITY', 'info', 'Patrimonio neto negativo (habitual tras muchas recompras): ROE y deuda/patrimonio no son interpretables.', 'equity');

  // 8. Freshness: new data must not be silently mixed with old data.
  const ref = inp.asOf ? new Date(inp.asOf) : now;
  if (inp.lastFilingDate) {
    const days = (ref - new Date(inp.lastFilingDate)) / 86400000;
    if (days > 150) add('STALE_FILING', 'warning', `El último informe financiero tiene ${Math.round(days)} días: puede haber resultados nuevos sin incorporar.`, 'lastFilingDate');
  } else {
    add('FILING_DATE_UNKNOWN', 'info', 'La fecha de publicación del último informe no está disponible; no se puede comprobar si los datos están al día.', 'lastFilingDate');
  }
  // Price after a very large one-day move vs fundamentals that predate it.
  if (isNum(inp.dayChangePct) && Math.abs(inp.dayChangePct) > 0.25) add('PRICE_JUMP', 'info', 'El precio se ha movido con fuerza hoy: los ratios que usan el precio cambian, pero los datos financieros no necesariamente. Comprueba si hay resultados nuevos publicados.', 'price');

  const blocking = issues.filter((i) => i.severity === 'error');
  return { issues, hasErrors: blocking.length > 0, errorCodes: blocking.map((i) => i.code) };
}
