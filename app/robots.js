export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/profile', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: 'https://traqcker.com/sitemap.xml',
  };
}
