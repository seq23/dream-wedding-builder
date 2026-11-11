// Venue types follow what she told the planner (hostile review, 10 Nov 2026: a Memphis
// outdoor wedding for 120 was offered Italian villa buyouts and a 20-100 guest
// restaurant as the "Strong fit"). Fit is worked out from her answers, never stored on
// the venue type: destination types appear only for a destination wedding, a type that
// cannot hold her guest count is hidden with the reason, and what she asked for
// (outdoor, indoor) sorts first. These are venue TYPES to ask about, not venues.
import { parseGuests, parseMoney } from '@/lib/budget-plan';

export interface VenueType {
  id: string;
  name: string;
  setting: 'outdoor' | 'indoor' | 'both';
  /** Typical guest range for the type; every venue differs, so it is a sort key and a question, not a promise. */
  minGuests: number;
  maxGuests: number;
  destination: boolean;
  /** 1 = usually the least to hire, 3 = usually the most. Used only to order equal fits on a hard budget. */
  costLevel: 1 | 2 | 3;
  goodFor: string;
  ask: string[];
}

export type VenueFitInput = {
  locations?: string;
  backupLocations?: string;
  destinationLocal?: string;
  guestCount?: string;
  budgetTarget?: string;
  hardCeiling?: string;
  budgetMode?: string;
  ownVibeWords?: string;
  makeItFeelLike?: string;
  inspirationNotes?: string;
  fixedItems?: string;
  outdoorNeeds?: string;
  constraints?: string;
  settings?: string[];
  venueTypes?: string[];
  aiDraft?: { description: string; notes: string[] } | null;
};

export interface VenueFit {
  venue: VenueType;
  level: 'fits' | 'check';
  reasons: string[];
}

export interface VenueRanking {
  shown: VenueFit[];
  hidden: { venue: VenueType; reason: string }[];
  /** What the sort used, in her words, e.g. ["outdoor", "120 guests", "Memphis"]. */
  basis: string[];
  wants: { outdoor: boolean; indoor: boolean; destination: boolean; liveMusic: boolean; guests: number };
}

export function wishText(plan: VenueFitInput): string {
  return [plan.locations, plan.backupLocations, plan.ownVibeWords, plan.makeItFeelLike, plan.inspirationNotes, plan.fixedItems, plan.outdoorNeeds, plan.constraints, ...(plan.settings ?? []), ...(plan.venueTypes ?? []), plan.aiDraft?.description, ...(plan.aiDraft?.notes ?? [])].filter(Boolean).join(' ').toLowerCase();
}

const DESTINATION = /\bdestination\b|\babroad\b|\boverseas\b|\bitaly\b|\btuscany\b|\bamalfi\b|\blake como\b|\bfrance\b|\bprovence\b|\bspain\b|\bportugal\b|\bgreece\b|\beurope\b|\bmexico\b|\bcaribbean\b|\bjamaica\b|\bbahamas\b|\bhawaii\b|\bbali\b/;
const OUTDOOR = /\boutdoors?\b|\boutside\b|\bgarden\b|\bbackyard\b|\bpark\b|\bfarm\b|\branch\b|\bbeach\b|\bvineyard\b|\btent(ed)?\b|\bopen[- ]air\b|\bunder the stars\b/;
const INDOOR = /\bindoors?\b|\bballroom\b|\binside\b|\bloft\b|\bhall\b|\bmuseum\b|\bgallery\b/;
const LIVE_MUSIC = /\bband\b|\blive music\b|\bdj\b|\bdance floor\b|\bdancing\b/;

export function rankVenueTypes(plan: VenueFitInput, types: VenueType[]): VenueRanking {
  const text = wishText(plan);
  const guests = parseGuests(plan.guestCount);
  const destination = plan.destinationLocal === 'destination' || DESTINATION.test(text);
  const outdoor = OUTDOOR.test(text);
  const indoor = !outdoor && INDOOR.test(text);
  const liveMusic = LIVE_MUSIC.test(text);
  const hardBudget = plan.budgetMode === 'hard' || parseMoney(plan.hardCeiling) > 0;

  const shown: (VenueFit & { score: number })[] = [];
  const hidden: VenueRanking['hidden'] = [];
  for (const venue of types) {
    if (venue.destination && !destination) { hidden.push({ venue, reason: 'for destination weddings; you have not said yours is one' }); continue; }
    if (guests && guests > venue.maxGuests) { hidden.push({ venue, reason: `most hold up to ${venue.maxGuests} guests; you have ${guests}` }); continue; }
    const reasons: string[] = [];
    let level: VenueFit['level'] = 'fits';
    let score = 0;
    if (outdoor) {
      if (venue.setting === 'indoor') { level = 'check'; reasons.push('Indoors: keep it as your rain plan'); score -= 3; }
      else { reasons.push(venue.setting === 'outdoor' ? 'Outdoor, as you asked' : 'Has outdoor and indoor space'); score += venue.setting === 'outdoor' ? 3 : 2; }
    } else if (indoor) {
      if (venue.setting === 'outdoor') { level = 'check'; reasons.push('Outdoors: needs a cover plan'); score -= 3; }
      else { reasons.push('Indoor space, as you asked'); score += 2; }
    }
    if (guests) {
      if (guests < venue.minGuests) { level = 'check'; reasons.push(`Usually booked for ${venue.minGuests} or more; ask about a smaller group`); score -= 1; }
      else { reasons.push(`Typical size covers ${guests} guests`); score += 1; }
    }
    if (destination && venue.destination) { reasons.push('For a destination wedding'); score += 2; }
    if (hardBudget) score += (3 - venue.costLevel) * 0.5;
    shown.push({ venue, level, reasons, score });
  }
  shown.sort((a, b) => (a.level === b.level ? b.score - a.score : a.level === 'fits' ? -1 : 1));

  const basis = [outdoor ? 'outdoor' : indoor ? 'indoor' : '', guests ? `${guests} guests` : '', plan.locations?.trim() ?? '', destination ? 'destination wedding' : '', hardBudget ? 'hard budget' : ''].filter(Boolean);
  return { shown: shown.map(({ venue, level, reasons }) => ({ venue, level, reasons })), hidden, basis, wants: { outdoor, indoor, destination, liveMusic, guests } };
}
