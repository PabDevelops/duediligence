import { getDictionary } from '../../../../lib/i18n/getDictionary';
import StartTrialView from './StartTrialView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es/start-trial' : '/start-trial',
      languages: { en: '/start-trial', es: '/es/start-trial' },
    },
  };
}

export default async function StartTrial({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <StartTrialView dict={dict} />;
}
