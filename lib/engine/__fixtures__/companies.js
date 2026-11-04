// SYNTHETIC test fixtures. They are stylized profiles that mimic the *shape* of well known
// business types (mature software, diversified retailer, staples, auto cyclical, bank, REIT,
// loss-making grower...). They are NOT real financial statements and must never be shown to
// users or quoted as the real figures of any company. They exist only to prove the engine
// behaves sensibly across different business models.

export const hist = (endYear, values) => values.map((val, i) => ({ year: String(endYear - (values.length - 1 - i)), val }));
const B = 1e9, M = 1e6;
const RF = 0.043;

function base(o) {
  return { riskFreeRate: RF, currency: 'USD', beta: 1.0, ...o };
}

export const msftLike = base({
  ticker: 'SYN-MATURE', name: 'Mature Software (synthetic)', sector: 'Technology', industry: 'Software - Infrastructure', beta: 0.9,
  currentPrice: 420, sharesOutstanding: 7.4 * B, marketCap: 420 * 7.4 * B,
  revVal: 280 * B, gpVal: 195 * B, oiVal: 123 * B, niVal: 101 * B, ebtVal: 120 * B, taxVal: 19 * B, fcfVal: 70 * B, sbcVal: 12 * B, daVal: 22 * B, capexVal: 44 * B,
  debtVal: 45 * B, cashVal: 95 * B, assetsVal: 520 * B, currentLiabilitiesVal: 125 * B, currentAssetsVal: 160 * B, equityVal: 270 * B, interestVal: 2.5 * B,
  roic: 31, opMargin: 43.9, grossMargin: 69.6, netMargin: 36, revGrowth: 14, roe: 37, shareDilution: -1.5, eps: 13.6, forwardPE: 29, pe: 31, evEbitda: 21, roa: 19, priceToBook: 11,
  revHistory: hist(2025, [143 * B, 168 * B, 198 * B, 212 * B, 245 * B, 280 * B]),
  oiHistory: hist(2025, [53 * B, 70 * B, 83 * B, 89 * B, 109 * B, 123 * B]),
  niHistory: hist(2025, [44 * B, 61 * B, 72 * B, 73 * B, 88 * B, 101 * B]),
  fcfHistory: hist(2025, [45 * B, 56 * B, 65 * B, 59 * B, 74 * B, 70 * B]),
  sharesHistory: hist(2025, [7.6 * B, 7.55 * B, 7.5 * B, 7.46 * B, 7.43 * B, 7.4 * B]),
  assetsHistory: hist(2025, [300 * B, 333 * B, 365 * B, 411 * B, 470 * B, 520 * B]),
  currentLiabilitiesHistory: hist(2025, [72 * B, 88 * B, 95 * B, 105 * B, 115 * B, 125 * B]),
  debtHistory: hist(2025, [60 * B, 55 * B, 50 * B, 48 * B, 46 * B, 45 * B]),
  equityHistory: hist(2025, [140 * B, 166 * B, 183 * B, 206 * B, 238 * B, 270 * B]),
  gpHistory: hist(2025, [96 * B, 115 * B, 135 * B, 146 * B, 171 * B, 195 * B]),
  lastFilingDate: '2025-10-29',
});

