import { getDictionary } from '../../../lib/i18n/getDictionary';
import TermsView from './TermsView';

export const metadata = {
  alternates: {
    canonical: '/terms',
  },
};

export default function Terms() {
  const dict = getDictionary();
  return <TermsView dict={dict} />;
}
