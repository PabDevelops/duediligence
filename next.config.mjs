// CSP is deliberately not set here — the site loads AdSense, Vercel Analytics, Google
// Analytics, datafa.st, Stripe, Supabase, and a Clerk rewrite, and a wrong connect-src/
// script-src would silently break ads revenue or login rather than fail loudly. Needs its
// own pass with each of those actually exercised, not bundled into a quick headers fix.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/__clerk/:path*',
        destination: 'https://clerk.bulltrace.app/__clerk/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/compare',
        destination: '/radar',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;