export const amznLike = base({
  ticker: 'SYN-DIVERS', name: 'Diversified Reinvestor (synthetic)', sector: 'Consumer Cyclical', industry: 'Internet Retail', beta: 1.2,
  currentPrice: 190, sharesOutstanding: 10.5 * B, marketCap: 190 * 10.5 * B,
  revVal: 640 * B, gpVal: 300 * B, oiVal: 60 * B, niVal: 50 * B, ebtVal: 62 * B, taxVal: 11 * B, fcfVal: 40 * B, sbcVal: 24 * B, daVal: 55 * B, capexVal: 95 * B,
  debtVal: 60 * B, cashVal: 90 * B, assetsVal: 600 * B, currentLiabilitiesVal: 170 * B, currentAssetsVal: 190 * B, equityVal: 300 * B, interestVal: 3 * B,
  roic: 14, opMargin: 9.4, grossMargin: 46.9, netMargin: 7.8, revGrowth: 10, roe: 17, shareDilution: 2, eps: 4.8, forwardPE: 32, pe: 40, evEbitda: 14, roa: 8, priceToBook: 6.5,
  revHistory: hist(2025, [386 * B, 470 * B, 514 * B, 575 * B, 638 * B, 640 * B]),
  oiHistory: hist(2025, [22 * B, 24.9 * B, -2.7 * B, 36.9 * B, 68.6 * B, 60 * B]),
  niHistory: hist(2025, [21 * B, 33 * B, -2.7 * B, 30 * B, 59 * B, 50 * B]),
  fcfHistory: hist(2025, [31 * B, -9 * B, -12 * B, 36 * B, 38 * B, 40 * B]),
  sharesHistory: hist(2025, [10.1 * B, 10.2 * B, 10.2 * B, 10.4 * B, 10.5 * B, 10.5 * B]),
  assetsHistory: hist(2025, [321 * B, 420 * B, 462 * B, 528 * B, 588 * B, 600 * B]),
  currentLiabilitiesHistory: hist(2025, [126 * B, 142 * B, 155 * B, 164 * B, 168 * B, 170 * B]),
  debtHistory: hist(2025, [30 * B, 50 * B, 67 * B, 58 * B, 55 * B, 60 * B]),
  equityHistory: hist(2025, [93 * B, 138 * B, 146 * B, 201 * B, 285 * B, 300 * B]),
  lastFilingDate: '2025-10-30',
});

export const cokeLike = base({
  ticker: 'SYN-STAPLE', name: 'Moderate-growth Staples (synthetic)', sector: 'Consumer Defensive', industry: 'Beverages - Non-Alcoholic', beta: 0.6,
  currentPrice: 62, sharesOutstanding: 4.3 * B, marketCap: 62 * 4.3 * B,
  revVal: 47 * B, gpVal: 28 * B, oiVal: 13.2 * B, niVal: 10.7 * B, ebtVal: 13 * B, taxVal: 2.4 * B, fcfVal: 9 * B, sbcVal: 0.25 * B, daVal: 1.1 * B, capexVal: 2 * B,
  debtVal: 42 * B, cashVal: 14 * B, assetsVal: 100 * B, currentLiabilitiesVal: 20 * B, currentAssetsVal: 26 * B, equityVal: 25 * B, interestVal: 1.5 * B, dividendsPaidVal: 8 * B,
  roic: 16, opMargin: 28, grossMargin: 59.6, netMargin: 22.8, revGrowth: 3, roe: 42, shareDilution: -1, eps: 2.5, forwardPE: 22, pe: 25, evEbitda: 20, roa: 11, priceToBook: 10,
  revHistory: hist(2025, [33 * B, 38.7 * B, 43 * B, 45.8 * B, 47 * B, 47.6 * B]),
  oiHistory: hist(2025, [9.8 * B, 10.3 * B, 10.9 * B, 12.8 * B, 13.1 * B, 13.2 * B]),
  niHistory: hist(2025, [7.7 * B, 9.8 * B, 9.5 * B, 10.7 * B, 10.6 * B, 10.7 * B]),
  fcfHistory: hist(2025, [8.3 * B, 10.2 * B, 11.2 * B, 9.7 * B, 6 * B, 9 * B]),
  sharesHistory: hist(2025, [4.32 * B, 4.33 * B, 4.33 * B, 4.32 * B, 4.31 * B, 4.3 * B]),
  assetsHistory: hist(2025, [87 * B, 94 * B, 94 * B, 97 * B, 100 * B, 100 * B]),
  currentLiabilitiesHistory: hist(2025, [14 * B, 14.6 * B, 20 * B, 19 * B, 20 * B, 20 * B]),
  debtHistory: hist(2025, [40 * B, 38 * B, 39 * B, 40 * B, 42 * B, 42 * B]),
  equityHistory: hist(2025, [19 * B, 24 * B, 24 * B, 25 * B, 25 * B, 25 * B]),
  lastFilingDate: '2025-10-21',
});

