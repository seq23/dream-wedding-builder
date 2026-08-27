import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';
import ownership from '@/data/seo/route_ownership.json';

const repoRoot = path.resolve(__dirname, '../..');
const indexable = ownership.routes.filter((route) => route.indexable);

const exists = (relative: string) => fs.existsSync(path.join(repoRoot, relative));
const isClientComponent = (relative: string) => /^\s*(['"])use client\1/.test(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));

/**
 * Resolves a route's metadata the way Next does: the page's own export when it has
 * one, otherwise the nearest layout, which is where a client route has to keep it.
 */
async function metadataFor(route: { path: string }): Promise<Metadata | null> {
  const dynamicProduct = route.path.match(/^\/products\/([^/]+)$/);
  const guide = route.path.match(/^\/guides\/([^/]+)$/);

  if (guide) {
    const mod = await import('@/app/guides/[slug]/page');
    return mod.generateMetadata({ params: Promise.resolve({ slug: guide[1] }) });
  }

  const dir = route.path === '/' ? 'app' : `app${route.path}`;
  if (dynamicProduct && !exists(`${dir}/page.tsx`)) {
    const mod = await import('@/app/products/[slug]/page');
    return (mod as { generateMetadata: (arg: { params: Promise<{ slug: string }> }) => Promise<Metadata> }).generateMetadata({ params: Promise.resolve({ slug: dynamicProduct[1] }) });
  }

  for (const candidate of [`${dir}/page.tsx`, `${dir}/layout.tsx`]) {
    if (!exists(candidate) || isClientComponent(candidate)) continue;
    const mod = (await import(/* @vite-ignore */ `@/${candidate.replace(/\.tsx$/, '')}`)) as { metadata?: Metadata; generateMetadata?: () => Promise<Metadata> };
    if (mod.metadata) return mod.metadata;
    if (mod.generateMetadata) return mod.generateMetadata();
  }
  return null;
}

const canonicalOf = (metadata: Metadata | null) => {
  const value = metadata?.alternates?.canonical;
  return typeof value === 'string' ? value : null;
};

describe('every indexable page ships a canonical', () => {
  it('has indexable routes to check', () => expect(indexable.length).toBeGreaterThan(0));

  it('leaves no indexable route without a canonical tag', async () => {
    const missing: string[] = [];
    for (const route of indexable) if (!canonicalOf(await metadataFor(route))) missing.push(`${route.host}${route.path}`);
    expect(missing).toEqual([]);
  });

  it('points every canonical at its owning host and its own path', async () => {
    const wrong: string[] = [];
    for (const route of indexable) {
      const canonical = canonicalOf(await metadataFor(route));
      if (!canonical) continue;
      const url = new URL(canonical);
      const expected = route.path === '/' ? '/' : route.path;
      if (url.protocol !== 'https:' || url.host !== route.host || url.pathname !== expected) wrong.push(`${route.host}${route.path} -> ${canonical}`);
    }
    expect(wrong).toEqual([]);
  });

  // The three satellite domains 308 their root to their hub page on purpose. A
  // canonical is only worth anything if it names a URL that answers 200, so this
  // runs the real middleware over each canonical and fails on any redirect.
  it('never names a URL that middleware redirects away from', async () => {
    const redirected: string[] = [];
    for (const route of indexable) {
      const canonical = canonicalOf(await metadataFor(route));
      if (!canonical) continue;
      const response = middleware(new NextRequest(new Request(canonical, { headers: { host: new URL(canonical).host } })));
      const location = response.headers.get('location');
      if (location && location !== canonical) redirected.push(`${canonical} -> ${location}`);
    }
    expect(redirected).toEqual([]);
  });

  it('keeps the deliberate satellite root redirects intact', () => {
    const redirecting = Object.entries(ownership.hosts).filter(([, config]) => config.root_action === 'redirect');
    expect(redirecting.length).toBe(3);
    for (const [host, config] of redirecting) {
      const response = middleware(new NextRequest(new Request(`https://${host}/`, { headers: { host } })));
      expect(response.status).toBe(308);
      expect(new URL(response.headers.get('location') as string).pathname).toBe(config.root_target);
    }
  });
});
