import { getSecTickerDirectory } from '../../../lib/secTickers';
import { fetchForm4Transactions } from '../../../lib/secInsiders';

const FH_KEY = process.env.FINNHUB_API_KEY;
const DEFAULT_LIMIT = 20;

// --- SEC EDGAR Form 4 path (primary source for US-listed tickers) -----
async function fetchCik(ticker) {
  const list = await getSecTickerDirectory();
  const match = list.find(c => c.ticker.toUpperCase() === ticker);
  return match ? match.cik : null;
}

async function fetchFromSec(ticker, limit) {
  const cik = await fetchCik(ticker);
  if (!cik) return null;
  const transactions = await fetchForm4Transactions(cik, ticker, limit);
  return transactions.length ? transactions : null;
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
