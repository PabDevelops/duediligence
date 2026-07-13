import { headers } from 'next/headers';

export default async function robots() {
  const host = (await headers()).get('host') || '';

  // The terminal itself is behind sign-up + subscription — nothing under it
  // should be crawled or indexed.
  if (host === 'terminal.traqcker.com') {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/profile', '/sign-in', '/sign-up', '/es/sign-in', '/es/sign-up'],
      },
    ],
    sitemap: 'https://traqcker.com/sitemap.xml',
  };
}
