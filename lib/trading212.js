// Minimal Trading 212 public API client — read-only (portfolio + account
// cash), never places orders. Live trading only (https://live.trading212.com),
// not the demo/paper environment — the whole point is syncing real holdings.
const BASE_URL = 'https://live.trading212.com/api/v0';

// Trading 212 issues TWO credentials when you generate a key — an API Key
// and a separate API Secret, both shown exactly once at generation time and
// never retrievable again — and auth is HTTP Basic with the key as username
// and the secret as password. Confirmed against Trading 212's own API
// quickstart (docs.trading212.com/api/section/general-information/quickstart)
// and Help Centre article on API keys, plus a working third-party
// integration's own connect screen (openbookanalytics.com/learn/guides/how-to-connect-trading-212)
// showing both as separate required fields. This cost real debugging time:
// earlier versions of this file only ever collected one field from the user
// and guessed at Basic-auth with an empty or doubled password, or a bare
// unprefixed key — all three 401'd against a real account, because none of
// them is a real secret.
//
// Since Vault stores one secret value per connected portfolio, both
// credentials are packed into a single JSON string wherever they're
// threaded through this app (connect route → Vault → sync routes → here).
export function packCredentials(apiKey, apiSecret) {
  return JSON.stringify({ k: apiKey, s: apiSecret });
}

class Trading212Error extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'Trading212Error';
    this.status = status;
  }
}

function unpackCredentials(packed) {
  try {
    const { k, s } = JSON.parse(packed);
    if (!k || !s) throw new Error('missing key/secret');
    return { apiKey: k, apiSecret: s };
  } catch {
    // Any portfolio connected before this fix only ever had a bare API key
    // stored, no secret — surface a message that says what to actually do
    // instead of a confusing generic auth failure.
    throw new Trading212Error('Esta cuenta se conectó antes de que la app guardara el secreto de API — desconéctala y vuelve a conectarla con tu clave y tu secreto.', 401);
  }
}

async function extractDetail(res) {
  try {
    const body = await res.clone().json();
    return body?.message || body?.error || JSON.stringify(body);
  } catch {
    // Non-JSON error body (plain text, or empty) — still worth showing
    // instead of silently falling back to a generic message.
    try { return (await res.text()).trim(); } catch { return ''; }
  }
}

async function request(path, credential) {
  const { apiKey, apiSecret } = unpackCredentials(credential);
  const headers = { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` };

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers });
  } catch (err) {
    throw new Trading212Error(`No se pudo contactar con Trading 212: ${err.message}`, 0);
  }

  if (!res.ok) {
    const detail = await extractDetail(res);
    // Always include the path — fetchAccount() makes two calls (cash + info)
    // and without this, a 401/403 on either one looks identical in the UI.
    const suffix = ` (${path})`;
    if (res.status === 401) {
      throw new Trading212Error((detail || 'La clave o el secreto de Trading 212 no son válidos, o le faltan permisos.') + suffix, 401);
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
//   GET /equity/account/info — { currencyCode, id } — account's base currency
//     and account number. Earlier testing saw this 401 while cash succeeded,
//     back when auth itself was still wrong (no real secret) — now that auth
//     uses the real secret this should work too, but it's kept optional
//     (failure doesn't block connecting) since it's just a display nicety.
export async function fetchAccount(credential) {
  const cash = await request('/equity/account/cash', credential);
  let info = null;
  try {
    info = await request('/equity/account/info', credential);
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
export async function fetchPortfolio(credential) {
  return request('/equity/portfolio', credential);
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
export async function fetchOrderHistory(credential, { limit = 50 } = {}) {
  return request(`/equity/history/orders?limit=${limit}`, credential);
}

// GET /equity/history/dividends — dividend payments, for the same feed.
// Endpoint path is genuinely ambiguous between this and /history/dividends
// (without the equity/ prefix) — two different Trading 212 doc pages
// disagree. Going with the equity/-prefixed one for consistency with the
// other two endpoints; if this 404s with a real key, dropping "equity/" is
// the fix.
export async function fetchDividendHistory(credential, { limit = 50 } = {}) {
  return request(`/equity/history/dividends?limit=${limit}`, credential);
}
