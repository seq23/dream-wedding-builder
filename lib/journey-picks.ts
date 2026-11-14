// Steps 3 and 4 of the free journey: what she keeps from her wedding page becomes
// dated tasks marked "Your pick" in the one dated plan (lib/dated-plan.ts), which the
// planner, the dashboard and the printable page all draw. A booked venue takes the
// venue task out. Everything lives in this browser (localStorage), nothing is sent.
import { colourView, type Swatch, type WeddingRead } from '@/lib/wedding-read-shared';

/** The journey's own record in this browser: answers, her wedding page, her picks. */
export const JOURNEY_KEY = 'dwb-blend';
/** Fired after the journey saves, so every dated plan on the page redraws. */
export const JOURNEY_EVENT = 'dwb-updated';

export type PickWindow = '12-plus' | '9-months' | '6-months' | '3-months' | '1-month' | 'wedding-week';
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

/** A kept palette: one task to tell every vendor, and the colours her plan shows. */
export const COLOURS_PICK = 'colours:';
export function colourPick(name: string, colours: Swatch[]): JourneyPick {
  const words = colours.map(c => c.name.toLowerCase());
  const list = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0] ?? '';
  return { key: `${COLOURS_PICK}${name}`, text: `Share your colors with the florist, stationer and baker: ${list}`, windowId: '12-plus' };
}
/** The colour names of the palette she kept, or [] when she kept none (nothing decided for her). */
export function keptColours(read: WeddingRead | null | undefined, picks: JourneyPick[]): string[] {
  const kept = picks.find(p => p.key.startsWith(COLOURS_PICK));
  if (!read || !kept) return [];
  return colourOptions(read).find(o => o.pick.key === kept.key)?.colours.map(c => c.name) ?? [];
}
function colourOptions(read: WeddingRead) {
  const view = colourView(read);
  const options = view.mode === 'yours'
    ? [{ label: 'My colors', colours: view.yours }, ...(view.goesWith.length ? [{ label: 'My colors, with the ones that go with them', colours: [...view.yours, ...view.goesWith] }] : [])]
    : view.ideas.map(i => ({ label: i.name, colours: i.colours }));
  return options.map(o => ({ label: o.label, sub: o.colours.map(c => c.name).join(', '), colours: o.colours, pick: colourPick(o.label, o.colours) }));
}
/** Keeps or un-keeps one row. Only one palette can be kept: keeping another replaces it. */
export function togglePick(list: JourneyPick[], pick: JourneyPick): JourneyPick[] {
  if (list.some(x => x.key === pick.key)) return list.filter(x => x.key !== pick.key);
  const rest = pick.key.startsWith(COLOURS_PICK) ? list.filter(x => !x.key.startsWith(COLOURS_PICK)) : list;
  return [...rest, pick];
}

/** "Fruit-and-Floral Tablescape" and "Fruit and floral tablescape" are the same thing. */
const sameName = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Everything on her wedding page she could keep, grouped as step 3 shows it. Venue types
 * only when the venue is not booked. Each thing is offered once: a name already shown in an
 * earlier group (or a detail that just repeats one) is left out, so keeping it never makes
 * two tasks for the same thing. */
export function pickable(read: WeddingRead, venueBooked: boolean) {
  const seen = new Set<string>();
  const once = <T extends { label: string; sub: string }>(items: T[]) => items.filter(item => {
    const name = sameName(item.label || item.sub);
    if (!name || seen.has(name) || (!item.label && [...seen].some(n => name.startsWith(n + ' ') || name === n))) return false;
    seen.add(name); return true;
  });
  const directions = once(read.directions.map(d => ({ label: d.name, sub: d.what, pick: directionPick(d) })));
  const venues = venueBooked ? [] : once(read.venueTypes.map(v => ({ label: v.name, sub: v.why, pick: venuePick(v) })));
  const ideas = once(read.ideas.map(i => ({ label: i.name, sub: i.why, pick: ideaPick(i) })));
  const details = once(read.details.map(d => ({ label: '', sub: d, pick: detailPick(d) })));
  return { colours: colourOptions(read), directions, venues, ideas, details };
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
