import type { NextConfig } from 'next';

// Where the Next server forwards /api and /uploads. Rewrites are resolved at
// build time, so in Docker this is passed as a build arg (see Dockerfile).
const backend = process.env.BACKEND_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
