import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, taskKey, toggleDone } from '@core/plan-progress';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { directionPick, ideaPick, venuePick } from '@core/journey-picks';
import { READ_FAILED, applyPicks, applyTradition, colourView, isPick, journeyStore, keptColours, pickable, readLabel, togglePick, weddingReadClient, type JourneyAnswers, type WeddingRead } from '../src/journey';
import { base64Bytes, strongestColours } from '../src/photoColours';
import { ownTaskKey, taskRows } from '../src/planTasks';

const NOW = '2026-11-13T12:00:00.000Z';
const answers: JourneyAnswers = { path: 'dk', wish: '', colours: [], season: 'Fall', setting: 'Outdoors', moods: ['Garden'], where: '', guests: '120', budget: '', tradition: '', venueBooked: false, dateSet: false };
const read = { by: 'ai', headline: 'A garden in the fall', read: 'Soft and green.', directions: [{ name: 'Garden', what: 'x' }], colours: [{ name: 'Sage', hex: '#9CAF88' }], venueTypes: [], ideas: [], details: [], ask: [], honest: '', photoNotes: [] };
const venueTask = PLAN_WINDOWS.flatMap(w => w.tasks.map(t => ({ w: w.id, t }))).find(x => /^Book the venue\b/.test(x.t))!;

test('kept rows become her own tasks in their windows, marked as picks', () => {
  const picks = [directionPick({ name: 'Garden party' }), venuePick({ id: 'barn', name: 'A barn' }), ideaPick({ id: 'i1', name: 'Lantern walk' })];
  const p = applyPicks(emptyProgress(), picks, false, NOW);
  assert.equal(p.custom.length, 3);
  for (const pick of picks) assert.ok(p.custom.some(t => t.windowId === pick.windowId && t.text === pick.text && isPick(t.id)), pick.text);
  const rows = taskRows(p).filter(r => isPick(r.ownId));
  assert.equal(rows.length, 3, 'the plan screen draws every pick');
  assert.equal(p.done[taskKey(venueTask.w, venueTask.t)], undefined, 'venue not booked: the venue task stays open');
});

test('asking again replaces untouched picks, keeps ticked ones, never duplicates, and ignores a window the plan does not have', () => {
  const first = applyPicks(emptyProgress(), [directionPick({ name: 'A' }), directionPick({ name: 'B' })], false, NOW);
  const ticked = toggleDone(first, ownTaskKey(first.custom[0].id), NOW);
  const mine = { ...ticked, custom: [...ticked.custom, { id: 'own-1', windowId: PLAN_WINDOWS[0].id, text: 'My own task' }] };
  const again = applyPicks(mine, [directionPick({ name: 'A' }), directionPick({ name: 'C' }), { key: 'x', text: 'Odd', windowId: 'nowhere' as never }], false, NOW);
  assert.deepEqual(again.custom.map(t => t.text).sort(), ['Brief every vendor on the direction: A', 'Brief every vendor on the direction: C', 'My own task']);
  assert.ok(again.done[ownTaskKey(first.custom[0].id)], 'a ticked pick stays ticked');
});

test('a booked venue ticks "Book the venue"', () => {
  const p = applyPicks(emptyProgress(), [], true, NOW);
  assert.equal(p.done[taskKey(venueTask.w, venueTask.t)], NOW);
});

test('the client sends her answers to the website, marks preview calls as tests, and never sends photos or email', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const send = async (url: string, init: RequestInit) => { calls.push({ url, init }); return { ok: true, json: async () => ({ ok: true, read, reason: 'ai', remaining: 2, limit: 3 }) }; };
  const reply = await weddingReadClient(true, send).request(answers);
  assert.equal(reply.ok, true);
  assert.equal(calls[0].url, 'https://weddingchecklistpdf.com/api/wedding-read');
  assert.equal((calls[0].init.headers as Record<string, string>)['x-dw-test'], '1');
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.photos, [], 'no photo is sent unless she adds one');
  assert.equal(body.email, undefined);
  assert.equal(body.facts.guests, '120');
  await weddingReadClient(false, send).request({ ...answers, budget: 'Under $10,000', tradition: 'Jewish', dateSet: true }, [{ loves: ['The light'], colours: ['#aabbcc'] }, { loves: [], colours: [], image: 'AAAA' } as never, { loves: [], colours: [] }, { loves: [], colours: [] }]);
  const sent = JSON.parse(String(calls[1].init.body));
  assert.equal(sent.photos.length, 3, 'at most three photos');
  assert.ok(sent.photos.every((p: Record<string, unknown>) => p.image === undefined), 'a photo never leaves the phone, only its colours');
  assert.deepEqual(sent.photos[0], { loves: ['The light'], colours: ['#aabbcc'] });
  assert.deepEqual([sent.facts.budget, sent.facts.tradition, sent.facts.dateSet], ['Under $10,000', 'Jewish', true]);
  assert.equal((calls[1].init.headers as Record<string, string>)['x-dw-test'], undefined, 'a store build never marks itself as a test');
});

