/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/__clerk/:path*',
        destination: 'https://clerk.traqcker.com/__clerk/:path*',
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