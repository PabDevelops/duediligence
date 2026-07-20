import { getDictionary } from '../../../lib/i18n/getDictionary';
import SuccessView from './SuccessView';

export const metadata = {
  alternates: {
    canonical: '/success',
  },
};

export default function Success() {
  const dict = getDictionary();
  return <SuccessView dict={dict} />;
}
