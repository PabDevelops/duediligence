import { getDictionary } from '../../../../lib/i18n/getDictionary';
import PrivacyView from './PrivacyView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es/privacy' : '/privacy',
      languages: { en: '/privacy', es: '/es/privacy' },
    },
  };
}

export default async function Privacy({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <PrivacyView dict={dict} />;
}
