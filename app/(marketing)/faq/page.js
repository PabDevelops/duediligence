import FaqView from './FaqView';
import { FAQ_ITEMS } from './faqItems';

export const metadata = {
  title: 'Preguntas frecuentes — Bulltrace',
  description: 'Respuestas cortas sobre qué es Bulltrace, cómo funciona la nota de calidad, cobertura y precios.',
  alternates: {
    canonical: '/faq',
  },
};

export default function Faq() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <FaqView />
    </>
  );
}
