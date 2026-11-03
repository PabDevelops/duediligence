import StartTrialView from './StartTrialView';

export const metadata = {
  title: '14 días de Pro gratis — Bulltrace',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/start-trial',
  },
};

export default function StartTrial() {
  return <StartTrialView />;
}
