// Step (c) of the AI draft chain: no model, plain patterns. Always available and
// unlimited, so a couple always gets a filled draft even when every free model is
// spent or down. It reads the date, guest count, place, season, budget and
// priorities from the sentence; lib/ai-draft.ts then runs the result through the
// same whitelist (parseDraft) as a model's answer.
//
// Pure: no imports from the server side, no network, no storage.

export interface RulesDraft {
  weddingDate: string;
  guestCount: string;
  locations: string;
  season: string;
  budgetTarget: string;
  budgetMode: string;
  priorities: string[];
  notes: string[];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const monthIndex = (word: string) => MONTHS.findIndex(m => m.startsWith(word.toLowerCase().slice(0, 3)));
const SEASON_OF_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function todayParts(today: string) {
  const [y, m, d] = today.split('-').map(Number);
  return { y, m, d };
}

/** The next such month strictly after this one (the AI prompt's rule: a month alone means the 15th of the next one). */
function nextMonth(month: number, now: { y: number; m: number }) {
  return month > now.m ? now.y : now.y + 1;
}

const fullYear = (raw: string) => { const n = Number(raw); return raw.length <= 2 ? 2000 + n : n; };
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);

function findDate(text: string, today: string): { date: string; month: number | null } {
  const now = todayParts(today);
  const t = text.toLowerCase();
  let m: RegExpMatchArray | null;
  // 2027-06-12
  if ((m = t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)) && valid(+m[1], +m[2], +m[3])) return { date: iso(+m[1], +m[2], +m[3]), month: +m[2] };
  // 6/12/27, 6/12/2027, 6-12-27 (US order: month first)
  if ((m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/))) { const y = fullYear(m[3]); if (valid(y, +m[1], +m[2])) return { date: iso(y, +m[1], +m[2]), month: +m[1] }; }
  // June 12, 2027 / June 12th / June 12
  if ((m = t.match(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`)))) {
    const mo = monthIndex(m[1]) + 1; const d = +m[2];
    const y = m[3] ? +m[3] : (mo > now.m || (mo === now.m && d > now.d) ? now.y : now.y + 1);
    if (valid(y, mo, d)) return { date: iso(y, mo, d), month: mo };
  }
  // 12 June 2027 / 12th of June
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(20\\d{2}))?`)))) {
    const mo = monthIndex(m[2]) + 1; const d = +m[1];
    const y = m[3] ? +m[3] : (mo > now.m || (mo === now.m && d > now.d) ? now.y : now.y + 1);
    if (valid(y, mo, d)) return { date: iso(y, mo, d), month: mo };
  }
  // June 2027 / next June / in June / this June: the 15th of that month
  if ((m = t.match(new RegExp(`\\b(next\\s+|this\\s+|in\\s+|early\\s+|mid[- ]?|late\\s+)?${MONTH_RE}\\b(?:\\s+(?:of\\s+)?(20\\d{2}|'\\d{2}))?`)))) {
    const word = m[2];
    // "may" is also a verb: only count it with a lead word or a year.
    if (word === 'may' && !m[1] && !m[3]) return { date: '', month: null };
    const mo = monthIndex(word) + 1;
    const y = m[3] ? fullYear(m[3].replace("'", '')) : nextMonth(mo, now);
    return { date: iso(y, mo, 15), month: mo };
  }
  return { date: '', month: null };
}

function findGuests(text: string): string {
  const t = text.toLowerCase().replace(/(\d),(\d{3})/g, '$1$2');
  const range = t.match(/\b(\d{1,4})\s*(?:-|–|to)\s*(\d{1,4})\s*(?:guests?|people|persons?|attendees|invitees|pax)\b/);
  if (range) return String(Math.round((+range[1] + +range[2]) / 2));
  const m = t.match(/\b(?:about|around|roughly|approximately|approx\.?|~|maybe|under|over|max|up to)?\s*(\d{1,4})\s*(?:guests?|people|persons?|attendees|invitees|pax|ppl)\b/)
    ?? t.match(/\b(?:guests?|guest count|headcount)\s*(?:of|:|is|=|about|around|~)?\s*(?:about|around|~)?\s*(\d{1,4})\b/)
    ?? t.match(/\bfor\s+(?:about|around|~)?\s*(\d{2,4})\b(?!\s*(?:k|grand|dollars|\$|%))/);
  return m ? m[1] : '';
}

function money(raw: string, k: string | undefined): number {
  const n = Number(raw.replace(/,/g, ''));
  return k ? n * 1000 : n;
}
const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function findBudget(text: string): { target: string; mode: string } {
  const t = text.toLowerCase();
  const num = '(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(k|grand)?';
  const range = t.match(new RegExp(`\\$\\s*${num}\\s*(?:-|–|to)\\s*\\$?\\s*${num}`));
  if (range) return { target: `${dollars(money(range[1], range[2] ?? range[4]))}–${dollars(money(range[3], range[4]))}`, mode: 'range' };
  const m = t.match(new RegExp(`\\$\\s*${num}`))
    ?? t.match(new RegExp(`\\bbudget\\s*(?:of|is|:|around|about|under|~)?\\s*(?:about|around|under|~)?\\s*\\$?\\s*${num}`))
    ?? t.match(new RegExp(`\\b${num}\\s*(?:dollars?|usd)?\\s*budget\\b`))
    ?? t.match(/\b(\d{1,3}(?:,\d{3})+|\d+)\s*(k|grand)\b/)
    ?? t.match(/\b(\d{1,3},\d{3})\b(?!\s*(?:guests?|people))/);
  if (m) {
    const n = money(m[1], m[2]);
    if (n >= 500 && n <= 5_000_000) return { target: dollars(n), mode: 'hard' };
  }
  const word = t.match(/\b(small|tight|modest|low|limited|strict|fixed|big|large|generous|flexible|no)\s+budget\b/);
  if (word) {
    const w = word[1];
    if (w === 'no') return { target: '', mode: 'dream' };
    return { target: `${w} budget`, mode: ['flexible', 'big', 'large', 'generous'].includes(w) ? 'range' : 'hard' };
  }
  return { target: '', mode: '' };
}

