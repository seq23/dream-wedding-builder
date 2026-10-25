// Guard: the title and description bands, at the data level.
//
// Origin (Search Readiness audit, 2026-10-25, items b1/b2): 14 titles were 66-70
// characters and 13 descriptions were 110-119 - every one of them inside the older
// 30-70 / 110-160 bands this repo had been enforcing since September, which is why
// nothing caught them. The bands moved to 30-65 and 120-160 in lib/seo.ts and
// scripts/validators/validate_rendered_seo_contract.mjs.
//
// The rendered gate is the one that reads real pages, but it needs a build. This
// reads the records every title and description is generated from, so a guide, hub,
// landing or product that drifts out of band fails in seconds.
import { describe, expect, it } from 'vitest';
import { plannerLandings as landings } from '@/data/planner-landings';
import { products } from '@/lib/products';
import {
  documentTitle, guideMetaDescription, guideMetadata, guides, hubs,
  META_DESCRIPTION_MAX, META_DESCRIPTION_MIN, SITE_TITLE_SUFFIX, TITLE_MAX
} from '@/lib/seo';

const TITLE_MIN = 30;
/** What the <title> actually becomes: the suffix is kept only while it fits. */
function rendered(title: string): string {
  const result = documentTitle(title);
  return typeof result === 'string' ? `${result}${SITE_TITLE_SUFFIX}` : title;
}
const inTitleBand = (title: string) => rendered(title).length >= TITLE_MIN && rendered(title).length <= TITLE_MAX;
const inDescBand = (text: string) => text.length >= META_DESCRIPTION_MIN && text.length <= META_DESCRIPTION_MAX;

describe('the bands themselves', () => {
  it('are the Search Readiness bands', () => {
    expect([TITLE_MIN, TITLE_MAX]).toEqual([30, 65]);
    expect([META_DESCRIPTION_MIN, META_DESCRIPTION_MAX]).toEqual([120, 160]);
  });
});

describe('every record a title is generated from', () => {
  it('has records to check', () => {
    expect(guides.length).toBeGreaterThan(50);
    expect(Object.keys(hubs).length).toBeGreaterThan(5);
    expect(landings.length).toBeGreaterThan(3);
  });
  it('keeps every guide title in band', () => {
    expect(guides.filter((guide) => !inTitleBand(guide.title)).map((guide) => `${guide.slug} ${rendered(guide.title).length}`)).toEqual([]);
  });
  it('keeps every hub title in band', () => {
    expect(Object.entries(hubs).filter(([, hub]) => !inTitleBand(hub.title)).map(([slug, hub]) => `${slug} ${rendered(hub.title).length}`)).toEqual([]);
  });
  it('keeps every planner landing title in band', () => {
    expect(landings.filter((landing) => !inTitleBand(landing.title)).map((landing) => `${landing.slug} ${rendered(landing.title).length}`)).toEqual([]);
  });
  it('keeps every product page title in band', () => {
    // app/products/[slug]/page.tsx builds the title this way. The suite has its own
    // page and its own metadata, so it is not generated from a catalog promise.
    const titles = products.map((product) => `${product.name} - Editable Wedding Planning Tool`);
    expect(titles.filter((title) => !inTitleBand(title))).toEqual([]);
  });
});

describe('every description a page is given', () => {
  it('keeps every guide description in band', () => {
    expect(guides.filter((guide) => !inDescBand(guideMetaDescription(guide))).map((guide) => `${guide.slug} ${guideMetaDescription(guide).length}`)).toEqual([]);
  });
  it('keeps every hub description in band', () => {
    expect(Object.entries(hubs).filter(([, hub]) => !inDescBand(hub.description)).map(([slug, hub]) => `${slug} ${hub.description.length}`)).toEqual([]);
  });
  it('keeps every landing description in band', () => {
    expect(landings.filter((landing) => !inDescBand(landing.description)).map((landing) => `${landing.slug} ${landing.description.length}`)).toEqual([]);
  });
  it('keeps every product promise in band, because it is the product page description', () => {
    expect(products.filter((product) => !inDescBand(product.promise)).map((product) => `${product.id} ${product.promise.length}`)).toEqual([]);
  });
  it('generates, not truncates: a guide with no written description still lands in band', () => {
    const generated = guides.filter((guide) => inDescBand(guideMetaDescription(guide)));
    expect(generated.length).toBe(guides.length);
    // And the metadata the page actually exports says the same thing.
    const sample = guides[0];
    expect(String((guideMetadata(sample.slug) as { description?: string }).description)).toBe(guideMetaDescription(sample));
  });
});
