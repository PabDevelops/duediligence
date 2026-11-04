// Point-in-time backtesting harness. It rebuilds, for each historical date, the information a
// user could actually have seen on that date (only filings with filed <= date, price at or
// before date), runs the unchanged V2 engine, and compares with what happened afterwards.
//
// It never tunes parameters. A dataset is accepted as valid only if it can prove it is
// point-in-time (every filing carries its real publication date) and survivorship-free
// (delisted companies included). Otherwise the result is labelled "indicativo" or "no_valido"
// and the reasons are returned: a backtest that cannot reconstruct history correctly must not
// be presented as evidence.
//
// Universe item:
//   { ticker, listedOn, delistedOn?, delistedReturnNote?,
//     filings: [{ periodEnd, filed, fiscalPeriod: 'FY'|'Q1'..., data: { ...fields of /api/stock... } }],
//     prices: [{ date: 'YYYY-MM-DD', close }] }

import { analyzeStock } from './index.js';
import { isNum, mean, median, round } from './util.js';

const toTime = (d) => new Date(d).getTime();

export function lastAtOrBefore(arr, date, key) {
  let best = null;
  for (const x of arr) { if (toTime(x[key]) <= toTime(date) && (!best || toTime(x[key]) > toTime(best[key]))) best = x; }
  return best;
}

// Information set available on `asOf`. Throws if any filing lacks a publication date.
export function pointInTimeView(item, asOf) {
  for (const f of item.filings) {
    if (!f.filed) throw new Error(`Filing ${item.ticker} ${f.periodEnd} sin fecha de publicación: no se puede evitar el sesgo de anticipación.`);
  }
  const visible = item.filings.filter((f) => toTime(f.filed) <= toTime(asOf)).sort((a, b) => toTime(a.filed) - toTime(b.filed));
  if (!visible.length) return null;
  const latest = visible[visible.length - 1];
  const px = lastAtOrBefore(item.prices, asOf, 'date');
  if (!px) return null;
  const data = { ...latest.data, ticker: item.ticker, currentPrice: px.close, asOf, lastFilingDate: latest.filed };
  // Annual histories may only contain years whose annual filing was already public.
  ['revHistory', 'oiHistory', 'niHistory', 'fcfHistory', 'sharesHistory'].forEach((k) => {
    const full = latest.data[k];
    if (Array.isArray(full)) {
      const fyFiled = new Map(item.filings.filter((f) => f.fiscalPeriod === 'FY').map((f) => [String(new Date(f.periodEnd).getUTCFullYear()), f.filed]));
      data[k] = full.filter((h) => { const fl = fyFiled.get(String(h.year)); return fl ? toTime(fl) <= toTime(asOf) : toTime(`${h.year}-12-31`) < toTime(asOf) - 90 * 86400000; });
    }
  });
  if (isNum(data.sharesOutstanding) && !isNum(data.marketCap)) data.marketCap = data.sharesOutstanding * px.close;
  else if (isNum(data.sharesOutstanding)) data.marketCap = data.sharesOutstanding * px.close;
  return { data, asOf, filedUsed: latest.filed, priceDate: px.date };
}

export function assertNoLookahead(view, asOf) {
  if (toTime(view.filedUsed) > toTime(asOf)) throw new Error('Look-ahead: se usó un informe publicado después de la fecha de análisis.');
  if (toTime(view.priceDate) > toTime(asOf)) throw new Error('Look-ahead: se usó un precio posterior a la fecha de análisis.');
  return true;
}

function ranks(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 5) return null;
  const rx = ranks(xs), ry = ranks(ys);
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
}

export function splitDates(dates, trainEnd) {
  return { train: dates.filter((d) => toTime(d) <= toTime(trainEnd)), test: dates.filter((d) => toTime(d) > toTime(trainEnd)) };
}

