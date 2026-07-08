import { getSecTickerDirectory } from '../../../lib/secTickers';

const FH_KEY = process.env.FINNHUB_API_KEY;
const SEC_HEADERS = { 'User-Agent': 'DueDiligenceApp contact@example.com' };
const DEFAULT_LIMIT = 20;

// --- tiny XML helpers -------------------------------------------------
// Form 4 filings are flat enough (no repeated tag names nested inside themselves
// for the fields we need) that hand-rolled regex is far cheaper than pulling in an
// XML parser dependency for this one endpoint.
function tagBlock(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}
function flatValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
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

// --- SEC EDGAR Form 4 path (primary source for US-listed tickers) -----
async function fetchCik(ticker) {
  const list = await getSecTickerDirectory();
  const match = list.find(c => c.ticker.toUpperCase() === ticker);
  return match ? match.cik : null;
}

async function fetchRecentForm4Accessions(cik, limit) {
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

function parseForm4Xml(xml, ticker) {
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

async function fetchFromSec(ticker, limit) {
  const cik = await fetchCik(ticker);
  if (!cik) return null;

  const accessions = await fetchRecentForm4Accessions(cik, limit);
  if (accessions.length === 0) return null;

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

// --- Finnhub path (fallback for tickers with no SEC CIK, e.g. int'l listings) --
function normalizeFinnhub(raw, ticker) {
  return (raw?.data || [])
    .filter(t => t.change && t.transactionDate)
    .map(t => ({
      ticker,
      insider: t.name || 'Unknown',
      role: null,
      isOfficer: false,
      isDirector: false,
      isTenPercentOwner: false,
      type: t.change > 0 ? 'BUY' : 'SELL',
      code: t.transactionCode || null,
      isOpenMarket: t.transactionCode === 'P' || t.transactionCode === 'S',
      shares: Math.abs(t.change),
      price: t.transactionPrice || null,
      value: t.transactionPrice ? +(Math.abs(t.change) * t.transactionPrice).toFixed(2) : null,
      date: t.transactionDate,
      sharesOwnedAfter: null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function fetchFromFinnhub(ticker) {
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${FH_KEY}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const raw = await res.json();
  return normalizeFinnhub(raw, ticker);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();
  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 40);

  if (!ticker) {
    return Response.json({ error: 'Ticker requerido' }, { status: 400 });
  }

  try {
    const secTransactions = await fetchFromSec(ticker, limit).catch(() => null);
    if (secTransactions && secTransactions.length > 0) {
      return Response.json({ ticker, source: 'sec', transactions: secTransactions });
    }

    const fhTransactions = await fetchFromFinnhub(ticker).catch(() => []);
    return Response.json({ ticker, source: 'finnhub', transactions: fhTransactions });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error al conectar con las fuentes de datos' }, { status: 500 });
  }
}
