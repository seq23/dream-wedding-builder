import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, taskKey, toggleDone } from '@core/plan-progress';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { directionPick, ideaPick, venuePick } from '@core/journey-picks';
import { applyPicks, isPick, journeyStore, readLabel, weddingReadClient, type JourneyAnswers } from '../src/journey';
import { base64Bytes, strongestColours } from '../src/photoColours';
import { ownTaskKey, taskRows } from '../src/planTasks';

const NOW = '2026-11-13T12:00:00.000Z';
const answers: JourneyAnswers = { path: 'dk', wish: '', season: 'Fall', setting: 'Outdoors', moods: ['Garden'], where: '', guests: '120', budget: '', tradition: '', venueBooked: false, dateSet: false };
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
  await weddingReadClient(false, send).request({ ...answers, budget: 'Under $10,000', tradition: 'Jewish', dateSet: true }, [{ loves: ['The light'], colours: ['#aabbcc'] }, { loves: [], colours: [], image: 'AAAA' }, { loves: [], colours: [] }, { loves: [], colours: [] }]);
  const sent = JSON.parse(String(calls[1].init.body));
  assert.equal(sent.photos.length, 3, 'at most three photos');
  assert.equal(sent.photos[0].image, undefined, 'a photo she did not tick is never sent as an image');
  assert.equal(sent.photos[1].image, 'AAAA');
  assert.deepEqual([sent.facts.budget, sent.facts.tradition, sent.facts.dateSet], ['Under $10,000', 'Jewish', true]);
  assert.equal((calls[1].init.headers as Record<string, string>)['x-dw-test'], undefined, 'a store build never marks itself as a test');
});

test('the client turns a bad reply or no connection into a plain message, and an empty idea is not sent', async () => {
  const bad = await weddingReadClient(false, async () => ({ ok: true, json: async () => ({ ok: true, read: { headline: 1 } }) })).request(answers);
  assert.equal(bad.ok, false);
  const down = await weddingReadClient(false, async () => { throw new Error('offline'); }).request(answers);
  assert.ok(!down.ok && /could not be reached/.test(down.message));
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
