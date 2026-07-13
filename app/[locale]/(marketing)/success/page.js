import { getDictionary } from '../../../../lib/i18n/getDictionary';
import SuccessView from './SuccessView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es/success' : '/success',
      languages: { en: '/success', es: '/es/success' },
    },
  };
}

export default async function Success({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <SuccessView dict={dict} locale={locale} />;
}
