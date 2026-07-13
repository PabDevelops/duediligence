import { LOCALES } from '../../lib/i18n/locale';

export function generateStaticParams() {
  return LOCALES.map(locale => ({ locale }));
}

export const dynamicParams = false;

export default async function LocaleLayout({ children }) {
  return children;
}
