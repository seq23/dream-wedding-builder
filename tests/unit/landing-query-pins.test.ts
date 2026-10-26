// Guard: a planner landing's title and description keep the queries Google ranks it for.
//
// Origin (portfolio check 2026-10-25, repair 5): weddingbudgetspreadsheet.com fell from
// 57 to 23 impressions over 28 days. Every query Google attributed to the site was a
// /wedding-cost-per-guest query naming a guest count (gsc_truth.json, window
// 2026-09-12..2026-10-09, collected 2026-10-11). Two edits had quietly dropped "100",
// the count in the most-shown query: the description (#18, 25 Sep, "50, 80, 100, 150,
// and 200" -> "50 to 200") and the title (#39, 25 Oct, "50, 80, 100, and 150" -> "50 to
// 150"), each to fit a length band. Both are restored inside the 30-65 / 120-160 bands.
//
// A retitle that drops a ranked query's guest count now fails here, not in Search
// Console four weeks later.
import { describe, expect, it } from 'vitest';
import { landingBySlug } from '@/data/planner-landings';

/** Queries Search Console showed for each page, verbatim, with their source window. */
const RANKED_QUERIES: Record<string, { source: string; queries: string[] }> = {
  'wedding-cost-per-guest': {
    source: 'data/search_intelligence/gsc_truth.json @ 66b46f2, 2026-09-12..2026-10-09',
    queries: [
      'average cost of a wedding for 100 people',
      'average cost of wedding for 150 guests',
      'average cost of wedding for 50 guests',
      'average wedding cost for 50 guests',
      'how much does a 100 person wedding cost',
      'how much does a 150 person wedding cost',
      'how much does a wedding for 100 people cost',
      'wedding cost for 100 people'
    ]
  }
};

const guestCounts = (text: string) => [...text.matchAll(/\b(\d{2,3})\b/g)].map((m) => m[1]);
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);

describe('planner landing titles keep their ranked queries', () => {
  const pinned = Object.entries(RANKED_QUERIES);
  it('pins at least one page with at least one query', () => {
    expect(pinned.length).toBeGreaterThan(0);
    for (const [, { queries }] of pinned) expect(queries.length).toBeGreaterThan(0);
  });

  for (const [slug, { queries }] of pinned) {
    const landing = landingBySlug(slug);
    it(`${slug} exists`, () => expect(landing).toBeDefined());

    for (const query of queries) {
      it(`${slug}: title and description name the guest count in "${query}"`, () => {
        const counts = guestCounts(query);
        expect(counts.length).toBeGreaterThan(0);
        for (const count of counts) {
          expect(guestCounts(landing!.title), `title "${landing!.title}" lost ${count}`).toContain(count);
          expect(guestCounts(landing!.description), `description lost ${count}`).toContain(count);
        }
      });
    }

    it(`${slug}: title carries the head terms every query shares`, () => {
      const title = words(landing!.title);
      for (const term of ['wedding', 'cost']) expect(title.has(term), `title lost "${term}"`).toBe(true);
    });
  }
});
