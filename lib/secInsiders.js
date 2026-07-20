// SEC Form 4 fetch/parse — shared between app/api/insider-trades/route.js (the raw transaction
// feed shown in Radar's Insider Activity widget) and app/api/stock/route.js (which folds an
// aggregate ownership % into the cached fundamentals for the Quality Score's "skin in the game"
// signal, see computeEasyMode in lib/stockScoring.js). Extracted here instead of duplicated in
// both routes so the two never drift the way lib/marketCap.js almost did with the stock page's
// tier badge.
const SEC_HEADERS = { 'User-Agent': 'DueDiligenceApp contact@example.com' };

// --- tiny XML helpers -------------------------------------------------
// Form 4 filings are flat enough (no repeated tag names nested inside themselves for the
// fields we need) that hand-rolled regex is far cheaper than pulling in an XML parser
// dependency for this one use case.
function tagBlock(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}
// SEC's XML escapes &, <, >, quotes etc. — decode so names/titles like "EVP &amp; CHRO"
// render as "EVP & CHRO" instead of leaking the raw entity into the UI.
function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}
function flatValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? decodeXmlEntities(m[1]) : null;
}
function nestedValue(xml, tag) {
  const block = tagBlock(xml, tag);
  if (block == null) return null;
  const v = block.match(/<value>([^<]*)<\/value>/);
  return v ? v[1] : null;
}
function allBlocks(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
const isTrue = (v) => v === 'true' || v === '1';

export async function fetchRecentForm4Accessions(cik, limit) {
  const cik10 = String(cik).padStart(10, '0');
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik10}.json`, {
    headers: SEC_HEADERS,
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const recent = data?.filings?.recent;
  if (!recent) return [];

  const out = [];
  for (let i = 0; i < recent.form.length && out.length < limit; i++) {
    if (recent.form[i] !== '4') continue;
    out.push({
      accession: recent.accessionNumber[i],
      primaryDocument: recent.primaryDocument[i],
    });
  }
  return out;
}

export function parseForm4Xml(xml, ticker) {
  const ownerBlock = tagBlock(xml, 'reportingOwner') || xml;
  const relBlock = tagBlock(ownerBlock, 'reportingOwnerRelationship') || '';
  const idBlock = tagBlock(ownerBlock, 'reportingOwnerId') || '';
  const insider = flatValue(idBlock, 'rptOwnerName') || 'Unknown';

  const isOfficer = isTrue(flatValue(relBlock, 'isOfficer'));
  const isDirector = isTrue(flatValue(relBlock, 'isDirector'));
  const isTenPercentOwner = isTrue(flatValue(relBlock, 'isTenPercentOwner'));
  const officerTitle = flatValue(relBlock, 'officerTitle');
  const role = officerTitle || (isDirector ? 'Director' : isTenPercentOwner ? '10% Owner' : null);

  return allBlocks(xml, 'nonDerivativeTransaction').map(block => {
    const date = nestedValue(block, 'transactionDate');
    const codingBlock = tagBlock(block, 'transactionCoding') || '';
    const code = flatValue(codingBlock, 'transactionCode');
    const sharesRaw = nestedValue(block, 'transactionShares');
    const priceRaw = nestedValue(block, 'transactionPricePerShare');
    const disposedCode = nestedValue(block, 'transactionAcquiredDisposedCode');
    const postBlock = tagBlock(block, 'postTransactionAmounts') || '';
    const sharesAfterRaw = nestedValue(postBlock, 'sharesOwnedFollowingTransaction');

    const shares = sharesRaw != null ? Number(sharesRaw) : null;
    const price = priceRaw != null && priceRaw !== '' ? Number(priceRaw) : null;
    if (!date || !shares) return null;

    return {
      ticker,
      insider,
      role,
      isOfficer,
      isDirector,
      isTenPercentOwner,
      type: disposedCode === 'A' ? 'BUY' : 'SELL',
      code,
      isOpenMarket: code === 'P' || code === 'S',
      shares,
      price,
      value: price ? +(shares * price).toFixed(2) : null,
      date,
      sharesOwnedAfter: sharesAfterRaw != null ? Number(sharesAfterRaw) : null,
    };
  }).filter(Boolean);
}

// Fetches and parses the most recent Form 4s for a known CIK. Callers that don't already have
// a CIK (e.g. app/api/insider-trades/route.js, which resolves one from a ticker via its own
// directory lookup) do that resolution themselves and pass the result in here.
export async function fetchForm4Transactions(cik, ticker, limit) {
  const accessions = await fetchRecentForm4Accessions(cik, limit);
  if (accessions.length === 0) return [];

  const cikNoPad = String(Number(cik));
  const results = await Promise.all(
    accessions.map(async ({ accession, primaryDocument }) => {
      try {
        const accNoDashes = accession.replace(/-/g, '');
        const filename = primaryDocument.split('/').pop();
        const url = `https://www.sec.gov/Archives/edgar/data/${cikNoPad}/${accNoDashes}/${filename}`;
        const res = await fetch(url, { headers: SEC_HEADERS, next: { revalidate: 3600 } });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseForm4Xml(xml, ticker);
      } catch {
        return [];
      }
    })
  );

  return results.flat().sort((a, b) => b.date.localeCompare(a.date));
}

// "Skin in the game": each unique insider's most recent post-transaction share count, summed
// and divided by shares outstanding. Approximate by construction — it only reflects insiders
// who filed a Form 4 within the fetched window (`limit` most recent filings), not a full
// beneficial-ownership register from a proxy statement, so a long-tenured insider who hasn't
// transacted recently can be missed entirely. Directionally useful without a second data
// source: the insiders who *do* show up here are, definitionally, the actively-filing ones,
// which in practice are the officers/directors/10%-owners that matter most for this signal.
// Returns null (never 0) when there's nothing to measure, so the caller can tell "no insider
// ownership" apart from "couldn't determine insider ownership" — see computeEasyMode's
// ownershipScore in lib/stockScoring.js, which treats null as neutral rather than penalizing it.
export function computeInsiderOwnershipPct(transactions, sharesOutstanding) {
  if (!transactions?.length || !sharesOutstanding) return null;
  const latestByInsider = new Map();
  transactions.forEach(t => {
    if (t.sharesOwnedAfter == null) return;
    const existing = latestByInsider.get(t.insider);
    if (!existing || t.date > existing.date) latestByInsider.set(t.insider, t);
  });
  if (latestByInsider.size === 0) return null;
  const totalShares = [...latestByInsider.values()].reduce((sum, t) => sum + t.sharesOwnedAfter, 0);
  if (totalShares <= 0) return null;
  return +((totalShares / sharesOutstanding) * 100).toFixed(2);
}
