import {publicStockTickers} from '../lib/publicStockData';
export const revalidate=3600;
const BASE_URL = 'https://bulltrace.app';

// Public information and company snapshots only. Account/portfolio/watchlist
// pages and the robots-disallowed sign-in routes do not belong in the sitemap.
const PAGES = [
  { path: '',          changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/pricing',  changeFrequency: 'monthly', priority: 0.9 },
  { path: '/about',    changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq',      changeFrequency: 'monthly', priority: 0.6 },
];

export default async function sitemap() {
  const pages=PAGES.map(({ path, ...rest }) => ({
    url: `${BASE_URL}${path}`,
    ...rest,
  }));
  try{return [...pages,...(await publicStockTickers()).map(ticker=>({url:`${BASE_URL}/stock/${encodeURIComponent(ticker)}`,changeFrequency:'daily',priority:0.7}))];}
  catch{return pages;}
}
