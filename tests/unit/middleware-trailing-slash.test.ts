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
import { ROUTE_SEGMENTS } from '@/middleware';

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
