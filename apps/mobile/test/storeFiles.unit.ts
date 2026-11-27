// The store files tell the truth about the build (app-ready, 27 Nov 2026): the Play listing is the App
// Store description word for word, every field fits its store limit, every screen name and button the
// App Review notes quote is in the app's code, and every price the notes name is the app's own price.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OFFER_NAME, PRODUCTS, type ProductId } from '../src/billing/offers';
// @ts-ignore plain JavaScript module
import { catalog as playCatalog } from '../scripts/store/play-products.mjs';

const root = join(import.meta.dirname, '..');
const store = (f: string) => readFileSync(join(root, 'store', f), 'utf8');
const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start), to = text.indexOf(end, from + 1);
  assert.ok(from >= 0 && to > from, `has its ${start} section`);
  return text.slice(from, to);
};
const apple = store('app-store-next-version.md');
const description = between(apple, '## Description', '## End of description').split('\n').slice(1).join('\n').trim();
const promo = between(apple, '## Promotional text', '## Description').split('\n').slice(1).join('\n').trim();
const play = JSON.parse(store('google-play.json')) as { listings: Record<string, { title: string; short: string; full: string }> };

const code = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? code(p) : /\.(tsx?|json)$/.test(f) ? [readFileSync(p, 'utf8')] : [];
});
const appText = [...code(join(root, 'app')), ...code(join(root, 'src'))].join('\n');

