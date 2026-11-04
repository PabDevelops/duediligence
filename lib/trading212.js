// Minimal Trading 212 public API client — read-only (portfolio + account
// cash), never places orders. Live trading only (https://live.trading212.com),
// not the demo/paper environment — the whole point is syncing real holdings.
//
// The raw-API-key Authorization header (no Basic/Bearer prefix) is confirmed
// working against a real account as of the first successful connection —
// Trading 212 returned 404s (bad path), not 401s (bad auth), so this part
// was right from the start.
const BASE_URL = 'https://live.trading212.com/api/v0';

export function authHeader(apiKey) {
  return { Authorization: apiKey };
}

class Trading212Error extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'Trading212Error';
    this.status = status;
  }
}

async function request(path, apiKey) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers: authHeader(apiKey) });
  } catch (err) {
    throw new Trading212Error(`No se pudo contactar con Trading 212: ${err.message}`, 0);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.clone().json();
      detail = body?.message || body?.error || JSON.stringify(body);
    } catch {
      // Non-JSON error body (plain text, or empty) — still worth showing
      // instead of silently falling back to a generic message.
      try { detail = (await res.text()).trim(); } catch { /* genuinely empty */ }
    }

    // Always include the path — fetchAccount() makes two calls (cash + info)
    // and without this, a 401/403 on either one looks identical in the UI.
    const suffix = ` (${path})`;
    if (res.status === 401) {
      throw new Trading212Error((detail || 'La clave de Trading 212 no es válida o le faltan permisos.') + suffix, 401);
    }
    if (res.status === 429) {
      throw new Trading212Error('Trading 212 está limitando las peticiones — inténtalo de nuevo en unos segundos.' + suffix, 429);
    }
    throw new Trading212Error((detail || `Trading 212 respondió ${res.status} ${res.statusText}`) + suffix, res.status);
  }

  return res.json();
}

// Account data is two separate endpoints, not one combined "/equity/account"
// (that 404s — confirmed against a real account). Both paths confirmed
// against Trading 212's own docs (docs.trading212.com/api/account-data,
// .../api/accounts/getaccountsummary):
//   GET /equity/account/cash — { free, blocked, invested, pieCash, ppl, total }
//     (1 req/2s). `free` is cash available to invest, not reserved for orders.
//     This is the one that actually matters (it's the real cash balance),
//     and the one every real-key test so far has been able to read.
//   GET /equity/account/info — { currencyCode, id } — account's base currency
//     and account number. Confirmed, against a real account, to 401 under a
//     scope the "Account data"/"Portfolio" permissions don't cover (possibly
//     "Metadata", which this app's own setup guide tells users to leave
//     off) — so this call is optional: if it fails, cash still goes through
//     and the account still connects, just without a confirmed currency
//     (callers fall back to 'USD').
export async function fetchAccount(apiKey) {
  const cash = await request('/equity/account/cash', apiKey);
  let info = null;
  try {
    info = await request('/equity/account/info', apiKey);
  } catch (err) {
    console.error('Trading212 /equity/account/info failed (non-fatal):', err.message);
  }
  return { ...cash, ...info };
}

// GET /equity/portfolio — every open position. Trading 212 doesn't expose
// individual lots here, just one aggregate row per ticker (quantity,
// averagePrice, ppl, initialFillDate, ...) — matches the single-row-per-
// ticker shape portfolio_holdings already uses for a synced account.
// Confirmed fields (docs.trading212.com/api/personal-portfolio): averagePrice,
// currentPrice, frontend, fxPpl, initialFillDate, maxBuy, maxSell,
// pieQuantity, ppl, quantity, ticker. Two things that cost real debugging
// time, now confirmed: `ticker` is a suffixed instrument code like
// "AAPL_US_EQ", not a plain ticker (see normalizeTicker() in
// trading212Sync.js) — and there is no currency field on a position at all,
// so cost_basis_currency falls back to the account's own currencyCode
// (lib/trading212Sync.js), which is right for a USD stock in a USD account
// but not necessarily for e.g. a GBP-listed stock in a USD account.
export async function fetchPortfolio(apiKey) {
  return request('/equity/portfolio', apiKey);
}

// GET /equity/history/orders — filled/executed orders, for the "Actividad
// reciente" feed. Path and rate limit (20 req/min) confirmed against
// Trading 212's own docs reference; the response shape below is a best
// guess from third-party examples, not the official schema table (which
// wasn't reachable) — see the field mapping in trading212Sync.js for what's
// actually trusted vs. defensively null-checked.
// Expected shape: { items: [{ id, ticker, status, filledQuantity, fillPrice,
// fillCost, dateCreated, dateExecuted }], nextPagePath }. This only reads the
// first page (up to `limit`) — deep pagination is deferred until a real key
// confirms whether items come back newest-first or oldest-first.
export async function fetchOrderHistory(apiKey, { limit = 50 } = {}) {
  return request(`/equity/history/orders?limit=${limit}`, apiKey);
}

// GET /equity/history/dividends — dividend payments, for the same feed.
// Endpoint path is genuinely ambiguous between this and /history/dividends
// (without the equity/ prefix) — two different Trading 212 doc pages
// disagree. Going with the equity/-prefixed one for consistency with the
// other two endpoints; if this 404s with a real key, dropping "equity/" is
// the fix.
export async function fetchDividendHistory(apiKey, { limit = 50 } = {}) {
  return request(`/equity/history/dividends?limit=${limit}`, apiKey);
}
