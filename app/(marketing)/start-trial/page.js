import { getDictionary } from '../../../lib/i18n/getDictionary';
import StartTrialView from './StartTrialView';

export const metadata = {
  alternates: {
    canonical: '/start-trial',
  },
};

export default function StartTrial() {
  const dict = getDictionary();
  return <StartTrialView dict={dict} />;
}
