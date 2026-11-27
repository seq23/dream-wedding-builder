import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import llmConfig from '@/config/llm_routing.json';
import { buildMessages, checkRead, cleanAnswers, fixedRead, purgeExpiredReadCache, readCacheKey, tracedIdeas, weddingRead, ANSWERS_PER_VISITOR_PER_DAY, TESTER_ANSWERS_PER_DAY, type WeddingRead } from '@/lib/wedding-read';
import { sha256, visitorIp } from '@/lib/ai-draft';
import { colourView, herSwatches, toggleColour } from '@/lib/wedding-read-shared';
import { keptColours, pickable, togglePick } from '@/lib/journey-picks';
import { recordReach } from '@/lib/journey-reach';
import { MODEL_CALLS_PER_DAY_GLOBAL } from '@/lib/ai-draft';
import { fakeD1, fakeNet, geminiAnswer, geminiQuota, orAnswer, orDown } from '@/tests/support/ai-draft-fakes';

const TODAY = '2026-11-13';
const NOW = new Date('2026-11-13T18:00:00Z');
const GEM = llmConfig.gemini.models.map(m => m.id);
const PROBE = llmConfig.gemini.billing_probe.model;

// Two brides from the approved sample (13 Nov 2026).
const DK = { path: 'dk', season: 'Fall', setting: 'Outdoors', moods: ['Relaxed', 'Garden'], facts: { where: 'Memphis', guests: '100' } };
const ITALIAN = { path: 'idea', wish: 'Italian villa venue wanted, Memphis, 100 people', facts: { where: 'Memphis', guests: '100' } };

const good = (over: Record<string, unknown> = {}) => JSON.stringify({
  headline: 'A relaxed garden wedding outdoors in Memphis in the fall, for 100',
  read: 'Memphis in the fall brings cooler evenings for a relaxed outdoor gathering. You can lean on greenery and long tables so it feels grown, not decorated.',
  directions: [{ name: 'Natural garden layers', what: 'Keep the layout open. Use potted greenery.' }, { name: 'Warm evening light', what: 'Hang string lights. Use pillar candles.' }],
  colours: [{ name: 'Amber', hex: '#d9822b' }, { name: 'Olive', hex: '#556b2f' }, { name: 'Cream', hex: '#fdfbf7' }, { name: 'Terracotta', hex: '#cc6633' }, { name: 'Charcoal', hex: '#333333' }],
  venue_types: [{ id: 'public-park-garden', why: 'Wide lawns and autumn trees.' }],
  ideas: [{ id: 'dinner-party-layout', why: 'It keeps the evening easy and talkative.' }, { id: 'secret-garden-at-night', why: 'It carries the garden into the evening.' }],
  details: ['Long wooden tables with linen runners', 'Low garden roses', 'String lights between trees', 'Family-style platters', 'Acoustic guitar during dinner'],
  ask_vendors: ['Ask the caterer how food stays warm outdoors.', 'Ask the rental company about tent flooring.', 'Ask the florist which flowers last outdoors.', 'Ask the musician about power.'],
  honest_note: 'An outdoor fall evening needs a weather plan.',
  ...over
});

// Every request here has her yes (consent: true) unless the test says otherwise; the consent test sets the body itself.
const withYes = (body: unknown) => body && typeof body === 'object' && !Array.isArray(body) && !('consent' in body) ? { consent: true, ...body } : body;
const base = (over: Partial<Parameters<typeof weddingRead>[0]> = {}) => { const o = { db: undefined, apiKey: 'or-key', geminiKey: 'gem-key', enabled: true, body: DK as unknown, ip: '1.1.1.1', today: TODAY, now: NOW, salt: 's', log: () => {}, budgetMs: 60000, ...over }; return { ...o, body: withYes(o.body) }; };
const read = (over: Partial<WeddingRead> = {}): WeddingRead => ({ ...fixedRead(cleanAnswers(DK)), by: 'ai', ...over });

