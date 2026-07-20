// Stock/ETF detail links open in a new tab everywhere in the app — browsing a list
// (Calendar, Watchlist, Screener, etc.) or searching for a ticker shouldn't lose your
// place on the current page.
export function openInNewTab(path) {
  window.open(path, '_blank', 'noopener,noreferrer');
}
