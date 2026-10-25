// Guard: the route-segment list middleware.ts uses to tell a real path from a
// made-up one is the app directory's own list.
//
// Origin (Search Readiness audit, 2026-10-25, item a9): Next's trailing-slash
// redirect answers before middleware, so https://weddingchecklistpdf.com/<made up>/
// answered 308 and only 404'd on the second hop. A made-up URL that answers a
// redirect is the soft-404 shape that hides broken links pointed at this site.
// next.config.ts now sets skipTrailingSlashRedirect and middleware.ts owns the
// rule - which only works while ROUTE_SEGMENTS still matches the routes that exist.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, ROUTE_SEGMENTS } from '@/middleware';

const APP = path.join(process.cwd(), 'app');
const actual = fs.readdirSync(APP, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('(') && !entry.name.startsWith('['))
  // A directory is a route segment when it, or something under it, answers.
  .filter((entry) => ['page.tsx', 'route.ts'].some((file) => fs.existsSync(path.join(APP, entry.name, file)))
    || fs.readdirSync(path.join(APP, entry.name), { withFileTypes: true }).some((child) => child.isDirectory()))
  .map((entry) => entry.name)
  .sort();

describe('middleware route segments', () => {
  it('found the app directory', () => { expect(actual.length).toBeGreaterThan(20); });
  it('lists every segment the app serves', () => {
    expect(actual.filter((segment) => !ROUTE_SEGMENTS.includes(segment))).toEqual([]);
  });
  it('lists no segment the app does not serve', () => {
    expect(ROUTE_SEGMENTS.filter((segment) => !actual.includes(segment))).toEqual([]);
  });
  it('is sorted, so a new route is added rather than appended twice', () => {
    expect([...ROUTE_SEGMENTS]).toEqual([...ROUTE_SEGMENTS].sort());
  });
});

// The loop this very nearly shipped with. NextURL remembers that the incoming path
// ended in a slash and puts it back when it is serialised, so `nextUrl.clone()` with
// the stripped pathname assigned answered /about/ with `location: /about/` - a
// permanent redirect to itself, on every real route on the site. Caught against
// `next start`; pinned here so it cannot come back silently.
describe('a trailing slash on a real route', () => {
  const ask = (path: string) => middleware(new NextRequest(`https://weddingchecklistpdf.com${path}`, { headers: { host: 'weddingchecklistpdf.com' } }));
  for (const path of ['/about/', '/guides/', '/guides/wedding-week-checklist/', '/products/checklist-pdf/']) {
    it(`${path} redirects once, to the same path without it`, () => {
      const response = ask(path);
      expect(response.status).toBe(308);
      const location = response.headers.get('location')!;
      expect(new URL(location, 'https://weddingchecklistpdf.com').pathname).toBe(path.replace(/\/+$/, ''));
      expect(location).not.toMatch(/\/$/);
    });
  }
  it('keeps the query string', () => {
    const location = ask('/guides/?utm_source=x')!.headers.get('location')!;
    expect(location).toContain('utm_source=x');
    expect(new URL(location, 'https://weddingchecklistpdf.com').pathname).toBe('/guides');
  });
  it('answers a made-up path without redirecting, so Next renders its 404', () => {
    const response = ask('/sr-fake-nope/');
    expect(response.status).toBe(200); // a rewrite, not a redirect
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toContain('/sr-fake-nope');
    expect(response.headers.get('x-middleware-rewrite')).not.toMatch(/\/$/);
  });
  it('leaves a path with no trailing slash alone', () => {
    expect(ask('/about').headers.get('location')).toBeNull();
  });
});
