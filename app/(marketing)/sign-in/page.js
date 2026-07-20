import { getDictionary } from '../../../lib/i18n/getDictionary';
import SignInView from './SignInView';

export const metadata = {
  alternates: {
    canonical: '/sign-in',
  },
};

export default function SignIn() {
  const dict = getDictionary();
  return <SignInView dict={dict} />;
}
