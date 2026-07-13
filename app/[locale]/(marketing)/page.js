import { getDictionary } from '../../../lib/i18n/getDictionary';
import HomeView from './HomeView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es' : '/',
      languages: { en: '/', es: '/es' },
    },
  };
}

export default async function Home({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <HomeView dict={dict} locale={locale} />;
}
