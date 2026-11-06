// Guard for the broken section headings found live on 6 November 2026 (after #77):
// statements were forced into "How do I ...?" and rendered as
// "How do I one row per guest, always?" and "How do I use there is still no
// vendor-questions product, ...?". A heading may become a "How do I" question only
// when the authored heading starts with a verb; every hub and guide is rendered and
// checked, so a renderer that bypasses questionHeading fails here.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'weddingchecklistpdf.com' }) }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound'); }, redirect: () => { throw new Error('redirect'); }, usePathname: () => '/', useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams() }));

import { questionHeading, IMPERATIVE } from '@/lib/question-heading';
import { hubs } from '@/lib/seo';
import { HubPage } from '@/components/seo/HubPage';
import { shippingPages } from '@/lib/authority-registry';
import Guide from '@/app/guides/[slug]/page';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const h2s = (html: string) => [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => text(m[1]));
const malformed = (h: string) => { const m = /^How do I (\S+)/.exec(h); return !!m && !IMPERATIVE.has(m[1].toLowerCase()) || /^How do I use (use|there|what|where|how|which|\d)\b/i.test(h); };

describe('section headings stay sentences', () => {
  it('turns imperatives into questions and leaves statements as authored', () => {
    expect(questionHeading('Build from venue capacity rules')).toBe('How do I build from venue capacity rules?');
    expect(questionHeading('One row per guest, always')).toBe('One row per guest, always');
    expect(questionHeading('There is still no vendor-questions product, and the suite does not add one')).toBe('There is still no vendor-questions product, and the suite does not add one');
    expect(questionHeading('What the book already gave you')).toBe('What the book already gave you');
    expect(questionHeading('Which costs change?')).toBe('Which costs change?');
    expect(malformed('How do I one row per guest, always?')).toBe(true);
    expect(malformed('How do I use what the book already gave you?')).toBe(true);
  });

  const hubSlugs = Object.keys(hubs);
  it('has hubs and guides to render', () => { expect(hubSlugs.length).toBeGreaterThan(0); expect(shippingPages.length).toBeGreaterThan(0); });

  it('no hub renders a malformed "How do I" heading', () => {
    const bad: string[] = []; let seen = 0;
    for (const slug of hubSlugs) for (const h of h2s(renderToStaticMarkup(<HubPage slug={slug} page={hubs[slug]} />))) { seen++; if (malformed(h)) bad.push(`${slug}: ${h}`); }
    expect(seen).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  it('no guide renders a malformed "How do I" heading', async () => {
    const bad: string[] = []; let seen = 0;
    for (const page of shippingPages) for (const h of h2s(renderToStaticMarkup(await Guide({ params: Promise.resolve({ slug: page.slug }) })))) { seen++; if (malformed(h)) bad.push(`${page.slug}: ${h}`); }
    expect(seen).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});
