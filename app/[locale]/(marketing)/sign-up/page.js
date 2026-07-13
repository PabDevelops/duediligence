import { getDictionary } from '../../../../lib/i18n/getDictionary';
import SignUpView from './SignUpView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es/sign-up' : '/sign-up',
      languages: { en: '/sign-up', es: '/es/sign-up' },
    },
  };
}

export default async function SignUp({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <SignUpView dict={dict} locale={locale} />;
}