// Cyclical: huge dip in 2020 and a margin peak in 2022.
export const fordLike = base({
  ticker: 'SYN-CYCLE', name: 'Auto Cyclical (synthetic)', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', beta: 1.5,
  currentPrice: 11, sharesOutstanding: 3.98 * B, marketCap: 11 * 3.98 * B,
  revVal: 176 * B, gpVal: 12 * B, oiVal: 6 * B, niVal: 4.3 * B, ebtVal: 5.3 * B, taxVal: 0.9 * B, fcfVal: 5 * B, sbcVal: 0.25 * B, daVal: 6 * B, capexVal: 8.5 * B,
  debtVal: 150 * B, cashVal: 30 * B, assetsVal: 280 * B, currentLiabilitiesVal: 110 * B, currentAssetsVal: 125 * B, equityVal: 44 * B, interestVal: 8 * B,
  roic: 5, opMargin: 3.4, grossMargin: 6.8, netMargin: 2.4, revGrowth: 2, roe: 9.8, shareDilution: 1.5, eps: 1.08, forwardPE: 8, pe: 10, evEbitda: 14, roa: 1.5, priceToBook: 1.0,
  revHistory: hist(2025, [155 * B, 126 * B, 136 * B, 158 * B, 176 * B, 176 * B]),
  oiHistory: hist(2025, [2.8 * B, -1.8 * B, 7.5 * B, -3 * B, 5.2 * B, 6 * B]),
  niHistory: hist(2025, [-0.4 * B, -1.3 * B, 17.9 * B, -2 * B, 4.3 * B, 4.3 * B]),
  fcfHistory: hist(2025, [3 * B, -2 * B, 8 * B, 1 * B, 6 * B, 5 * B]),
  sharesHistory: hist(2025, [3.9 * B, 3.95 * B, 4.0 * B, 4.0 * B, 3.97 * B, 3.98 * B]),
  assetsHistory: hist(2025, [258 * B, 255 * B, 255 * B, 270 * B, 280 * B, 280 * B]),
  currentLiabilitiesHistory: hist(2025, [100 * B, 100 * B, 105 * B, 108 * B, 110 * B, 110 * B]),
  debtHistory: hist(2025, [150 * B, 148 * B, 147 * B, 149 * B, 150 * B, 150 * B]),
  equityHistory: hist(2025, [33 * B, 34 * B, 48 * B, 43 * B, 44 * B, 44 * B]),
  lastFilingDate: '2025-10-30',
});

export const bankLike = base({
  ticker: 'SYN-BANK', name: 'Regional Bank (synthetic)', sector: 'Financial Services', industry: 'Banks - Regional', beta: 1.1,
  currentPrice: 38, sharesOutstanding: 1.4 * B, marketCap: 38 * 1.4 * B,
  revVal: 22 * B, niVal: 4.8 * B, oiVal: 6.2 * B, ebtVal: 6.2 * B, taxVal: 1.4 * B, equityVal: 40 * B, assetsVal: 520 * B, dividendsPaidVal: 2 * B,
  roe: 12, roa: 0.9, netMargin: 21.8, revGrowth: 4, priceToBook: 1.33, pe: 11, eps: 3.4, shareDilution: -2,
  revHistory: hist(2025, [18 * B, 18.5 * B, 19.5 * B, 21 * B, 21.2 * B, 22 * B]),
  niHistory: hist(2025, [3.2 * B, 4.4 * B, 4.2 * B, 4.0 * B, 4.6 * B, 4.8 * B]),
  oiHistory: hist(2025, [4.2 * B, 5.6 * B, 5.4 * B, 5.2 * B, 5.9 * B, 6.2 * B]),
  equityHistory: hist(2025, [34 * B, 36 * B, 33 * B, 36 * B, 38 * B, 40 * B]),
  sharesHistory: hist(2025, [1.5 * B, 1.48 * B, 1.46 * B, 1.44 * B, 1.42 * B, 1.4 * B]),
  lastFilingDate: '2025-10-17',
});

