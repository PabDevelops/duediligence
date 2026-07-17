'use client';

// Session-only watchlist for signed-out visitors. Backed by sessionStorage
// (not localStorage) so it clears when the tab closes, matching what the
// guest-facing copy promises — this is a scratchpad, not a saved list.
const KEY = 'tq_guest_watchlist';
export const GUEST_WATCHLIST_LIMIT = 25;

function read() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(tickers) {
  window.sessionStorage.setItem(KEY, JSON.stringify(tickers));
  window.dispatchEvent(new Event('guest-watchlist-changed'));
}

export function getGuestWatchlist() {
  return read();
}

export function isInGuestWatchlist(ticker) {
  return read().includes(ticker.toUpperCase());
}

export function addToGuestWatchlist(ticker) {
  const t = ticker.toUpperCase();
  const current = read();
  if (current.includes(t)) return { tickers: current, added: false, atLimit: false };
  if (current.length >= GUEST_WATCHLIST_LIMIT) return { tickers: current, added: false, atLimit: true };
  const next = [...current, t];
  write(next);
  return { tickers: next, added: true, atLimit: false };
}

export function removeFromGuestWatchlist(ticker) {
  const t = ticker.toUpperCase();
  const next = read().filter(x => x !== t);
  write(next);
  return next;
}

export function clearGuestWatchlist() {
  write([]);
}