describe('the checks before she sees an answer', () => {
  const dk = cleanAnswers(DK);
  it('a fixed-list answer passes its own checks for every kind of bride', () => {
    for (const body of [DK, ITALIAN, { path: 'dk' }, { path: 'idea', wish: 'small backyard party with tacos and a DJ', facts: { venueBooked: true, budget: 'Under $10,000', guests: '120' } }]) {
      const a = cleanAnswers(body);
      expect(checkRead(fixedRead(a), a), JSON.stringify(body)).toEqual([]);
    }
  });
  it('no false names or voice: Edison bulbs and her own "we" in a vendor question pass; invented towns, venues, I and darling still fail', () => {
    expect(checkRead(read({ details: ['Edison bulbs strung over long tables', 'Chiavari chairs with Chantilly lace runners'] }), dk)).toEqual([]);
    expect(checkRead(read({ ask: ['Ask the caterer if we can bring our own wine.'] }), dk)).toEqual([]);
    expect(checkRead(read({ read: 'We can bring our own wine.' }), dk).some(f => f.startsWith('voice:read'))).toBe(true);
    expect(checkRead(read({ ask: ['Ask the florist what I should pick, darling.'] }), dk).some(f => f.startsWith('voice:ask'))).toBe(true);
    expect(checkRead(read({ headline: 'A relaxed fall garden in Springfield, for 100' }), dk).some(f => f === 'name:headline:Springfield')).toBe(true);
    expect(checkRead(read({ details: ['Dinner at the Grand Oak Ballroom'] }), dk).some(f => f.startsWith('name:detail0:'))).toBe(true);
    expect(checkRead(read({ details: ['Spritzes with Aperol at the bar'] }), dk).some(f => f.startsWith('name:detail0:') || f.startsWith('brand:'))).toBe(true);
  });

  it('a town named only in her own words may be used; with no town anywhere the prompt says "near you"', () => {
    const typed = cleanAnswers({ path: 'idea', wish: 'Italian villa feel in Memphis, 100 people' });
    expect(checkRead(read({ headline: 'An Italian villa evening in Memphis, for 100', ideas: [] }), typed).filter(f => f.startsWith('name:'))).toEqual([]);
    const prompt = JSON.stringify(buildMessages(typed, [], [], []));
    expect(prompt).toContain('If her own words name the town');
    expect(JSON.stringify(buildMessages(cleanAnswers({ path: 'idea', wish: 'Memphis', facts: { where: 'Memphis' } }), [], [], []))).not.toContain('near you');
    // The colours read from her photo on her phone shape the palette.
    expect(JSON.stringify(buildMessages(cleanAnswers({ path: 'idea', wish: 'a villa', photos: [{ loves: [], colours: ['#800020', '#d2b48c'] }] }), [], [], []))).toContain('Colours read from her photos: #800020, #d2b48c');
    // And the fixed-list answer shows her photo's own colours, plainly named.
    expect(fixedRead(cleanAnswers({ path: 'idea', wish: 'a villa', photos: [{ loves: [], colours: ['#7f001f', '#d1b38b', '#024421'] }] })).colours).toEqual([{ name: 'Burgundy', hex: '#7f001f' }, { name: 'Tan', hex: '#d1b38b' }, { name: 'Deep green', hex: '#024421' }]);
  });

  it('speaks as the tool: we, us, I and darling fail', () => {
    for (const bad of ['We love this for you.', 'I think candles work.', 'Darling, keep it simple.', 'Let us plan it.']) expect(checkRead(read({ read: bad }), dk).some(f => f.startsWith('voice:'))).toBe(true);
    expect(checkRead(read({ read: 'You can keep it simple with candles.' }), dk)).toEqual([]);
  });
  it('names no business, venue, brand or person', () => {
    expect(checkRead(read({ read: 'You could hold it at the Overton Park shell.' }), dk).some(f => f.startsWith('name:'))).toBe(true);
    expect(checkRead(read({ ask: ['Ask Maria about the cake.'] }), dk).some(f => f.startsWith('name:'))).toBe(true);
    expect(checkRead(read({ details: ['zola has the best registry'] }), dk).some(f => f.startsWith('brand:'))).toBe(true);
    expect(checkRead(read({ read: 'Fall in Memphis is lovely in October.' }), dk)).toEqual([]);
  });
  it('names no price and no availability', () => {
    expect(checkRead(read({ honest: 'Expect about $5,000 for flowers.' }), dk).some(f => f.startsWith('price:'))).toBe(true);
    expect(checkRead(read({ honest: 'Catering runs 40 dollars a head.' }), dk).some(f => f.startsWith('price:'))).toBe(true);
    expect(checkRead(read({ honest: 'Most venues are booked up by spring.' }), dk).some(f => f.startsWith('availability:'))).toBe(true);
    expect(checkRead(read({ honest: 'Your date is still available at most parks.' }), dk).some(f => f.startsWith('availability:'))).toBe(true);
  });
  it('an Italian idea for a bride who never said Italian fails; for the bride who did, it passes', () => {
    const italianIdea = { id: 'gelato-cart', name: 'Gelato Cart', cost: 'Medium cost', why: 'A sweet treat for fall.' };
    expect(checkRead(read({ ideas: [italianIdea] }), dk)).toContain('untraced:gelato-cart');
    expect(tracedIdeas(dk, 200).map(x => x.trend.id)).not.toContain('italian-aperitivo-arrival-table');
    const it = cleanAnswers(ITALIAN);
    expect(checkRead({ ...fixedRead(it), by: 'ai', ideas: [italianIdea] }, it).filter(f => f.startsWith('untraced'))).toEqual([]);
    expect(tracedIdeas(it, 200).map(x => x.trend.id)).toContain('italian-aperitivo-arrival-table');
  });
  it('every idea she is offered traces to something she said or tapped; nothing at all traces to nothing', () => {
    expect(tracedIdeas(cleanAnswers({ path: 'dk' }), 200)).toEqual([]);
    for (const { trend } of tracedIdeas(dk, 200)) expect(/italian|gelato|aperitivo|burrata|sushi|mariachi|taco|gospel/i.test(`${trend.name} ${trend.description}`), trend.id).toBe(false);
  });
  it('venue types are refused when the venue is booked, and only our own types are allowed', () => {
    const booked = cleanAnswers({ ...DK, facts: { ...DK.facts, venueBooked: true } });
    expect(checkRead(read({ venueTypes: [{ id: 'public-park-garden', name: 'Park', why: 'Lawns.' }] }), booked)).toContain('venue_booked');
    expect(fixedRead(booked).venueTypes).toEqual([]);
    expect(checkRead(read({ venueTypes: [{ id: 'destination-estate-buyout', name: 'Villa', why: 'Privacy.' }] }), dk)).toContain('venue_not_offered:destination-estate-buyout');
  });
});