export const reitLike = base({
  ticker: 'SYN-REIT', name: 'Retail REIT (synthetic)', sector: 'Real Estate', industry: 'REIT - Retail', beta: 0.9,
  currentPrice: 55, sharesOutstanding: 0.3 * B, marketCap: 55 * 0.3 * B,
  revVal: 4 * B, oiVal: 1.9 * B, niVal: 0.8 * B, daVal: 1.3 * B, ebtVal: 0.85 * B, taxVal: 0.01 * B, fcfVal: 2.5 * B, debtVal: 9 * B, cashVal: 0.4 * B, equityVal: 4 * B, assetsVal: 17 * B, interestVal: 0.45 * B,
  opMargin: 47.5, netMargin: 20, revGrowth: 3, roe: 20, priceToBook: 4.1, pe: 20.6, shareDilution: 1,
  revHistory: hist(2025, [3.4 * B, 3.6 * B, 3.8 * B, 3.9 * B, 3.9 * B, 4 * B]),
  oiHistory: hist(2025, [1.5 * B, 1.7 * B, 1.8 * B, 1.8 * B, 1.85 * B, 1.9 * B]),
  sharesHistory: hist(2025, [0.29 * B, 0.29 * B, 0.3 * B, 0.3 * B, 0.3 * B, 0.3 * B]),
  lastFilingDate: '2025-10-30',
});

// Negative EBITDA, structurally loss-making grower.
export const negEbitda = base({
  ticker: 'SYN-LOSS', name: 'Loss-making Grower (synthetic)', sector: 'Technology', industry: 'Software - Application', beta: 1.8,
  currentPrice: 12, sharesOutstanding: 100 * M, marketCap: 1200 * M,
  revVal: 300 * M, gpVal: 210 * M, oiVal: -40 * M, niVal: -45 * M, ebtVal: -45 * M, taxVal: 0.5 * M, fcfVal: -20 * M, sbcVal: 35 * M, daVal: 10 * M, capexVal: 8 * M,
  debtVal: 0, cashVal: 200 * M, assetsVal: 420 * M, currentLiabilitiesVal: 90 * M, currentAssetsVal: 260 * M, equityVal: 280 * M,
  roic: null, opMargin: -13.3, grossMargin: 70, netMargin: -15, revGrowth: 40, evEbitda: -33, shareDilution: 22, eps: -0.45,
  revHistory: hist(2025, [60 * M, 105 * M, 160 * M, 215 * M, 300 * M]),
  oiHistory: hist(2025, [-60 * M, -62 * M, -58 * M, -50 * M, -40 * M]),
  niHistory: hist(2025, [-62 * M, -65 * M, -60 * M, -52 * M, -45 * M]),
  fcfHistory: hist(2025, [-50 * M, -55 * M, -45 * M, -30 * M, -20 * M]),
  sharesHistory: hist(2025, [80 * M, 84 * M, 90 * M, 95 * M, 100 * M]),
  lastFilingDate: '2025-10-30',
});

