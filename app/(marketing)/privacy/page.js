import { getDictionary } from '../../../lib/i18n/getDictionary';
import PrivacyView from './PrivacyView';

export const metadata = {
  alternates: {
    canonical: '/privacy',
  },
};

export default function Privacy() {
  const dict = getDictionary();
  return <PrivacyView dict={dict} />;
}