export function runBacktest({ universe, dates, horizonYears = 1, trainEnd, survivorshipFree = false, analyze = analyzeStock }) {
  const reasons = [];
  const { test } = splitDates(dates, trainEnd);
  if (!survivorshipFree) reasons.push('El universo no garantiza incluir empresas excluidas de cotización (sesgo de supervivencia).');
  if (universe.length < 30) reasons.push(`Solo ${universe.length} empresas: muestra insuficiente para conclusiones.`);
  if (test.length < 3) reasons.push('Menos de 3 fechas de evaluación fuera del periodo de entrenamiento.');

  const records = [];
  const universeChanges = [];
  let prevAlive = new Set();
  for (const d of dates) {
    const alive = new Set();
    for (const item of universe) {
      const listed = toTime(item.listedOn) <= toTime(d) && (!item.delistedOn || toTime(item.delistedOn) > toTime(d));
      if (!listed) continue;
      alive.add(item.ticker);
      const view = pointInTimeView(item, d);
      if (!view) continue;
      assertNoLookahead(view, d);
      const res = analyze(view.data, { asOf: d, now: d });
      const end = new Date(d); end.setUTCFullYear(end.getUTCFullYear() + horizonYears);
      const endDate = end.toISOString().slice(0, 10);
      const p0 = view.data.currentPrice;
      const px1 = lastAtOrBefore(item.prices, endDate, 'date');
      const delistedBefore = item.delistedOn && toTime(item.delistedOn) <= toTime(endDate);
      const pEnd = px1 && toTime(px1.date) > toTime(d) ? px1.close : null;
      const ret = isNum(pEnd) && p0 > 0 ? pEnd / p0 - 1 : null;
      records.push({
        ticker: item.ticker, date: d, quality: res.quality.score, valuation: res.valuation.score, potential: res.potential.score,
        momentum: res.momentum.status, centralCagr: res.entry?.cagr ?? null,
        forwardReturn: ret, annualizedForward: ret != null ? Math.pow(1 + ret, 1 / horizonYears) - 1 : null,
        delistedBeforeEnd: !!delistedBefore,
      });
    }
    const added = [...alive].filter((t) => !prevAlive.has(t));
    const removed = [...prevAlive].filter((t) => !alive.has(t));
    universeChanges.push({ date: d, added, removed, size: alive.size });
    prevAlive = alive;
  }

  const testRecords = records.filter((r) => test.includes(r.date));
  const perDate = test.map((d) => {
    const rs = testRecords.filter((r) => r.date === d && isNum(r.potential) && isNum(r.forwardReturn));
    return { date: d, n: rs.length, spearmanPotential: spearman(rs.map((r) => r.potential), rs.map((r) => r.forwardReturn)), spearmanQuality: spearman(rs.filter((r) => isNum(r.quality)).map((r) => r.quality), rs.filter((r) => isNum(r.quality)).map((r) => r.forwardReturn)) };
  });
  const validIC = perDate.map((p) => p.spearmanPotential).filter(isNum);

  // Score stability: mean absolute change of the same ticker's score between consecutive dates.
  const byTicker = {};
  records.forEach((r) => { (byTicker[r.ticker] ||= []).push(r); });
  const changes = [];
  Object.values(byTicker).forEach((arr) => { for (let i = 1; i < arr.length; i++) if (isNum(arr[i].potential) && isNum(arr[i - 1].potential)) changes.push(Math.abs(arr[i].potential - arr[i - 1].potential)); });

  // Estimation error of the central 5-year CAGR vs. the realized annualized return over the horizon.
  const errs = testRecords.filter((r) => isNum(r.centralCagr) && isNum(r.annualizedForward)).map((r) => r.centralCagr - r.annualizedForward);

  const noScoreShare = records.length ? records.filter((r) => r.potential == null).length / records.length : null;
  const validity = reasons.length === 0 ? 'valido_condicional' : (reasons.some((r) => r.includes('supervivencia')) && reasons.length === 1 ? 'indicativo' : 'no_valido');
  return {
    validity,
    validityReasons: reasons,
    horizonYears, trainEnd, testDates: test,
    note: 'Nunca se optimizan parámetros con estos resultados. Una correlación histórica no demuestra capacidad predictiva.',
    informationCoefficient: { perDate, mean: validIC.length ? round(mean(validIC), 3) : null, median: validIC.length ? round(median(validIC), 3) : null },
    scoreStability: { meanAbsChange: changes.length ? round(mean(changes), 2) : null, observations: changes.length },
    centralCagrError: { meanError: errs.length ? round(mean(errs), 4) : null, meanAbsError: errs.length ? round(mean(errs.map(Math.abs)), 4) : null, n: errs.length },
    coverage: { records: records.length, withoutScoreShare: round(noScoreShare, 3) },
    universeChanges,
    records,
  };
}
