/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['api.placeholder.com'],
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'admin.masstransitcar.com',
          },
        ],
        destination: '/admin/:path*',
      },
    ];
  },
}

module.exports = nextConfig
