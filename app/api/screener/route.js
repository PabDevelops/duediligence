import { getVisitor } from '../../../lib/auth';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';
import { loadScreenerStocks } from '../../../lib/screenerData';
import { normalizeExchange, US_EXCHANGE_GROUPS } from '../../../lib/exchanges';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Guests get a curated, capped slice of the dataset rather than the full
// screener — enough to see real value, not enough to replace registering.
const ANON_RESULT_LIMIT = 40;

// scripts/populateFullMarket.js writes Finnhub's marketCap as-is, with no FX conversion, so a
// stock primary-listed outside the US carries a raw local-currency figure (KRW, IDR, ...) —
// a much bigger *number* than a USD one for a company that's actually far smaller. Sorting
// the full universe by that raw value let those swamp the top of the guest slice (Samsung's
// KRW figure outranking Apple's USD one, etc.), so restrict the candidate pool to rows we can
// trust are USD-denominated: US-domiciled, or trading on a US exchange (ADRs, which the
// on-demand /api/stock pipeline already converts to their USD quote currency on first visit).
const TRUSTED_USD_MARKETS = new Set(US_EXCHANGE_GROUPS);
function isUsdDenominated(stock) {
  return stock.country === 'US' || TRUSTED_USD_MARKETS.has(normalizeExchange(stock.exchange));
}

export async function GET(request) {
  const visitor = await getVisitor();

  if (visitor.type === 'anonymous') {
    const key = `screener:${visitor.id || getClientIp(request)}`;
    const { ok, retryAfterMs } = rateLimit(key, { limit: 20, windowMs: 60 * 60 * 1000 });
    if (!ok) return Response.json({ error: 'Rate limit exceeded', retryAfterMs }, { status: 429 });
  }

  try {
    let stocks = (await loadScreenerStocks()).slice();

    if (visitor.type === 'anonymous') {
      // Slice by market cap, not recency, so guests see recognizable names.
      stocks = stocks
        .filter(isUsdDenominated)
        .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
        .slice(0, ANON_RESULT_LIMIT);
    }

    return Response.json({ stocks, limited: visitor.type === 'anonymous' });
  } catch (e) {
    console.error(e);
    return Response.json({ stocks: [] });
  }
}