test('the Play listing is the App Store description word for word, inside every store limit', () => {
  const en = play.listings.en;
  assert.ok(en, 'an English Play listing');
  assert.equal(en.full, description);
  assert.ok(description.length > 1000 && description.length <= 4000, `description ${description.length}`);
  assert.ok(promo.length > 0 && promo.length <= 170, `promotional text ${promo.length}`);
  assert.ok(en.title.length > 0 && en.title.length <= 30, `title ${en.title.length}`);
  assert.ok(en.short.length > 0 && en.short.length <= 80, `short ${en.short.length}`);
  const heading = apple.match(/## Description \(≤ 4000\) — ([\d,]+) characters/);
  assert.equal(Number(heading?.[1].replace(',', '')), description.length, 'the character count in the heading is the real one');
});

test('every screen name and button the App Review notes quote is in the app', () => {
  const notes = store('review-notes.md').split('\n---\n')[1];
  assert.ok(notes, 'the notes block after the --- line');
  const quoted = [...notes.matchAll(/"([^"\n]{3,})"/g)].map(m => m[1]).filter(q => !q.includes('<'));
  assert.ok(quoted.length >= 20, `found ${quoted.length} quoted labels`);
  const missing = quoted.filter(q => !appText.includes(q.replace(/'/g, '’')) && !appText.includes(q));
  assert.deepEqual(missing, [], 'labels quoted in the notes but not in the app');
  // The one templated label: "Get Full plan · <price> ›" is OFFER_NAME + the store price.
  assert.match(notes, /"Get Full plan · <price> ›"/);
  assert.match(appText, /`Get \$\{name\} · \$\{price\} ›`/);
});

test('the prices the notes name are the app\'s own, product by product', () => {
  const head = store('review-notes.md').split('\n---\n')[0];
  const ids = [...head.matchAll(/`(dw_[a-z_]+)`/g)].map(m => m[1]);
  assert.deepEqual([...new Set(ids)].sort(), Object.keys(PRODUCTS).sort(), 'all five products are named');
  const line = head.match(/US prices read the same\s+day: ([\s\S]+?), the same/)?.[1] ?? '';
  const prices = [...line.matchAll(/\$(\d+\.\d\d)/g)].map(m => Number(m[1]));
  assert.deepEqual(prices, [...new Set(ids)].map(id => PRODUCTS[id as keyof typeof PRODUCTS].priceUsd));
});

/** A PNG's width and height, from its IHDR header. */
const pngSize = (file: string) => {
  const b = readFileSync(file);
  assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG', `${file} is a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

test('every file the "Before pasting" list names exists, next to the app or at the repo root', () => {
  const head = store('review-notes.md').split('\n---\n')[0];
  const named = [...head.matchAll(/`([\w./-]+(?:\.(?:md|json|png|ts|tsx)|\/))`/g)].map(m => m[1]);
  assert.ok(named.includes('store/app-store/iap-review/'), 'the IAP review screenshot step names its folder');
  assert.ok(named.length >= 5, `found ${named.length} file names`);
  const missing = named.filter(f => !existsSync(join(root, f)) && !existsSync(join(root, '..', '..', f)) && !existsSync(join(root, 'store', f))
    && !(f.endsWith('.png') && !f.includes('/') && existsSync(join(root, 'store', 'app-store', 'iap-review', f))));
  assert.deepEqual(missing, [], 'files the notes name that are not in the repo');
});

test('every in-app purchase has the buy screen\'s name, store-sized texts and a real review screenshot of its screen', () => {
  const doc = JSON.parse(store('in-app-products.json')) as { products: Record<string, { name: string; appStore: string; play: string; reviewShot: string }> };
  const paid = JSON.parse(store('paid-files.json')) as { storeText: Record<string, string[]> };
  assert.deepEqual(Object.keys(doc.products).sort(), Object.keys(PRODUCTS).sort(), 'all five products, no others');
  for (const [id, p] of Object.entries(doc.products)) {
    assert.equal(p.name, OFFER_NAME[id as ProductId], `${id}: the store name is the buy screen's name`);
    assert.ok(p.name.length <= 35, `${id}: App Store display name ${p.name.length} > 35`);
    assert.ok(p.appStore.length > 0 && p.appStore.length <= 55, `${id}: App Store description ${p.appStore.length}`);
    assert.ok(p.play.length > 0 && p.play.length <= 200, `${id}: Play description ${p.play.length}`);
    if (paid.storeText[id]) assert.equal(p.appStore, paid.storeText[id][0], `${id}: one App Store text, the one paid-files.json holds to the files`);
    assert.doesNotMatch(`${p.appStore} ${p.play}`, /\$\d|second phone|partner/i, `${id}: no price in the text and no feature this build lacks`);
    const shot = join(root, 'store', p.reviewShot);
    assert.ok(existsSync(shot), `${id}: review screenshot ${p.reviewShot}`);
    assert.deepEqual(pngSize(shot), { w: 1320, h: 2868 }, `${id}: a 6.9-inch iPhone screenshot`);
  }
  // Play gets exactly these titles and descriptions from ~/bin/play-products.
  for (const p of playCatalog.products as { id: string; title: string; description: string }[]) {
    assert.equal(p.title, doc.products[p.id].name, `${p.id}: Play title`);
    assert.equal(p.description, doc.products[p.id].play, `${p.id}: Play description`);
  }
  // The two Play lines that promised more than the product holds are gone.
  assert.doesNotMatch(JSON.stringify(doc), /budget line|its own checklist/);
  // The review shots are their own three screens (never a listing screenshot), every one is used, and the
  // notes tell the coordinator the same file for each product as this file does.
  const shots = Object.values(doc.products).map(p => p.reviewShot);
  assert.ok(shots.every(f => f.startsWith('app-store/iap-review/')), 'every review shot is in app-store/iap-review/');
  assert.deepEqual([...new Set(shots)].map(f => f.split('/').pop()).sort(), readdirSync(join(root, 'store', 'app-store', 'iap-review')).sort(), 'no unused file in iap-review/');
  const head = store('review-notes.md').split('\n---\n')[0];
  const told: Record<string, string> = {};
  for (const m of head.matchAll(/`(iap-[a-z-]+\.png)`\s+on\s+((?:`dw_[a-z_]+`(?:\s+and\s+)?)+)/g)) for (const id of m[2].match(/dw_[a-z_]+/g) ?? []) told[id] = m[1];
  assert.deepEqual(told, Object.fromEntries(Object.entries(doc.products).map(([id, p]) => [id, p.reviewShot.split('/').pop()])), 'the notes put each shot on the same products');
});

test('the App Store keywords fit, and none sells a human service the app is not', () => {
  const keywords = between(apple, '## Keywords (≤ 100)', '## Promotional text').split('\n').map(l => l.trim()).filter(l => /^[a-z ,-]+$/.test(l) && l.includes(','));
  assert.equal(keywords.length, 1, 'one keyword line');
  assert.ok(keywords[0].length <= 100, `keywords ${keywords[0].length}`);
  assert.doesNotMatch(keywords[0], /coordinator|planner service|hire/);
});

test('both stores declare the tradition pick the app sends to the AI model', () => {
  // The app sends it (the declared flow): if this goes, both labels can drop it together.
  assert.match(readFileSync(join(root, 'src', 'journey.ts'), 'utf8'), /tradition: a\.tradition/);
  const appleLabel = readFileSync(join(root, '..', '..', 'docs', 'app-privacy.md'), 'utf8');
  const declared = between(appleLabel, '## Declared', '## Not declared');
  assert.match(declared, /^\| Sensitive Info \| App Functionality, Other Purposes \|.*tradition/m, 'Apple: Sensitive Info carries the tradition pick');
  const playAnswers = store('play-console-answers.md');
  assert.match(playAnswers, /^\| Personal info → Religious beliefs, and Race and ethnicity \(the tradition/m, 'Play: the same choice');
  assert.doesNotMatch(playAnswers, /Apple has no such type/, 'the Play answers say where Apple carries it');
});
