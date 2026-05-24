import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
