// Minimal Trading 212 public API client — read-only (portfolio + account
// cash), never places orders. Live trading only (https://live.trading212.com),
// not the demo/paper environment — the whole point is syncing real holdings.
//
// Auth format is the one unconfirmed detail here (docs.trading212.com wasn't
// reachable while building this): this sends the raw API key as the
// Authorization header value with no Basic/Bearer prefix, which is what
// Trading 212's own API actually expects. If a real key comes back 401 with
// everything else looking right, this is the one line to change.
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
      const body = await res.json();
      detail = body?.message || body?.error || JSON.stringify(body);
    } catch { /* non-JSON error body, fall through to statusText */ }

    if (res.status === 401) {
      throw new Trading212Error(detail || 'La clave de Trading 212 no es válida o le faltan permisos.', 401);
    }
    if (res.status === 429) {
      throw new Trading212Error('Trading 212 está limitando las peticiones — inténtalo de nuevo en unos segundos.', 429);
    }
    throw new Trading212Error(detail || `Trading 212 respondió ${res.status} ${res.statusText}`, res.status);
  }

  return res.json();
}

// GET /equity/account — cash + account-level info. Used both to validate a
// key when connecting (cheapest call that proves the key works and has the
// right scope) and to read the cash balance on every sync.
export async function fetchAccount(apiKey) {
  return request('/equity/account', apiKey);
}

// GET /equity/portfolio — every open position. Trading 212 doesn't expose
// individual lots here, just one aggregate row per ticker (quantity,
// averagePrice, ppl, initialFillDate, ...) — matches the single-row-per-
// ticker shape portfolio_holdings already uses for a synced account.
export async function fetchPortfolio(apiKey) {
  return request('/equity/portfolio', apiKey);
}
