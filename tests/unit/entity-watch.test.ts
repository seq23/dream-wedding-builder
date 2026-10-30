// The weekly entity watch's decisions, driven with fixed fetch results: no network.
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs module with no type declarations
import { classify, heal } from '../../scripts/entity/entity_watch_lib.mjs';

const PIN = 'https://www.pinterest.com/example/';
const IG = 'https://www.instagram.com/example/';
const FB = 'https://www.facebook.com/example';
const fixture = () => ({
  brand: { '@id': 'https://a.com/#organization', sameAs: [PIN, FB], profiles_pending: [IG] },
  sites: { 'a.com': { '@id': 'https://a.com/#site', sameAs: [], profiles_pending: [] }, 'b.com': { '@id': 'https://b.com/#site', sameAs: [], profiles_pending: [] } }
});

describe('classify', () => {
  it('resolving server-rendered profile that names our host is ok', () => { expect(classify(PIN, { status: 200, body: '<a href="https://a.com/">' }, ['a.com', 'b.com'])).toBe('ok'); });
  it('resolving profile that never names our host is a missing link-back', () => { expect(classify(PIN, { status: 200, body: 'nothing' }, ['a.com'])).toBe('missing_linkback'); });
  it('a JS-rendered platform is unverifiable, never ok', () => { expect(classify(IG, { status: 200, body: 'a.com' }, ['a.com'])).toBe('unverifiable'); });
  it('404 and 410 are dead', () => { expect(classify(PIN, { status: 404, body: '' }, ['a.com'])).toBe('dead'); expect(classify(PIN, { status: 410, body: '' }, ['a.com'])).toBe('dead'); });
  it('a bot wall, a 5xx or a network error is unreachable, not dead', () => {
    for (const status of [403, 429, 500, null]) expect(classify(PIN, { status, body: '' }, ['a.com'])).toBe('unreachable');
  });
});

describe('heal', () => {
  it('removes a dead profile, promotes a pending one that resolves, names a stop for a missing link-back', () => {
    const results = new Map([[PIN, 'dead'], [FB, 'missing_linkback'], [IG, 'unverifiable']]);
    const out = heal(fixture(), results);
    expect(out.entity.brand.sameAs).toEqual([FB, IG]);
    expect(out.entity.brand.profiles_pending).toEqual([]);
    expect(out.removed).toEqual([{ key: 'brand', url: PIN }]);
    expect(out.promoted.map((item: { url: string }) => item.url)).toEqual([IG]);
    expect(out.stops).toHaveLength(1);
    expect(out.stops[0].url).toBe(FB);
    expect(out.stops[0].field).toMatch(/Facebook Page/);
    expect(out.changed).toBe(true);
  });
  it('keeps an unreachable profile and a still-pending one exactly where they are', () => {
    const out = heal(fixture(), new Map([[PIN, 'unreachable'], [FB, 'ok'], [IG, 'dead']]));
    expect(out.entity.brand.sameAs).toEqual([PIN, FB]);
    expect(out.entity.brand.profiles_pending).toEqual([IG]);
    expect(out.unreachable).toHaveLength(1);
    expect(out.changed).toBe(false);
  });
});
