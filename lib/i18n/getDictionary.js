import en from './dictionaries/en';

// English-only: /es routes still resolve (for existing links/bookmarks) but
// render the same English copy as /en — see lib/i18n/locale.js.
export function getDictionary() {
  return en;
}
