// Every file the paywall, an in-app purchase description or the store listing names is in the
// archive that purchase delivers (ship-ready app-review.md check 13). The archives are private
// (R2); store/paid-files.json lists their files by name and checksum, written from the real zips
// by scripts/store/paid-files.mjs, which also verifies a zip read back from R2 before release.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OFFER_DETAIL, type ProductId } from '../src/billing/offers';

type Named = { says: string; files: string[] };
const doc = JSON.parse(readFileSync(new URL('../store/paid-files.json', import.meta.url), 'utf8')) as {
  products: Record<string, string[]>; storeText: Record<string, string[]>;
  promises: Record<string, Named[]>; archives: Record<string, { key: string; files: { name: string; bytes: number }[] }>;
};
// A part of a sentence that names something to print or fill in.
const deliverable = /\b(pdf|spreadsheet|sheet|list|tracker|template|maker|comparison|checklists?|planners?)\b/i;

/** The named deliverables in a product's text that no file in its archives backs. */
function unbacked(product: string, text: string): string[] {
  const archives = doc.products[product] ?? [];
  const promises = archives.flatMap(a => (doc.promises[a] ?? []).map(p => ({ ...p, archive: a })));
  const missing: string[] = [];
  for (const part of text.split(/[,;:()]|\band\b|\bplus\b/i).map(t => t.trim()).filter(t => deliverable.test(t))) {
    if (/^the full plan|^full plan|wedding checklist pdf/i.test(part)) continue; // the full plan is in-app, not a file
    const hit = promises.filter(p => part.toLowerCase().includes(p.says.toLowerCase()));
    const inZip = hit.filter(p => p.files.length > 0 && p.files.every(f => doc.archives[p.archive]?.files.some(z => z.name === f && z.bytes > 0)));
    if (inZip.length === 0) missing.push(part);
  }
  return missing;
}

test('every file a paid product names is in the archive it delivers', () => {
  const texts: [string, string][] = [
    ...(['dw_planner_printables', 'dw_printables_topup', 'dw_day_of_kit'] as ProductId[]).map(id => [id, OFFER_DETAIL[id]] as [string, string]),
    ...Object.entries(doc.storeText).flatMap(([id, list]) => list.map(t => [id, t] as [string, string])),
  ];
  assert.ok(Object.keys(doc.archives).length === 2, 'both archives are listed (run paid-files.mjs write)');
  let named = 0;
  for (const [id, text] of texts) {
    named += text.split(/[,;:()]|\band\b|\bplus\b/i).filter(t => deliverable.test(t)).length;
    assert.deepEqual(unbacked(id, text), [], `${id}: "${text}"`);
  }
  assert.ok(named >= 15, `the check read the named files (${named})`);
  // Proved negatively: a promise with no file, or a file listed only for another archive, fails.
  assert.deepEqual(unbacked('dw_printables_topup', 'Files to print: checklist PDF, guest RSVP tracker'), ['guest RSVP tracker']);
  assert.deepEqual(unbacked('dw_printables_topup', 'a contact list'), ['a contact list']);
  assert.deepEqual(unbacked('dw_day_of_kit', 'venue comparison'), ['venue comparison']);
});
