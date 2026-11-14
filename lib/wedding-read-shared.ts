// What the journey's form can send and what step 2 shows: shared by the page (client)
// and lib/wedding-read.ts (server). No model code here, so the browser bundle stays small.
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter', 'Not sure'] as const;
export const SETTINGS = ['Outdoors', 'Indoors', 'Either'] as const;
export const MOODS = ['Relaxed', 'Elegant', 'Garden', 'City', 'Rustic', 'Cultural', 'Party', 'Intimate'] as const;
export const LOVES = ['The table', 'The flowers', 'The light', 'The place', 'The outfits'] as const;
export const BUDGETS = ['Under $10,000', '$10,000 to $25,000', '$25,000 to $50,000', 'Over $50,000'] as const;
export const TRADITIONS = ['Catholic', 'Protestant or Christian', 'Jewish', 'Hindu', 'Muslim nikah', 'Sikh', 'Nigerian traditional', 'Mexican', 'Chinese tea ceremony', 'Civil, not religious', 'Other'] as const;
/** Mixed-faith and mixed-culture couples pick more than one; the answer travels as one
 * comma-joined string so older saved answers (a single name) still read. */
export const MAX_TRADITIONS = 3;
export function traditionList(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(parts.map(p => String(p).trim()).filter(p => (TRADITIONS as readonly string[]).includes(p)))].slice(0, MAX_TRADITIONS);
}
export function toggleTradition(value: string, name: string): string {
  const list = traditionList(value);
  if (list.includes(name)) return list.filter(t => t !== name).join(', ');
  return list.length >= MAX_TRADITIONS ? list.join(', ') : traditionList([...list, name]).join(', ');
}

/** The season her date falls in (US, northern hemisphere), so the read never goes by a
 * season she guessed before she gave the date. '' when there is no real date. */
export function seasonFromDate(iso: string): '' | 'Spring' | 'Summer' | 'Fall' | 'Winter' {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  const month = Number(m[2]);
  if (month < 1 || month > 12) return '';
  return month >= 3 && month <= 5 ? 'Spring' : month >= 6 && month <= 8 ? 'Summer' : month >= 9 && month <= 11 ? 'Fall' : 'Winter';
}

/** Colours she can say she already loves (step 1, "Your colours"). Real wedding colour
 * names; the hex is only the swatch. Her pick is the wedding's, never the brand's. */
export const WEDDING_COLOURS = [
  { name: 'Ivory', hex: '#F6F0E1' }, { name: 'Blush', hex: '#E9BFB9' }, { name: 'Sage', hex: '#9CAF88' },
  { name: 'Dusty blue', hex: '#8AA3BC' }, { name: 'Navy', hex: '#1F2A4A' }, { name: 'Emerald', hex: '#1E6B4E' },
  { name: 'Burgundy', hex: '#7A1E32' }, { name: 'Terracotta', hex: '#C4673F' }, { name: 'Gold', hex: '#C9A04A' },
  { name: 'Lavender', hex: '#B6A6D6' }, { name: 'Black', hex: '#161616' }, { name: 'White', hex: '#FFFFFF' }
] as const;
export const COLOURS_NOT_SURE = 'Not sure yet';
export const MAX_COLOURS = 6;
export type Swatch = { name: string; hex: string };

export interface Photo { loves: string[]; colours: string[] }
export interface Answers {
  path: 'idea' | 'dk';
  wish: string;
  /** Names from WEDDING_COLOURS she tapped; empty = not sure yet. */
  colours: string[];
  season: string;
  setting: string;
  moods: string[];
  photos: Photo[];
  where: string;
  guests: number | null;
  budget: string;
  tradition: string;
  venueBooked: boolean;
  dateSet: boolean;
}

export interface WeddingRead {
  by: 'ai' | 'fixed';
  headline: string;
  read: string;
  directions: { name: string; what: string }[];
  /** The read's own palette (model or fixed lists). Shown only through colourView. */
  colours: { name: string; hex: string }[];
  /** Exactly the colours she chose, in her order; set by the server from her answers, never by a model. */
  yourColours?: Swatch[];
  /** Up to two the read adds that go with hers (only when she chose some). */
  goesWith?: Swatch[];
  /** Three palettes to try, only when she chose none. */
  colourIdeas?: { name: string; colours: Swatch[] }[];
  venueTypes: { id: string; name: string; why: string }[];
  ideas: { id: string; name: string; cost: string; why: string }[];
  details: string[];
  ask: string[];
  honest: string;
  photoNotes: string[];
}

/** Her chips, turned into swatches; unknown names are dropped. */
export function herSwatches(names: readonly string[]): Swatch[] {
  return [...new Set(names)].map(n => WEDDING_COLOURS.find(c => c.name === n)).filter((c): c is (typeof WEDDING_COLOURS)[number] => !!c)
    .slice(0, MAX_COLOURS).map(c => ({ name: c.name, hex: c.hex }));
}
/** Step 1's chip row: tapping a colour adds or removes it; "Not sure yet" clears them. */
export function toggleColour(list: readonly string[], name: string): string[] {
  if (name === COLOURS_NOT_SURE) return [];
  if (!WEDDING_COLOURS.some(c => c.name === name)) return [...list];
  return list.includes(name) ? list.filter(x => x !== name) : list.length >= MAX_COLOURS ? [...list] : [...list, name];
}
/** What step 2 shows under colours, the same on the site and the phone: her own colours
 * unchanged (plus at most two marked "goes with yours"), or, when she chose none, ideas
 * to try that are never called hers. A read saved before this existed shows as ideas. */
export function colourView(read: WeddingRead): { mode: 'yours'; yours: Swatch[]; goesWith: Swatch[] } | { mode: 'ideas'; ideas: { name: string; colours: Swatch[] }[] } {
  if (read.yourColours?.length) return { mode: 'yours', yours: read.yourColours, goesWith: (read.goesWith ?? []).slice(0, 2) };
  const ideas = read.colourIdeas?.length ? read.colourIdeas : read.colours.length ? [{ name: 'Made from your answers', colours: read.colours }] : [];
  return { mode: 'ideas', ideas: ideas.slice(0, 3) };
}
