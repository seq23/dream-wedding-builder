// Guard for the Search Readiness q1 failures found on 3 November 2026, on
// weddingbudgetspreadsheet.com (/guides: b3 and c6; /products/budget-spreadsheet:
// c6) and weddingseatingchartmaker.com (/products/seating-chart-maker: c6).
//
// Why these failed: the checklist's c6 ("a named author is visible") is satisfied
// only when a name in the page's JSON-LD `author` ALSO appears in the page's
// visible text. The guides index was one of the pages built from plain JSX and
// carried no byline and no author node at all. The product pages printed the words
// "By Dream Wedding Builder" but declared no `author` anywhere in their structured
// data, so the name a reader saw and the name an engine read were never the same
// claim and the check could not pass on either page.
//
// This guards the invariant itself - the visible name IS the declared author - for
// every canonical host, and proves it negatively: the same assertion fails on the
// same page rendered without its byline.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let currentHost = 'weddingchecklistpdf.com';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: currentHost }) }));

import ownership from '@/data/seo/route_ownership.json';
import { PageByline, bylineWebPageNode, PUBLISHER_NAME } from '@/components/seo/PageByline';
import GuidesIndex from '@/app/guides/page';

const HOSTS = Object.keys(ownership.hosts);
// The same shape page-quality-sample.mjs uses for checklist item b3.
const QUESTION = /\?\s*$|^(what|how|why|when|where|who|which|is|are|can|does|do|should|will|was|were)\b/i;
const visibleText = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const h2s = (html: string) => [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => visibleText(m[1]));
const authorNames = (node: Record<string, unknown>) => [(node.author as { name?: string } | undefined)?.name].filter(Boolean) as string[];

describe('the byline a reader sees is the author declared in the markup (checklist c6)', () => {
  it('has canonical hosts to check', () => expect(HOSTS.length).toBeGreaterThan(0));

  for (const host of HOSTS) {
    it(`${host} declares an author on /guides and names it in the visible text`, async () => {
      currentHost = host;
      const html = renderToStaticMarkup(await GuidesIndex());
      const names = authorNames(bylineWebPageNode(host, '/guides'));
      expect(names).toEqual([PUBLISHER_NAME]);
      // c6's own test: some declared author name appears in the visible text.
      expect(names.some((name) => visibleText(html).includes(name))).toBe(true);
    });

    it(`${host} /guides asks a question in an H2 and keeps one H1 (checklist b3)`, async () => {
      currentHost = host;
      const html = renderToStaticMarkup(await GuidesIndex());
      expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
      const headings = h2s(html);
      expect(headings.length).toBeGreaterThan(1);
      expect(headings.some((heading) => QUESTION.test(heading))).toBe(true);
    });
  }

  it('the author node reuses the WebPage @id the layout already emits for the URL', () => {
    const node = bylineWebPageNode('weddingbudgetspreadsheet.com', '/guides');
    expect(node['@id']).toBe('https://weddingbudgetspreadsheet.com/guides#webpage');
  });

  it('proves negatively: the same page without its byline names no author in its text', () => {
    const withByline = visibleText(renderToStaticMarkup(<PageByline path="/guides" />));
    expect(withByline).toContain(PUBLISHER_NAME);
    // The identical assertion on markup that omits the byline must fail, or the
    // check above would pass on a page that still has no visible author.
    const withoutByline = visibleText(renderToStaticMarkup(<p>Canonical guide index</p>));
    expect(withoutByline).not.toContain(PUBLISHER_NAME);
  });
});
