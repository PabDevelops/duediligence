// Basket names are stored in the existing watchlists.pie field. Keep legacy names
// exact; only new names are trimmed/limited, so existing assignments stay readable.
export const BASKET_NAME_LIMIT = 80;

export function validateBasketName(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Escribe un nombre para la cesta.';
  if (value.trim().length > BASKET_NAME_LIMIT) return `Usa un máximo de ${BASKET_NAME_LIMIT} caracteres.`;
  return null;
}

export function getBasketNames(tickers, savedNames = []) {
  return [...new Set([...savedNames, ...tickers.map(t => t.pie)].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}
