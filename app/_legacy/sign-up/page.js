import { getDictionary } from '../../../lib/i18n/getDictionary';
import SignUpView from './SignUpView';

export const metadata = {
  alternates: {
    canonical: '/sign-up',
  },
};

export default function SignUp() {
  const dict = getDictionary();
  return <SignUpView dict={dict} />;
}
