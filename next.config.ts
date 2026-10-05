import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

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

// The Miniflare bindings proxy is for `next dev` only. Started at module level it ran in
// every process that loads this file: `next build` loads it in the main process and in
// each jest-worker child, so one build started four Miniflare instances on the same
// .wrangler/state SQLite files, and on 2026-10-05 two of them raced and the build died
// with SQLITE_BUSY (Full Safe Autonomy run 37297092612). Build-time and `next start`
// callers lose nothing: lib/cloudflare-runtime.ts uses getCloudflareContext({ async: true }),
// which starts the proxy lazily, once, in the process that actually needs bindings.
// Guarded by tests/unit/next-config-platform-proxy.test.ts.
export default async function config(phase: string): Promise<NextConfig> {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
    await initOpenNextCloudflareForDev();
  }
  return nextConfig;
}