describe('the journey endpoint', () => {
  it('only an explicit yes reaches an AI model: false, missing or malformed consent gets the fixed-list answer and no model call', async () => {
    const { db } = fakeD1([]);
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    for (const body of [{ ...DK, consent: false }, DK, { ...DK, consent: 'true' }, { ...DK, consent: null }]) {
      const r = await weddingRead({ ...base({ db, fetchImpl: net.fetchImpl }), body });
      expect(r.body, JSON.stringify((body as { consent?: unknown }).consent)).toMatchObject({ ok: true, reason: 'no_consent' });
      expect(r.body.read.by).toBe('fixed');
    }
    expect(net.calls).toHaveLength(0);
    const ticked = await weddingRead(base({ db, fetchImpl: net.fetchImpl, body: { ...DK, consent: true } }));
    expect(ticked.body.reason).toBe('ai');
    expect(net.calls.length).toBeGreaterThan(0);
  });
  it('answers with no email: a stranger gets an AI read, labelled as AI, with venue types and traced ideas', async () => {
    const { db } = fakeD1([]);
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    const r = await weddingRead(base({ db, fetchImpl: net.fetchImpl, body: { ...DK, email: 'x@example.com' } }));
    expect(r.body).toMatchObject({ ok: true, reason: 'ai', remaining: 2, limit: 3 });
    expect(r.body.read.by).toBe('ai');
    expect(r.body.read.ideas.map(i => i.id)).toEqual(['dinner-party-layout', 'secret-garden-at-night']);
    expect(net.calls.every(c => !c.body.includes('x@example.com') && !c.body.includes('1.1.1.1'))).toBe(true);
  });

  it('questions to ask are never empty: a list of objects is read, and none at all falls back to our own', async () => {
    const { db } = fakeD1();
    const net = fakeNet({ gemini: () => geminiAnswer(good({ ask_vendors: [{ vendor: 'Caterer', question: 'How does food stay warm outdoors?' }] })) });
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl }))).body.read.ask).toEqual(['Caterer: How does food stay warm outdoors?']);
    const net2 = fakeNet({ gemini: () => geminiAnswer(good({ ask_vendors: [] })) });
    expect((await weddingRead(base({ db, fetchImpl: net2.fetchImpl, ip: '9.9.9.9' }))).body.read.ask.length).toBeGreaterThan(0);
  });

  it('a booked venue gets no venue types, even when the model offers some', async () => {
    const { db } = fakeD1();
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    const r = await weddingRead(base({ db, fetchImpl: net.fetchImpl, body: { ...DK, facts: { ...DK.facts, venueBooked: true } } }));
    expect(r.body.reason).toBe('ai');
    expect(r.body.read.venueTypes).toEqual([]);
  });

  it(`three answers per visitor per day; the fourth is the fixed-list answer with no model asked`, async () => {
    const { db } = fakeD1();
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    for (let i = 0; i < ANSWERS_PER_VISITOR_PER_DAY; i++) expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl }))).body).toMatchObject({ reason: 'ai', remaining: 2 - i });
    const before = net.calls.length;
    const fourth = await weddingRead(base({ db, fetchImpl: net.fetchImpl }));
    expect(fourth.status).toBe(200);
    expect(fourth.body).toMatchObject({ ok: true, reason: 'visitor_limit', remaining: 0 });
    expect(fourth.body.read.by).toBe('fixed');
    expect(net.calls.length).toBe(before);
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '2.2.2.2' }))).body.reason).toBe('ai');
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, today: '2026-11-14', now: new Date('2026-11-14T18:00:00Z') }))).body.reason).toBe('ai');
  });

  it('a tester on DW_TESTER_IP_HASHES gets more than three AI answers, every row is a test row; nothing else unlocks it', async () => {
    const { db, sqlite } = fakeD1();
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    const mine = await sha256('s:ip:7.7.7.7');
    const list = `${'a'.repeat(64)}, ${mine}`;
    for (let i = 0; i < 5; i++) expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '7.7.7.7', testerHashes: list }))).body).toMatchObject({ reason: 'ai', limit: TESTER_ANSWERS_PER_DAY, remaining: TESTER_ANSWERS_PER_DAY - 1 - i });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM wedding_reads WHERE is_test = 1 AND ip_hash = ?').get(mine)).toMatchObject({ n: 5 });
    // Anyone else, even with the test header or the list set: three.
    for (let i = 0; i < ANSWERS_PER_VISITOR_PER_DAY; i++) await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '8.8.8.8', testerHashes: list, isTest: true }));
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '8.8.8.8', testerHashes: list, isTest: true }))).body).toMatchObject({ reason: 'visitor_limit', limit: ANSWERS_PER_VISITOR_PER_DAY });
    // A hash that is not a whole 64-character entry never matches (no prefixes, no empty list).
    for (let i = 0; i < ANSWERS_PER_VISITOR_PER_DAY; i++) await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '6.6.6.6', testerHashes: (await sha256('s:ip:6.6.6.6')).slice(0, 40) }));
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '6.6.6.6', testerHashes: '' }))).body.reason).toBe('visitor_limit');
    // The tester's reach row is a test row too.
    await recordReach({ db, via: 'date', ip: '7.7.7.7', today: TODAY, salt: 's', isTest: false, testerHashes: list });
    await recordReach({ db, via: 'date', ip: '5.5.5.5', today: TODAY, salt: 's', isTest: false, testerHashes: list });
    expect(sqlite.prepare('SELECT ip_hash = ? AS mine, is_test FROM journey_plan_reach ORDER BY id').all(mine)).toEqual([{ mine: 1, is_test: 1 }, { mine: 0, is_test: 0 }]);
  });

  it('the fixed-list headline is a sentence about her wedding, never her raw typing', () => {
    const typed = 'Italian villa feel, candlelit long tables, 100 people';
    const h = fixedRead(cleanAnswers({ path: 'idea', wish: typed })).headline;
    expect(h).not.toContain(typed);
    expect(h).toMatch(/^An? .*wedding with an Italian feel,.* for 100\.$/);
    expect(fixedRead(cleanAnswers({ path: 'idea', wish: 'barn wedding outside, 80 guests', facts: { where: 'Nashville' } })).headline).toMatch(/^A .*wedding outdoors in Nashville, for 80\.$/);
    expect(fixedRead(cleanAnswers({ path: 'dk', season: 'Fall', setting: 'Outdoors', moods: ['Garden'] })).headline).toBe('A garden wedding outdoors in the fall.');
  });

  it('an IPv6 visitor is one visitor across rotating privacy addresses (the /64), so a fresh address gives no fresh answers', async () => {
    expect(visitorIp('2601:3cb:500:15e1:4566:b26c:ab5b:fbff')).toBe('2601:3cb:500:15e1::/64');
    expect(visitorIp('2601:03CB:0500:15E1::1')).toBe('2601:3cb:500:15e1::/64');
    expect(visitorIp('2601:3cb::1')).toBe('2601:3cb:0:0::/64');
    expect(visitorIp('73.177.119.73')).toBe('73.177.119.73');
    expect(visitorIp('::ffff:73.177.119.73')).toBe('73.177.119.73');
    expect(visitorIp('')).toBe('unknown');
    const { db } = fakeD1();
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    for (let i = 0; i < ANSWERS_PER_VISITOR_PER_DAY; i++) await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: `2601:3cb:500:15e1:aaaa:bbbb:cccc:${i}` }));
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '2601:3cb:500:15e1:1111:2222:3333:4444' }))).body.reason).toBe('visitor_limit');
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '2601:3cb:500:15e2::9' }))).body.reason).toBe('ai');
    // A tester entry made from the /64 keeps working after the address rotates.
    const entry = await sha256('s:ip:2601:3cb:500:15e1::/64');
    expect((await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '2601:3cb:500:15e1:9999::1', testerHashes: entry }))).body).toMatchObject({ reason: 'ai', limit: TESTER_ANSWERS_PER_DAY });
  });

  it('a repeat "I don\'t know yet" answer comes from the 7-day cache with no model call; words, an image and test traffic never use or fill it; a different town is a different answer', async () => {
    const { db, sqlite } = fakeD1();
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    const first = await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '3.3.3.1', isTest: true }));
    expect(first.body.reason).toBe('ai');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM wedding_read_cache').get()).toMatchObject({ n: 0 });
    await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '3.3.3.2' }));
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM wedding_read_cache').get()).toMatchObject({ n: 1 });
    const before = net.calls.length;
    const repeat = await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '3.3.3.3' }));
    expect(repeat.body).toMatchObject({ ok: true, reason: 'ai', remaining: 2 });
    expect(net.calls.length).toBe(before);
    expect(sqlite.prepare("SELECT model FROM wedding_reads ORDER BY id DESC LIMIT 1").get()).toMatchObject({ model: 'cache' });
    // Different taps, or her own words, are asked fresh.
    await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '3.3.3.4', body: { ...DK, moods: ['Party'] } }));
    expect(net.calls.length).toBeGreaterThan(before);
    expect(readCacheKey(cleanAnswers({ path: 'idea', wish: 'a barn' }))).toBeNull();
    expect(readCacheKey(cleanAnswers({ ...DK, facts: { where: 'Nashville', guests: '100' } }))).not.toBe(readCacheKey(cleanAnswers(DK)));
    // An image in the body is ignored (photos never leave her device), so it cannot change the key.
    expect(readCacheKey(cleanAnswers({ ...DK, photos: [{ loves: [], colours: [], image: 'QUJD' }] }))).toBe(readCacheKey(cleanAnswers({ ...DK, photos: [{ loves: [], colours: [] }] })));
    // Photo colours share an answer by bucket.
    expect(readCacheKey(cleanAnswers({ ...DK, photos: [{ loves: [], colours: ['#7f001f'] }] }))).toBe(readCacheKey(cleanAnswers({ ...DK, photos: [{ loves: [], colours: ['#78041c'] }] })));
    // Older than 7 days: asked fresh.
    sqlite.exec("UPDATE wedding_read_cache SET created_at = datetime('now', '-8 days')");
    const n = net.calls.length;
    await weddingRead(base({ db, fetchImpl: net.fetchImpl, ip: '3.3.3.5' }));
    expect(net.calls.length).toBeGreaterThan(n);
  });

  it('past the global daily ceiling: the fixed-list answer, no model asked', async () => {
    const { db, sqlite } = fakeD1();
    sqlite.exec(`CREATE TABLE IF NOT EXISTS wedding_reads (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT NOT NULL, day TEXT NOT NULL, outcome TEXT NOT NULL, model TEXT, photos INTEGER NOT NULL DEFAULT 0, is_test INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const ins = sqlite.prepare(`INSERT INTO wedding_reads (ip_hash, day, outcome, model) VALUES ('h', ?, 'ok', 'gemini:x')`);
    for (let i = 0; i < MODEL_CALLS_PER_DAY_GLOBAL; i++) ins.run(TODAY);
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    const r = await weddingRead(base({ db, fetchImpl: net.fetchImpl }));
    expect(r.body).toMatchObject({ ok: true, reason: 'daily_ceiling' });
    expect(net.calls).toEqual([]);
  });

  it('a failed check retries once on the next free model; a second failure is the fixed-list answer', async () => {
    const { db } = fakeD1();
    const bad = good({ read: 'We think this is perfect for you.' });
    const net = fakeNet({ gemini: m => geminiAnswer(m === GEM[0] ? bad : good()) });
    const r = await weddingRead(base({ db, fetchImpl: net.fetchImpl }));
    expect(r.body.reason).toBe('ai');
    expect(net.calls.map(c => c.model)).toEqual([PROBE, GEM[0], GEM[1]]);

    const { db: db2 } = fakeD1();
    const italian = good({ ideas: [{ id: 'gelato-cart', why: 'Sweet.' }] });
    const net2 = fakeNet({ gemini: m => geminiAnswer(m === GEM[0] ? bad : italian), openrouter: m => orAnswer(m, good()) });
    const r2 = await weddingRead(base({ db: db2, fetchImpl: net2.fetchImpl }));
    expect(r2.body).toMatchObject({ ok: true, reason: 'checks_failed' });
    expect(r2.body.read.by).toBe('fixed');
    expect(net2.calls.map(c => c.model)).toEqual([PROBE, GEM[0], GEM[1]]);
  });

  it('switched off, or no database: the fixed-list answer, never an error', async () => {
    const net = fakeNet({});
    expect((await weddingRead(base({ db: fakeD1().db, fetchImpl: net.fetchImpl, enabled: false }))).body).toMatchObject({ ok: true, reason: 'off' });
    expect((await weddingRead(base({ db: undefined, fetchImpl: net.fetchImpl }))).body).toMatchObject({ ok: true, reason: 'off' });
    expect(net.calls).toEqual([]);
  });

  it('a photo never reaches a model, even if an old client sends one; its colours do, and nothing of it is stored', async () => {
    const { db, sqlite } = fakeD1();
    const image = Buffer.from('fake-jpeg-bytes-for-the-test').toString('base64');
    const net = fakeNet({ gemini: () => geminiAnswer(good()), openrouter: m => orAnswer(m, good()) });
    const r = await weddingRead(base({ db, fetchImpl: net.fetchImpl, body: { ...DK, photos: [{ loves: ['The table'], colours: ['#aa8855'], image }, { loves: ['The light'], colours: ['#112233'] }] } }));
    expect(r.body.reason).toBe('ai');
    const models = net.calls.filter(c => !c.body.includes('"maxOutputTokens":1') && c.model !== PROBE);
    expect(models.length).toBeGreaterThan(0);
    expect(net.calls.some(c => c.body.includes(image) || c.body.includes('inline_data'))).toBe(false);
    expect(models.some(c => c.body.includes('#aa8855') && c.body.includes('#112233'))).toBe(true);
    expect(r.body.read.photoNotes).toEqual([]);
    const stored = JSON.stringify(sqlite.prepare('SELECT * FROM wedding_reads').all()) + JSON.stringify(sqlite.prepare('SELECT * FROM ai_route_usage').all());
    expect(stored).not.toContain(image);
  });

  it('her own words reach the model with no email, phone number, street address or link; the town, size, budget and tradition stay', async () => {
    const { db } = fakeD1();
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    const wish = 'Garden party like our friends had, email me at jo.smith+wed@gmail.com or call (901) 555-0142 or +1 901.555.0199, venue at 4500 N Main Street Apt 2, ideas from https://pinterest.com/jo/boards and www.example.org/x and mysite.com';
    await weddingRead(base({ db, fetchImpl: net.fetchImpl, body: { path: 'idea', wish, facts: { where: 'Memphis', guests: '100', budget: 'Under $10,000', tradition: 'Jewish' } } }));
    const sent = net.calls.filter(c => c.body.includes('Garden party'));
    expect(sent.length).toBeGreaterThan(0);
    for (const c of sent) {
      for (const leak of ['jo.smith', 'gmail.com', '555-0142', '555.0199', '4500 N Main', 'pinterest.com', 'www.example.org', 'mysite.com']) expect(c.body, leak).not.toContain(leak);
      for (const kept of ['Memphis', 'about 100', 'Under $10,000', 'Jewish']) expect(c.body, kept).toContain(kept);
    }
  });
});

describe('$0: no paid route is reachable from the journey', () => {
  it('in every path, each call is the billing probe or a configured free model, OpenRouter is capped at $0, and billing attached stops Gemini', async () => {
    const freeGemini = new Set(GEM);
    const freeOpenRouter = new Set(llmConfig.models.map(m => m.id));
    expect([...freeOpenRouter].every(id => id.endsWith(':free'))).toBe(true);
    expect(llmConfig.policy).toMatchObject({ max_cost_usd: 0, paid_fallback: false });
    const photo = { ...DK, photos: [{ loves: ['The table'], colours: [], image: Buffer.from('x').toString('base64') }] };
    const scenarios = [
      { body: DK, net: { gemini: () => geminiAnswer(good()) } },
      { body: ITALIAN, net: { gemini: () => geminiQuota(), openrouter: (m: string) => orAnswer(m, good({ venue_types: [] })) } },
      { body: photo, net: { gemini: () => geminiQuota(true), openrouter: () => orDown(429, 'Rate limit exceeded: free-models-per-day') } },
      { body: DK, net: { gemini: () => geminiAnswer('We love it'), openrouter: (m: string) => orAnswer(m, 'not json') } },
      { body: photo, net: { billing: () => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: 'hi' }] } }] } }), openrouter: (m: string) => orAnswer(m, good()) }, attached: true }
    ];
    for (const s of scenarios) {
      const { db } = fakeD1();
      const net = fakeNet(s.net);
      const r = await weddingRead(base({ db, fetchImpl: net.fetchImpl, body: s.body }));
      expect(r.status).toBe(200);
      for (const c of net.calls) {
        if (c.provider === 'gemini') expect(c.model === PROBE ? JSON.parse(c.body).generationConfig.maxOutputTokens : freeGemini.has(c.model), c.model).toBeTruthy();
        else {
          expect(freeOpenRouter.has(c.model), c.model).toBe(true);
          expect(JSON.parse(c.body).provider.max_price).toEqual({ prompt: 0, completion: 0 });
        }
      }
      const probes = net.calls.filter(c => c.model === PROBE);
      expect(probes.length).toBeLessThanOrEqual(1);
      if (s.attached) expect(net.calls.filter(c => c.provider === 'gemini' && c.model !== PROBE)).toEqual([]);
    }
    // A reported cost is a policy breach: the run stops and she gets the fixed-list answer.
    const { db } = fakeD1();
    const net = fakeNet({ gemini: () => geminiQuota(), openrouter: m => orAnswer(m, good(), 0.0004) });
    const r = await weddingRead(base({ db, fetchImpl: net.fetchImpl }));
    expect(r.body.read.by).toBe('fixed');
    expect(net.calls.filter(c => c.provider === 'openrouter')).toHaveLength(1);
    // And the journey's only door to a model is the $0 router.
    const src = readFileSync('lib/wedding-read.ts', 'utf8') + readFileSync('app/api/wedding-read/route.ts', 'utf8') + readFileSync('components/WeddingJourney.tsx', 'utf8');
    expect(src).not.toMatch(/https?:\/\/(?!localhost)[a-z0-9.-]+\.(?:com|ai|io|xyz)/i);
    expect(src.match(/from '@\/scripts\/llm\/[^']+'/g)).toEqual(["from '@/scripts/llm/free_router.mjs'"]);
  });
});

describe('her colours (her words, 14 Nov 2026: "i may not have ideas but that doesnt mean i dont have colors")', () => {
  const HERS = ['Sage', 'Navy'];
  it('her colours are always shown unchanged: the AI read and the fixed-list read both carry exactly hers, and the model is told to build on them', async () => {
    const { db } = fakeD1();
    // The model answers with other colours; hers still come back exactly, in her order.
    const net = fakeNet({ gemini: () => geminiAnswer(good()) });
    const ai = await weddingRead(base({ db, fetchImpl: net.fetchImpl, body: { ...DK, colours: [...HERS, 'Neon', 'Sage'] } }));
    expect(ai.body.read.by).toBe('ai');
    const fixed = await weddingRead(base({ db, enabled: false, body: { ...ITALIAN, colours: HERS } }));
    for (const read of [ai.body.read, fixed.body.read]) {
      const view = colourView(read);
      expect(view).toMatchObject({ mode: 'yours', yours: herSwatches(HERS) });
      if (view.mode !== 'yours') throw new Error('not hers');
      expect(view.goesWith.length).toBeLessThanOrEqual(2);
      expect(view.goesWith.some(g => HERS.includes(g.name))).toBe(false);
      expect(read.colourIdeas).toEqual([]);
    }
    expect(net.calls.some(c => c.body.includes('Her own colours, which she chose herself: Sage, Navy'))).toBe(true);
    expect(fixed.body.read.read).toContain('your colors: sage and navy');
    // The kept palette is her colours: keeping "My colours" decides exactly hers.
    const groups = pickable(fixed.body.read, false);
    expect(keptColours(fixed.body.read, [groups.colours[0].pick])).toEqual(HERS);
  });

  it('no colours chosen: three ideas to try, none called hers, and nothing decided unless she keeps one', async () => {
    const { db } = fakeD1();
    const r = await weddingRead(base({ db, enabled: false, body: DK }));
    const view = colourView(r.body.read);
    expect(view.mode).toBe('ideas');
    if (view.mode !== 'ideas') throw new Error('not ideas');
    expect(view.ideas).toHaveLength(3);
    expect(new Set(view.ideas.map(i => i.name)).size).toBe(3);
    expect(r.body.read.yourColours).toEqual([]);
    const groups = pickable(r.body.read, false);
    expect(groups.colours).toHaveLength(3);
    // Nothing kept = nothing decided; keeping one then another keeps only the last.
    expect(keptColours(r.body.read, [])).toEqual([]);
    const kept = togglePick(togglePick([], groups.colours[0].pick), groups.colours[1].pick);
    expect(kept.map(p => p.key)).toEqual([groups.colours[1].pick.key]);
    expect(keptColours(r.body.read, kept)).toEqual(view.ideas[1].colours.map(c => c.name));
    expect(togglePick(kept, groups.colours[1].pick)).toEqual([]);
  });

  it('only real colour names from the list are accepted, "Not sure yet" clears them, and her colours change the cached answer', () => {
    expect(cleanAnswers({ colours: ['Sage', '<b>', 'Sage', 'Gold'] }).colours).toEqual(['Sage', 'Gold']);
    expect(toggleColour(['Sage'], 'Not sure yet')).toEqual([]);
    expect(toggleColour(['Sage'], 'Navy')).toEqual(['Sage', 'Navy']);
    expect(toggleColour(['Sage', 'Navy'], 'Sage')).toEqual(['Navy']);
    expect(readCacheKey(cleanAnswers(DK))).not.toBe(readCacheKey(cleanAnswers({ ...DK, colours: HERS })));
  });
});

// First-time test on the phone (14 Nov 2026): on the "I don't know yet" path with no guest
// count, the answer said "Host 120 guests" and "for 120". A guest count is only ever hers.
describe('a guest count is never invented', () => {
  const noCount = cleanAnswers({ path: 'dk', season: 'Fall', setting: 'Outdoors', moods: ['Garden'], facts: { where: 'Napa' } });
  const r = (over: Partial<WeddingRead> = {}) => ({ ...fixedRead(noCount), by: 'ai' as const, ...over });
  it('with no count given, any number of guests, seats or meals is refused, and "for 120" in the headline too', () => {
    expect(checkRead(r(), noCount)).toEqual([]);
    for (const [field, text] of [['read', 'Host 120 guests under the trees.'], ['headline', 'Sage and gold garden dinner in Napa for 120'], ['details', 'Table lamps across 120 seats'], ['ask', 'Ask the caterer how 120 meals stay hot outdoors.'], ['honest', 'Sourcing 100 to 150 chairs takes time.']] as const) {
      const bad = field === 'details' || field === 'ask' ? r({ [field]: [text] }) : r({ [field]: text });
      expect(checkRead(bad, noCount).some(f => f.startsWith('headcount:')), text).toBe(true);
    }
    expect(checkRead(r({ read: 'Plan the long tables around your guests.', details: ['Lamps on every table for 30 minutes of golden hour'] }), noCount)).toEqual([]);
  });
  // Simulator retest (14 Nov 2026): "the warm candle glow across your guest count".
  it('"guest count" never stands in for guests in the prose; a vendor question or the honest note may use it', () => {
    for (const [field, text] of [['read', 'The warm candle glow across your guest count.'], ['headline', 'Garden dinner in Napa for your guest count'], ['details', 'Lamps sized to your guest-count']] as const) {
      const bad = field === 'details' ? r({ [field]: [text] }) : r({ [field]: text });
      expect(checkRead(bad, noCount).some(f => f.startsWith('headcount:')), text).toBe(true);
      expect(checkRead(bad, cleanAnswers({ ...DK })).some(f => f.startsWith('headcount:')), text).toBe(true);
    }
    expect(checkRead(r({ ask: ['Ask the venue the largest guest count it seats outdoors.'], honest: 'Settle your guest count before you book the caterer.' }), noCount)).toEqual([]);
  });
  it('her own number passes and any other number fails; the prompt tells the model which', () => {
    const withCount = cleanAnswers({ ...DK });
    expect(checkRead(read({ read: 'Host 100 guests under the trees.' }), withCount)).toEqual([]);
    expect(checkRead(read({ read: 'Host 120 guests under the trees.' }), withCount).some(f => f.startsWith('headcount:'))).toBe(true);
    const typed = cleanAnswers({ path: 'idea', wish: 'a garden dinner, 80 people' });
    expect(checkRead({ ...fixedRead(typed), by: 'ai', read: 'A dinner for 80 people under lights.' }, typed).filter(f => f.startsWith('headcount:'))).toEqual([]);
    expect(JSON.stringify(buildMessages(noCount, [], [], []))).toContain('has not given a guest count');
    expect(JSON.stringify(buildMessages(withCount, [], [], []))).toContain('Her guest count is 100');
  });
  it('a model answer that invents a count is not shown: the next free model answers instead', async () => {
    const { db } = fakeD1();
    const body = { path: 'dk', season: 'Fall', setting: 'Outdoors', moods: ['Relaxed', 'Garden'], facts: { where: 'Memphis' } };
    const invented = good({ headline: 'A relaxed garden wedding outdoors in Memphis, for 120', read: 'Host 120 guests at long tables in Memphis this fall. Lean on greenery so it feels grown.' });
    const clean = good({ headline: 'A relaxed garden wedding outdoors in Memphis in the fall' });
    const net = fakeNet({ gemini: m => geminiAnswer(m === GEM[0] ? invented : clean) });
    const res = await weddingRead(base({ db, body, fetchImpl: net.fetchImpl }));
    expect(res.body.reason).toBe('ai');
    expect(JSON.stringify(res.body.read)).not.toMatch(/\b120\b/);
  });
});

// Promise audit, 27 Nov 2026: the privacy page says a cached answer is kept for 7 days, then deleted.
describe('the answer cache is deleted after 7 days', () => {
  it('deletes only rows older than 7 days, and runs on an empty database', async () => {
    const { sqlite, db } = fakeD1();
    await purgeExpiredReadCache(db as never);
    sqlite.exec("INSERT INTO wedding_read_cache (cache_key, read, created_at) VALUES ('old', '{}', datetime('now', '-8 days')), ('edge', '{}', datetime('now', '-6 days', '-23 hours')), ('new', '{}', datetime('now'))");
    await purgeExpiredReadCache(db as never);
    expect(sqlite.prepare('SELECT cache_key FROM wedding_read_cache ORDER BY cache_key').all().map((r) => (r as { cache_key: string }).cache_key)).toEqual(['edge', 'new']);
  });
  it('a database that fails ends the purge as a failure, never as "0 deleted"', async () => {
    const down = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 down'); } }), run: async () => { throw new Error('D1 down'); } }) };
    await expect(purgeExpiredReadCache(down as never)).rejects.toThrow('D1 down');
  });
  it('the hourly worker runs the purge', () => {
    expect(readFileSync('worker.ts', 'utf8')).toMatch(/ctx\.waitUntil\(purgeExpiredReadCache\(env\.DB/);
  });
});
