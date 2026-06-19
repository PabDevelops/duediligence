/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  async rewrites() {
    return [
      {
        source: '/__clerk/:path*',
        destination: 'https://clerk.traqcker.com/__clerk/:path*',
      },
    ];
  },
};

export default nextConfig;