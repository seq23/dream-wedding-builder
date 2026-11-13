// Steps 3 and 4 of the free journey: what she keeps from her wedding page becomes
// dated tasks marked "Your pick" in the one dated plan (lib/dated-plan.ts), which the
// planner, the dashboard and the printable page all draw. A booked venue takes the
// venue task out. Everything lives in this browser (localStorage), nothing is sent.
import type { WeddingRead } from '@/lib/wedding-read-shared';

/** The journey's own record in this browser: answers, her wedding page, her picks. */
export const JOURNEY_KEY = 'dwb-blend';
/** Fired after the journey saves, so every dated plan on the page redraws. */
export const JOURNEY_EVENT = 'dwb-updated';

export type PickWindow = '12-plus' | '9-months' | '6-months';
export interface JourneyPick { key: string; text: string; windowId: PickWindow }
export interface JourneyPlanInput { picks: JourneyPick[]; venueBooked: boolean }
export const NO_PICKS: JourneyPlanInput = { picks: [], venueBooked: false };

// A detail is turned into the job it needs, in the window that job is usually done.
const DETAIL_JOBS: [RegExp, string, PickWindow][] = [
  [/\b(light|lights|lighting|candle|candles|candlelit|lantern|lanterns|glow|string)\b/i, 'Plan the lighting', '6-months'],
  [/\b(flower|flowers|floral|bloom|blooms|rose|roses|greenery|foliage|arrangement|arrangements|petal|petals|herb|herbs)\b/i, 'Brief the florist', '9-months'],
  [/\b(music|band|dj|guitar|quartet|singer|song|songs|playlist|jazz|choir|sax)\b/i, 'Book the music', '6-months'],
  [/\b(food|menu|dinner|platter|platters|dessert|cake|cocktail|cocktails|bar|tasting|dish|dishes|course|pasta|buffet)\b/i, 'Book a tasting', '9-months'],
  [/\b(table|tables|linen|linens|chair|chairs|runner|runners|rental|rentals|tent)\b/i, 'Reserve rentals', '9-months']
];

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

export function directionPick(d: { name: string }): JourneyPick {
  return { key: `direction:${d.name}`, text: `Brief every vendor on the direction: ${d.name}`, windowId: '12-plus' };
}
export function venuePick(v: { id: string; name: string }): JourneyPick {
  return { key: `venue:${v.id}`, text: `Tour venues of this type: ${lowerFirst(v.name)}`, windowId: '12-plus' };
}
export function ideaPick(i: { id: string; name: string }): JourneyPick {
  return { key: `idea:${i.id}`, text: `Plan this idea with the vendor it needs: ${i.name}`, windowId: '6-months' };
}
export function detailPick(detail: string): JourneyPick {
  const job = DETAIL_JOBS.find(([re]) => re.test(detail));
  const clean = detail.replace(/[.\s]+$/, '');
  return { key: `detail:${clean}`, text: `${job ? job[1] : 'Plan this detail'}: ${lowerFirst(clean)}`, windowId: job ? job[2] : '6-months' };
}

/** Everything on her wedding page she could keep, grouped as step 3 shows it. Venue types only when the venue is not booked. */
export function pickable(read: WeddingRead, venueBooked: boolean) {
  return {
    directions: read.directions.map(d => ({ label: d.name, sub: d.what, pick: directionPick(d) })),
    venues: venueBooked ? [] : read.venueTypes.map(v => ({ label: v.name, sub: v.why, pick: venuePick(v) })),
    ideas: read.ideas.map(i => ({ label: i.name, sub: i.why, pick: ideaPick(i) })),
    details: read.details.map(d => ({ label: '', sub: d, pick: detailPick(d) }))
  };
}

/** Reads her picks from this browser; anything malformed is dropped, never thrown. */
export function loadJourneyPlan(storage: Pick<Storage, 'getItem'> | undefined): JourneyPlanInput {
  try {
    const raw = storage?.getItem(JOURNEY_KEY);
    if (!raw) return NO_PICKS;
    const saved = JSON.parse(raw) as { picks?: unknown; facts?: { venueBooked?: unknown } };
    const windows: PickWindow[] = ['12-plus', '9-months', '6-months'];
    const picks = (Array.isArray(saved.picks) ? saved.picks : []).filter((p): p is JourneyPick =>
      !!p && typeof p === 'object' && typeof (p as JourneyPick).text === 'string' && (p as JourneyPick).text.length <= 300 && windows.includes((p as JourneyPick).windowId) && typeof (p as JourneyPick).key === 'string');
    return { picks, venueBooked: saved.facts?.venueBooked === true };
  } catch { return NO_PICKS; }
}