const NOT_PLACES = new Set([...MONTHS, 'spring', 'summer', 'fall', 'autumn', 'winter', 'the', 'a', 'an', 'our', 'my', 'next', 'this', 'early', 'late', 'mid', 'about', 'around', 'budget', 'mind']);
function findPlace(text: string): string {
  // "in Memphis", "in Memphis, TN", "near Asheville", "at Lake Tahoe": a run of capitalised words after in/at/near.
  const re = /\b(?:in|near|at|around|outside(?: of)?)\s+((?:the\s+)?[A-Z][\w'’.-]*(?:\s+(?:[A-Z][\w'’.-]*|of|de|la|del))*(?:,\s*[A-Z][\w.]*(?:\s+[A-Z][\w.]*)?)?)/g;
  for (const m of text.matchAll(re)) {
    let place = m[1].replace(/^the\s+/i, '').trim().replace(/[.,]+$/, '');
    const [town, region] = place.split(/,\s*/);
    if (region && NOT_PLACES.has(region.split(/\s+/)[0].toLowerCase())) place = town;
    const first = place.split(/[\s,]+/)[0].toLowerCase();
    if (NOT_PLACES.has(first) || /^\d/.test(first)) continue;
    return place.slice(0, 60);
  }
  return '';
}

function findSeason(text: string, month: number | null): string {
  const m = text.toLowerCase().match(/\b(spring|summer|fall|autumn|winter)\b/);
  if (m) return m[1] === 'autumn' ? 'fall' : m[1];
  return month ? SEASON_OF_MONTH[month - 1] : '';
}

// Words a couple uses -> the Builder's fixed priority list (data/planning priorityOptions).
const PRIORITY_WORDS: [RegExp, string][] = [
  [/\b(food|dinner|menu|catering|bar|drinks|cocktails?|open bar)\b/i, 'Food + Bar'],
  [/\b(photos?|photograph\w*|pictures)\b/i, 'Photography'],
  [/\b(flowers?|florals?|bouquets?)\b/i, 'Florals'],
  [/\b(rain|weather)\b/i, 'Rain Plan'],
  [/\b(accessib\w*|wheelchair|elderly|step-free)\b/i, 'Accessibility'],
  [/\b(dancing|dance|party|band|dj)\b/i, 'Party Energy'],
  [/\b(lodging|hotel block|rooms for guests|out[- ]of[- ]town|destination|travel)\b/i, 'Travel/Lodging'],
  [/\b(tradition\w*|cultural|religious|ceremony customs)\b/i, 'Cultural Traditions'],
  [/\b(dress|attire|fashion|gown|suits?)\b/i, 'Fashion'],
  [/\b(private|privacy|intimate)\b/i, 'Venue privacy'],
  [/\b(buyout|whole venue)\b/i, 'Full buyout'],
  [/\b(family|kids|children)\b/i, 'Family Ease'],
  [/\b(shade|comfort|heat|cool)\b/i, 'Guest Comfort'],
  [/\b(small|tight|modest|limited|strict|fixed)\s+budget\b|\bbudget[- ]friendly\b|\baffordable\b|\bcheap\b/i, 'Budget Control']
];

function findPriorities(text: string): string[] {
  const out: string[] = [];
  for (const [re, p] of PRIORITY_WORDS) if (re.test(text) && !out.includes(p)) out.push(p);
  return out.slice(0, 3);
}

function notesFor(text: string, season: string): string[] {
  const t = text.toLowerCase();
  const notes: string[] = [];
  if (/\b(outdoor|outside|garden|backyard|beach|tent)\b/.test(t)) notes.push('Outdoors: book a rain plan or tent hold when you book the venue.');
  if (season === 'summer' && /\b(outdoor|outside|garden|backyard|beach)\b/.test(t)) notes.push('Summer outdoors: plan shade and water for guests.');
  if (/\b(destination|abroad|overseas|travel)\b/.test(t)) notes.push('Destination: send save-the-dates early so guests can book travel.');
  return notes.slice(0, 3);
}

/** Reads the plan fields from a sentence with plain patterns. Never throws; empty strings where it found nothing. */
export function rulesDraft(description: string, today: string): RulesDraft {
  const text = String(description ?? '');
  const { date, month } = findDate(text, today);
  const budget = findBudget(text);
  const season = findSeason(text, month);
  return {
    weddingDate: date,
    guestCount: findGuests(text),
    locations: findPlace(text),
    season,
    budgetTarget: budget.target,
    budgetMode: budget.mode,
    priorities: findPriorities(text),
    notes: notesFor(text, season)
  };
}
