// The free journey on the phone (docs/APP_PLAN.md, pattern (j)): she says what her wedding
// should feel like, the website's free endpoint describes it (free AI models only, three
// answers a day, the fixed-list answer otherwise; lib/wedding-read.ts), she keeps what she
// loves, and each kept row becomes her own task marked "Your pick" in the window that job
// is usually done. No model, key or email is on the phone.
import { addCustomTask, taskKey, type PlanProgress } from '@core/plan-progress';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { pickable, type JourneyPick } from '@core/journey-picks';
import type { WeddingRead } from '@core/wedding-read-shared';
import { ownTaskKey } from './planTasks';
import type { DateStorage } from './weddingDate';

export { SEASONS, SETTINGS, MOODS } from '@core/wedding-read-shared';
export { pickable };
export type { JourneyPick, WeddingRead };

const ORIGIN = 'https://weddingchecklistpdf.com';
export const JOURNEY_STORE_KEY = 'dw.journey.v1';
/** Her own tasks made from a pick carry this id prefix, so the plan can mark them "Your pick". */
export const PICK_PREFIX = 'pick-';
export const isPick = (id: string | undefined) => !!id && id.startsWith(PICK_PREFIX);

export interface JourneyAnswers {
  path: 'idea' | 'dk'; wish: string; season: string; setting: string; moods: string[];
  where: string; guests: string; venueBooked: boolean;
}
export type ReadReason = 'ai' | 'visitor_limit' | 'daily_ceiling' | 'off' | 'no_model' | 'checks_failed';
export type ReadReply =
  | { ok: true; read: WeddingRead; reason: ReadReason; remaining: number | null; limit: number }
  | { ok: false; message: string };
type Transport = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** What the label under her answer says: who wrote it, honestly. */
export function readLabel(by: WeddingRead['by'], reason: ReadReason): string {
  if (by === 'ai') return 'Written by an AI planner, not a person. Check anything that matters with your vendors. No businesses, prices or availability are named.';
  return reason === 'visitor_limit'
    ? 'You have used today’s three AI answers, so this one comes from our fixed lists, without AI. More tomorrow.'
    : 'The free AI planner could not answer just now, so this comes from our fixed lists, without AI.';
}

const isRead = (v: unknown): v is WeddingRead => {
  const r = v as WeddingRead;
  return !!r && typeof r === 'object' && typeof r.headline === 'string' && typeof r.read === 'string'
    && [r.directions, r.colours, r.venueTypes, r.ideas, r.details, r.ask].every(Array.isArray);
};

/** Asks the website for her wedding page. The preview marks its calls as tests so they never count. */
export function weddingReadClient(preview: boolean, send: Transport = fetch) {
  let pending = false;
  return {
    async request(a: JourneyAnswers): Promise<ReadReply> {
      if (pending) return { ok: false, message: 'Your wedding is still being written.' };
      if (a.path === 'idea' && !a.wish.trim()) return { ok: false, message: 'Say a few words about the wedding you picture first.' };
      pending = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await send(ORIGIN + '/api/wedding-read', {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(preview ? { 'x-dw-test': '1' } : {}) },
          body: JSON.stringify({ path: a.path, wish: a.path === 'idea' ? a.wish : '', season: a.season, setting: a.setting, moods: a.moods, photos: [],
            facts: { where: a.where, guests: a.guests, venueBooked: a.venueBooked } }),
        });
        const body = await res.json() as Record<string, unknown>;
        if (!res.ok || body?.ok !== true || !isRead(body.read)) throw new Error('bad reply');
        return { ok: true, read: body.read, reason: (body.reason as ReadReason) ?? 'no_model',
          remaining: typeof body.remaining === 'number' ? body.remaining : null, limit: typeof body.limit === 'number' ? body.limit : 3 };
      } catch {
        return { ok: false, message: 'The planner could not be reached. Check your connection and try again, or go straight to your plan.' };
      } finally { clearTimeout(timer); pending = false; }
    },
  };
}

const VENUE_TASK = PLAN_WINDOWS.flatMap(w => w.tasks.map(t => ({ windowId: w.id, text: t }))).find(t => /^Book the venue\b/.test(t.text));

const slug = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Her kept rows become her own tasks. Asking again replaces the picks she has not ticked;
 * a ticked pick stays. A booked venue ticks "Book the venue", because it is done. */
export function applyPicks(progress: PlanProgress, picks: JourneyPick[], venueBooked: boolean, now: string): PlanProgress {
  const windows = new Set(PLAN_WINDOWS.map(w => w.id));
  const keep = progress.custom.filter(t => !isPick(t.id) || progress.done[ownTaskKey(t.id)]);
  let next: PlanProgress = { done: { ...progress.done }, custom: keep };
  for (const p of picks) {
    const id = PICK_PREFIX + slug(p.key);
    if (!windows.has(p.windowId) || next.custom.some(t => t.id === id)) continue;
    next = addCustomTask(next, p.windowId, p.text, id);
  }
  if (venueBooked && VENUE_TASK) {
    const key = taskKey(VENUE_TASK.windowId, VENUE_TASK.text);
    if (!next.done[key]) next = { ...next, done: { ...next.done, [key]: now } };
  }
  return next;
}

export interface SavedJourney { answers: JourneyAnswers; read: WeddingRead | null; reason: ReadReason; picks: JourneyPick[] }

/** What she said and her page stay on this phone, so coming back shows them. Junk reads as nothing. */
export function journeyStore(storage: DateStorage) {
  return {
    async read(): Promise<SavedJourney | null> {
      try {
        const v = JSON.parse(await storage.getItem(JOURNEY_STORE_KEY) ?? 'null') as SavedJourney | null;
        if (!v || typeof v !== 'object' || !v.answers || typeof v.answers !== 'object') return null;
        return { answers: v.answers, read: isRead(v.read) ? v.read : null, reason: v.reason ?? 'no_model', picks: Array.isArray(v.picks) ? v.picks : [] };
      } catch { return null; }
    },
    save: (j: SavedJourney) => storage.setItem(JOURNEY_STORE_KEY, JSON.stringify(j)),
  };
}
