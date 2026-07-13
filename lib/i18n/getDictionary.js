import en from './dictionaries/en';
import es from './dictionaries/es';

const DICTIONARIES = { en, es };

export function getDictionary(locale) {
  return DICTIONARIES[locale] || DICTIONARIES.en;
}