test('the client turns a bad reply or no connection into a plain message, and an empty idea is not sent', async () => {
  const bad = await weddingReadClient(false, async () => ({ ok: true, json: async () => ({ ok: true, read: { headline: 1 } }) })).request(answers);
  assert.equal(bad.ok, false);
  const down = await weddingReadClient(false, async () => { throw new Error('offline'); }).request(answers);
  assert.ok(!down.ok && down.message === READ_FAILED && !/photo|untick/i.test(down.message));
  let sent = 0;
  const empty = await weddingReadClient(false, async () => { sent++; return { ok: true, json: async () => ({}) }; }).request({ ...answers, path: 'idea', wish: '  ' });
  assert.equal(empty.ok, false); assert.equal(sent, 0);
  // An idea told only by a photo is fine.
  await weddingReadClient(false, async () => { sent++; return { ok: true, json: async () => ({}) }; }).request({ ...answers, path: 'idea', wish: '' }, [{ loves: ['The table'], colours: [] }]);
  assert.equal(sent, 1);
});

test('the label says honestly who wrote it', () => {
  assert.match(readLabel('ai', 'ai'), /AI planner, not a person/);
  assert.match(readLabel('fixed', 'visitor_limit'), /three AI answers/);
  assert.match(readLabel('fixed', 'no_model'), /without AI/);
});

test('saved journey: junk reads as nothing, a real one comes back', async () => {
  const mem = new Map<string, string>();
  const storage = { getItem: async (k: string) => mem.get(k) ?? null, setItem: async (k: string, v: string) => { mem.set(k, v); } };
  const s = journeyStore(storage);
  assert.equal(await s.read(), null);
  mem.set('dw.journey.v1', '{not json');
  assert.equal(await s.read(), null);
  await s.save({ answers, read: read as never, reason: 'ai', picks: [] });
  assert.equal((await s.read())?.read?.headline, 'A garden in the fall');
});

test('photo colours are read on the phone: base64 decodes exactly, and the strongest colour wins', () => {
  assert.deepEqual([...base64Bytes('AAEC/w==')], [0, 1, 2, 255]);
  const px: number[] = [];
  for (let i = 0; i < 30; i++) px.push(200, 40, 40, 255);
  for (let i = 0; i < 10; i++) px.push(20, 20, 220, 255);
  const c = strongestColours(px);
  assert.equal(c[0], '#c82828'); assert.equal(c[1], '#1414dc'); assert.equal(c.length, 2);
});

test('a known-colour JPEG (burgundy, tan, dark green) reads back as those three colours, once each', async () => {
  const { encode, decode } = await import('jpeg-js');
  const w = 48, h = 48, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = y >= 36 ? [1, 68, 33] : x >= 32 ? [210, 180, 140] : [128, 0, 32];
    data.set([...c, 255], (y * w + x) * 4);
  }
  const jpeg = encode({ data, width: w, height: h }, 90).data;
  let b64 = ''; const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < jpeg.length; i += 3) { const n = (jpeg[i] << 16) | ((jpeg[i + 1] ?? 0) << 8) | (jpeg[i + 2] ?? 0); b64 += A[n >> 18 & 63] + A[n >> 12 & 63] + (i + 1 < jpeg.length ? A[n >> 6 & 63] : '=') + (i + 2 < jpeg.length ? A[n & 63] : '='); }
  const got = strongestColours(decode(base64Bytes(b64), { useTArray: true }).data);
  const near = (hex: string, [r, g, b]: number[]) => Math.hypot(parseInt(hex.slice(1, 3), 16) - r, parseInt(hex.slice(3, 5), 16) - g, parseInt(hex.slice(5, 7), 16) - b) < 30;
  assert.ok(near(got[0], [128, 0, 32]), `burgundy first: ${got}`);
  assert.ok(got.some(c => near(c, [210, 180, 140])), `tan: ${got}`);
  assert.ok(got.some(c => near(c, [1, 68, 33])), `dark green: ${got}`);
  assert.equal(got.filter(c => near(c, [128, 0, 32])).length, 1, 'one swatch per colour');
});

