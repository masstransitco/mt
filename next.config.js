/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["api.placeholder.com"],
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      // 1) Let /api/... requests pass through without rewriting
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      },

      // 2) Rewrite everything else if the host is admin.masstransitcar.com
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "admin.masstransitcar.com",
          },
        ],
        destination: "/admin/:path*",
      },
    ];
  },
  typescript: {
    // Only run type checking in the app directory, ignore functions
    ignoreBuildErrors: process.env.SKIP_FUNCTIONS === 'true',
  },
};

module.exports = nextConfig;
