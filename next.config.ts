import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The planner shipped at /build for six days. /build described the codebase, not
  // the search query, and nothing has ranked on it yet, so the rename is free.
  // next.config redirects resolve before middleware, so this fires before the
  // host-ownership rules ever see the path.
  async redirects() {
    return [
      { source: '/build', destination: '/free-wedding-planner', permanent: true },
      { source: '/build/:path*', destination: '/free-wedding-planner/:path*', permanent: true }
    ];
  },
  outputFileTracingExcludes: {
    '*': [
      './node_modules/@playwright/**',
      './node_modules/playwright/**',
      './node_modules/playwright-core/**',
      './tests/**',
      './coverage/**',
      './reports/**'
    ]
  },
  experimental: {
    cpus: 1,
    workerThreads: false
  }
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