test('a tradition picked in step 1 opens that pack\'s free example once; Other or none adds nothing', () => {
  const once = applyTradition(emptyProgress(), 'Catholic');
  assert.equal(once.custom.length, 1);
  assert.match(once.custom[0].text, /parish/);
  assert.equal(applyTradition(once, 'Catholic').custom.length, 1);
  assert.equal(applyTradition(emptyProgress(), 'Other').custom.length, 0);
  assert.equal(applyTradition(emptyProgress(), '').custom.length, 0);
});

// Her words, 14 Nov 2026: "i may not have ideas but that doesnt mean i dont have colors".
const hers = { ...read, yourColours: [{ name: 'Sage', hex: '#9CAF88' }, { name: 'Navy', hex: '#1F2A4A' }], goesWith: [{ name: 'Cream', hex: '#FDFBF7' }], colourIdeas: [] } as WeddingRead;
const none = { ...read, yourColours: [], goesWith: [], colourIdeas: [
  { name: 'Autumn warmth', colours: [{ name: 'Amber', hex: '#D9822B' }, { name: 'Olive', hex: '#556B2F' }, { name: 'Cream', hex: '#FDFBF7' }] },
  { name: 'Candlelit neutrals', colours: [{ name: 'Ivory', hex: '#FAF7F2' }, { name: 'Warm stone', hex: '#D3C2B1' }, { name: 'Midnight', hex: '#1B1F3B' }] },
  { name: 'Deep winter', colours: [{ name: 'Burgundy', hex: '#6D1A36' }, { name: 'Silver', hex: '#C0C0C0' }, { name: 'Snow', hex: '#F7F7F7' }] }] } as WeddingRead;

test('her colours are sent with her answers and always shown unchanged, with at most two that go with them', async () => {
  const calls: RequestInit[] = [];
  const send = async (_: string, init: RequestInit) => { calls.push(init); return { ok: true, json: async () => ({ ok: true, read: hers, reason: 'ai' }) }; };
  const reply = await weddingReadClient(false, send).request({ ...answers, path: 'dk', colours: ['Sage', 'Navy'] });
  assert.deepEqual(JSON.parse(String(calls[0].body)).colours, ['Sage', 'Navy']);
  assert.ok(reply.ok);
  assert.deepEqual(colourView(reply.read), { mode: 'yours', yours: hers.yourColours, goesWith: hers.goesWith });
  const groups = pickable(hers, false);
  assert.equal(groups.colours[0].label, 'My colours');
  assert.deepEqual(keptColours(hers, [groups.colours[0].pick]), ['Sage', 'Navy']);
  // A kept palette becomes one task in her plan, so the plan and the packet carry it.
  const p = applyPicks(emptyProgress(), [groups.colours[0].pick], false, NOW);
  assert.deepEqual(p.custom.map(t => t.text), ['Share your colours with the florist, stationer and baker: sage and navy']);
});

test('no colours chosen: ideas to try, never called hers, and nothing decided unless she keeps one', async () => {
  assert.equal(colourView(none).mode, 'ideas');
  const groups = pickable(none, false);
  assert.equal(groups.colours.length, 3);
  assert.deepEqual(keptColours(none, []), []);
  assert.equal(applyPicks(emptyProgress(), [], false, NOW).custom.length, 0, 'no palette kept: no colour task');
  const kept = togglePick(togglePick([], groups.colours[0].pick), groups.colours[2].pick);
  assert.deepEqual(keptColours(none, kept), ['Burgundy', 'Silver', 'Snow'], 'one palette at most: the later one replaces the first');
  // A journey saved before colours existed reads as "not sure yet".
  const mem = new Map<string, string>([['dw.journey.v1', JSON.stringify({ answers: { path: 'dk', wish: '' }, read: null, picks: [] })]]);
  const saved = await journeyStore({ getItem: async (k: string) => mem.get(k) ?? null, setItem: async (k: string, v: string) => { mem.set(k, v); } } as never).read();
  assert.deepEqual(saved?.answers.colours, []);
});