// Profitable but negative free cash flow (heavy capex).
export const negFcf = base({
  ticker: 'SYN-NEGFCF', name: 'Profitable, Cash Burning (synthetic)', sector: 'Industrials', industry: 'Specialty Business Services', beta: 1.1,
  currentPrice: 20, sharesOutstanding: 100 * M, marketCap: 2000 * M,
  revVal: 1500 * M, gpVal: 450 * M, oiVal: 150 * M, niVal: 90 * M, ebtVal: 118 * M, taxVal: 28 * M, fcfVal: -60 * M, sbcVal: 10 * M, daVal: 80 * M, capexVal: 260 * M,
  debtVal: 700 * M, cashVal: 120 * M, assetsVal: 2400 * M, currentLiabilitiesVal: 380 * M, currentAssetsVal: 700 * M, equityVal: 1100 * M, interestVal: 42 * M,
  roic: 7.2, opMargin: 10, grossMargin: 30, netMargin: 6, revGrowth: 18, roe: 8.2, shareDilution: 3, eps: 0.9,
  revHistory: hist(2025, [900 * M, 1000 * M, 1150 * M, 1280 * M, 1500 * M]),
  oiHistory: hist(2025, [90 * M, 100 * M, 118 * M, 130 * M, 150 * M]),
  niHistory: hist(2025, [50 * M, 58 * M, 70 * M, 78 * M, 90 * M]),
  fcfHistory: hist(2025, [20 * M, 10 * M, -10 * M, -35 * M, -60 * M]),
  sharesHistory: hist(2025, [94 * M, 95 * M, 97 * M, 99 * M, 100 * M]),
  assetsHistory: hist(2025, [1500 * M, 1700 * M, 1900 * M, 2150 * M, 2400 * M]),
  currentLiabilitiesHistory: hist(2025, [250 * M, 280 * M, 320 * M, 350 * M, 380 * M]),
  lastFilingDate: '2025-10-30',
});

// Strong dilution: shares +60% over history.
export const dilutive = base({
  ticker: 'SYN-DILUTE', name: 'Heavy Dilution (synthetic)', sector: 'Healthcare', industry: 'Medical Devices', beta: 1.4,
  currentPrice: 15, sharesOutstanding: 160 * M, marketCap: 2400 * M,
  revVal: 400 * M, gpVal: 280 * M, oiVal: 24 * M, niVal: 12 * M, ebtVal: 20 * M, taxVal: 4 * M, fcfVal: 30 * M, sbcVal: 55 * M, daVal: 15 * M, capexVal: 12 * M,
  debtVal: 50 * M, cashVal: 150 * M, assetsVal: 700 * M, currentLiabilitiesVal: 100 * M, currentAssetsVal: 330 * M, equityVal: 520 * M, interestVal: 3 * M,
  roic: 4, opMargin: 6, grossMargin: 70, netMargin: 3, revGrowth: 25, roe: 2.3, shareDilution: 60, eps: 0.08,
  revHistory: hist(2025, [160 * M, 210 * M, 270 * M, 330 * M, 400 * M]),
  oiHistory: hist(2025, [-10 * M, 0, 8 * M, 16 * M, 24 * M]),
  niHistory: hist(2025, [-12 * M, -4 * M, 2 * M, 8 * M, 12 * M]),
  fcfHistory: hist(2025, [-8 * M, 2 * M, 14 * M, 22 * M, 30 * M]),
  sharesHistory: hist(2025, [100 * M, 115 * M, 130 * M, 145 * M, 160 * M]),
  assetsHistory: hist(2025, [300 * M, 400 * M, 500 * M, 600 * M, 700 * M]),
  currentLiabilitiesHistory: hist(2025, [50 * M, 65 * M, 80 * M, 90 * M, 100 * M]),
  lastFilingDate: '2025-10-30',
});

// ---- Test cases named in the brief. Figures are the ones the user quoted; every other
// ---- field is either left null (engine must say N/D) or labelled as synthetic completion.

// Only the values BullTrace displayed on 2026-11-04. Nothing else is known.
export const crctQuotedOnly = {
  ticker: 'CRCT', name: 'Cricut (only the figures quoted in the brief)', sector: 'Technology', industry: 'Consumer Electronics',
  currency: 'USD', riskFreeRate: RF, currentPrice: 8.81, roic: 20.8, pfcf: 12.4, pe: 25.2, revGrowth: -5.7,
};

