import { getSecTickerDirectory } from '../../../lib/secTickers';

const SEC_UA = 'DueDiligenceApp contact@example.com';

// The handful of filing types worth surfacing on a portfolio dashboard — SEC's submissions
// feed includes every form a company ever files (proxy statements, S-8 plan filings, 13-F/G
// ownership filings by other holders of the ticker, etc.), most of which are noise here.
const RELEVANT_FORMS = new Set(['10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A', '20-F', '20-F/A', '6-K']);

async function fetchRecentFilings(ticker, cik) {
  const cik10 = String(cik).padStart(10, '0');
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik10}.json`, {
      headers: { 'User-Agent': SEC_UA },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const recent = data?.filings?.recent;
    if (!recent?.form) return [];

    const cikNum = String(Number(cik)); // EDGAR archive paths use the CIK without leading zeros
    const out = [];
    for (let i = 0; i < recent.form.length && out.length < 3; i++) {
      const form = recent.form[i];
      if (!RELEVANT_FORMS.has(form)) continue;
      const accession = recent.accessionNumber[i];
      const doc = recent.primaryDocument[i];
      out.push({
        ticker,
        form,
        date: recent.filingDate[i],
        description: recent.primaryDocDescription?.[i] || null,
        url: accession && doc
          ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession.replace(/-/g, '')}/${doc}`
          : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikNum}&type=${form}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');
  const tickers = tickersParam
    ? [...new Set(tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean))].slice(0, 8)
    : [];

  if (tickers.length === 0) return Response.json({ filings: [] });

  try {
    const directory = await getSecTickerDirectory();
    if (!directory) return Response.json({ filings: [] });
    const byTicker = new Map(directory.map(c => [c.ticker.toUpperCase(), c]));

    const results = await Promise.all(
      tickers.map(t => {
        const company = byTicker.get(t);
        // Foreign private issuers and thinly-traded tickers sometimes aren't in SEC's own
        // ticker directory (it only maps EDGAR-registered filers) — nothing to fetch for those.
        return company ? fetchRecentFilings(t, company.cik) : Promise.resolve([]);
      })
    );

    const filings = results.flat().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
    return Response.json({ filings });
  } catch (e) {
    console.error('Error fetching holdings filings:', e);
    return Response.json({ filings: [] });
  }
}
