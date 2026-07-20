const BASE_URL = 'https://traqcker.com';

// The terminal (screener, compare, watchlist, stock/[ticker], blog, etc.) now
// lives behind sign-up + an active subscription on terminal.traqcker.com, so
// it has no business being crawled/indexed under the public marketing site.
// Only the informational pages that are actually public belong here.
const PAGES = [
  { path: '',          changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/pricing',  changeFrequency: 'monthly', priority: 0.9 },
  { path: '/about',    changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq',      changeFrequency: 'monthly', priority: 0.6 },
  { path: '/sign-up',  changeFrequency: 'yearly',  priority: 0.5 },
  { path: '/sign-in',  changeFrequency: 'yearly',  priority: 0.3 },
];

export default async function sitemap() {
  return PAGES.map(({ path, ...rest }) => ({
    url: `${BASE_URL}${path}`,
    ...rest,
  }));
}
