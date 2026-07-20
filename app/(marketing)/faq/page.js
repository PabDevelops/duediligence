import { getDictionary } from '../../../lib/i18n/getDictionary';
import FaqView from './FaqView';

export const metadata = {
  title: 'FAQ — Traqcker',
  description: 'Common questions about Traqcker: what it is, how the GARP scoring engine works, coverage, and pricing.',
  alternates: {
    canonical: '/faq',
  },
};

export default function Faq() {
  const dict = getDictionary();
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: dict.faq.items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <FaqView dict={dict} />
    </>
  );
}
