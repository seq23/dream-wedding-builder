// The store files tell the truth about the build (app-ready, 27 Nov 2026): the Play listing is the App
// Store description word for word, every field fits its store limit, every screen name and button the
// App Review notes quote is in the app's code, and every price the notes name is the app's own price.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCTS } from '../src/billing/offers';

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