// Synthetic completion consistent with those quoted ratios (NOT Cricut's real statements).
const crctShares = 215 * M;
const crctMc = 8.81 * crctShares;
export const crctSynthetic = base({
  ticker: 'CRCT-SYN', name: 'Cricut-like (synthetic completion of quoted ratios)', sector: 'Technology', industry: 'Consumer Electronics', beta: 1.3,
  currentPrice: 8.81, sharesOutstanding: crctShares, marketCap: crctMc,
  revVal: 690 * M, gpVal: 270 * M, oiVal: 110 * M, niVal: crctMc / 25.2, ebtVal: 118 * M, taxVal: 26 * M, fcfVal: crctMc / 12.4, sbcVal: 25 * M, daVal: 12 * M, capexVal: 15 * M,
  debtVal: 0, cashVal: 300 * M, assetsVal: 800 * M, currentLiabilitiesVal: 190 * M, currentAssetsVal: 560 * M, equityVal: 520 * M,
  roic: 20.8, opMargin: 15.9, grossMargin: 39, netMargin: 10.9, revGrowth: -5.7, roe: 14.5, shareDilution: 0.5, pe: 25.2,
  revHistory: hist(2025, [1310 * M, 973 * M, 819 * M, 764 * M, 732 * M, 690 * M]),
  oiHistory: hist(2025, [215 * M, 75 * M, 70 * M, 88 * M, 105 * M, 110 * M]),
  niHistory: hist(2025, [186 * M, 60 * M, 55 * M, 63 * M, 72 * M, crctMc / 25.2]),
  fcfHistory: hist(2025, [-38 * M, 20 * M, 140 * M, 130 * M, 150 * M, crctMc / 12.4]),
  sharesHistory: hist(2025, [215 * M, 216 * M, 215 * M, 214 * M, 215 * M, 215 * M]),
  assetsHistory: hist(2025, [900 * M, 840 * M, 790 * M, 780 * M, 800 * M, 800 * M]),
  currentLiabilitiesHistory: hist(2025, [310 * M, 240 * M, 210 * M, 200 * M, 195 * M, 190 * M]),
  lastFilingDate: '2025-10-30',
});

// MNTN pattern: quoted ratios mix a positive ROIC with a negative EV/EBITDA and negative
// operating income. Completion is synthetic and only exists to test period-coherence checks.
export const mntnSynthetic = base({
  ticker: 'MNTN-SYN', name: 'MNTN-like (synthetic completion of quoted ratios)', sector: 'Communication Services', industry: 'Advertising Agencies', beta: 1.6,
  currentPrice: 18, sharesOutstanding: 75 * M, marketCap: 33.56 * 40 * M,
  revVal: 290 * M, gpVal: 0.808 * 290 * M, oiVal: -22 * M, niVal: -55 * M, ebtVal: -52 * M, taxVal: 0.5 * M, fcfVal: 40 * M, sbcVal: 60 * M, daVal: 5 * M, capexVal: 6 * M,
  debtVal: 0, cashVal: 237 * M, assetsVal: 420 * M, currentLiabilitiesVal: 90 * M, currentAssetsVal: 380 * M, equityVal: 250 * M,
  roic: 13.2, opMargin: -7.6, grossMargin: 80.8, netMargin: -19, revGrowth: 28, evEbitda: -1.5, shareDilution: 35, eps: -0.7, pfcf: 33.56,
  revHistory: hist(2025, [200 * M, 225 * M, 290 * M]),
  oiHistory: hist(2025, [-30 * M, -28 * M, -22 * M]),
  niHistory: hist(2025, [-40 * M, -35 * M, -55 * M]),
  fcfHistory: hist(2025, [-10 * M, 12 * M, 40 * M]),
  sharesHistory: hist(2025, [55 * M, 60 * M, 75 * M]),
  lastFilingDate: '2025-10-30',
});

export const ALL_SYNTHETIC = { msftLike, amznLike, cokeLike, fordLike, bankLike, reitLike, negEbitda, negFcf, dilutive, crctSynthetic, mntnSynthetic, crctQuotedOnly };
