import SuccessView from './SuccessView';

export const metadata = {
  title: 'Pago completado — Bulltrace',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/success',
  },
};

export default function Success() {
  return <SuccessView />;
}
