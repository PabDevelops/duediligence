const BASE_URL = 'https://traqcker.com';

// The terminal (screener, compare, watchlist, stock/[ticker], blog, etc.) now
// lives behind sign-up + an active subscription on terminal.traqcker.com, so
// it has no business being crawled/indexed under the public marketing site.
// Only the informational pages that are actually public belong here.
export default async function sitemap() {
  return [
    { url: BASE_URL,                        changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/pricing`,           changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/about`,             changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/sign-up`,           changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${BASE_URL}/sign-in`,           changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
