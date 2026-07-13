import { getDictionary } from '../../../../lib/i18n/getDictionary';
import SignInView from './SignInView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es/sign-in' : '/sign-in',
      languages: { en: '/sign-in', es: '/es/sign-in' },
    },
  };
}

export default async function SignIn({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <SignInView dict={dict} locale={locale} />;
}
