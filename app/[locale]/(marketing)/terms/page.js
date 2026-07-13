import { getDictionary } from '../../../../lib/i18n/getDictionary';
import TermsView from './TermsView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es/terms' : '/terms',
      languages: { en: '/terms', es: '/es/terms' },
    },
  };
}

export default async function Terms({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <TermsView dict={dict} />;
}
