// Her budget drives every number the planner shows (hostile review, 10 Nov 2026: she
// said $30,000 and the headline read $66,000-$150,000, a flat per-guest guess that
// ignored her). There is no benchmark range here any more: the headline is the number
// she typed or the AI draft read from her sentence, the split is built inside it, and
// when her own numbers or her hard limit do not fit, the planner says so and names
// what to lower. Nothing in this file is a price claim; it is arithmetic on her inputs.
import { money } from '@/lib/format';

export type BudgetInput = {
  budgetTarget?: string;
  hardCeiling?: string;
  budgetMode?: string;
  guestCount?: string;
  venueBudget?: string;
  floralDecorBudget?: string;
  photoVideoBudget?: string;
  fashionBudget?: string;
  hospitalityBudget?: string;
  priorities?: string[];
  saveAreas?: string;
  fullBuyout?: string;
  onsiteLodging?: string;
};

/** "$30,000", "about 30k", "25,000-30,000", "30000" -> 30000. Words with no number -> 0. */
export function parseMoney(text: string | undefined | null): number {
  if (!text) return 0;
  let best = 0;
  for (const match of String(text).toLowerCase().matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m|million)?\b/g)) {
    let value = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    if (match[2] === 'k' || match[2] === 'thousand') value *= 1_000;
    if (match[2] === 'm' || match[2] === 'million') value *= 1_000_000;
    if (value > best) best = value;
  }
  return Math.round(best);
}

/** "120", "70-80", "about 150 guests" -> the larger number, because that is who must fit. */
export function parseGuests(text: string | undefined | null): number {
  if (!text) return 0;
  const numbers = [...String(text).matchAll(/\d[\d,]*/g)].map(m => Number(m[0].replace(/,/g, ''))).filter(n => Number.isFinite(n) && n > 0 && n <= 5000);
  return numbers.length ? Math.max(...numbers) : 0;
}

export interface BudgetLine {
  id: string;
  label: string;
  amount: number;
  /** true when the amount is her own number, false when the planner split it. */
  yours: boolean;
  /** true when one of her top three priorities sits in this line. */
  protectedLine: boolean;
}

export interface BudgetPlan {
  /** Her number, or 0 when she has not given one. */
  budget: number;
  /** The number nothing may pass: her hard limit when she set one, else her budget. */
  limit: number;
  hard: boolean;
  /** What she typed, when it had no number in it ("small budget"). */
  words: string;
  guests: number;
  perGuest: number;
  lines: BudgetLine[];
  /** Sum of the lines she priced herself. */
  yourTotal: number;
  /** How far her own lines, or her budget, run past the limit. 0 when they fit. */
  over: number;
  /** Plain sentences, worst first. Empty when nothing needs saying. */
  warnings: string[];
}

// A starting split to edit, not a standard and not a quote. Weights shift toward the
// three things she said matter most, so the split is hers rather than a template.
const LINES: { id: string; label: string; weight: number; field?: keyof BudgetInput; priorities: string[] }[] = [
  { id: 'venue-food-drink', label: 'Venue, food and drink', weight: 46, field: 'venueBudget', priorities: ['Food + Bar', 'Venue privacy', 'Full buyout'] },
  { id: 'photo-video', label: 'Photos and video', weight: 11, field: 'photoVideoBudget', priorities: ['Photography'] },
  { id: 'flowers-decor', label: 'Flowers, decor and rentals', weight: 10, field: 'floralDecorBudget', priorities: ['Florals', 'Rain Plan'] },
  { id: 'music', label: 'Music and entertainment', weight: 8, priorities: ['Party Energy'] },
  { id: 'attire', label: 'Clothes, hair and make-up', weight: 7, field: 'fashionBudget', priorities: ['Fashion'] },
  { id: 'guests', label: 'Guest comfort and transport', weight: 5, field: 'hospitalityBudget', priorities: ['Guest Comfort', 'Guest lodging', 'Travel/Lodging', 'Family Ease', 'Accessibility', 'Cultural Traditions'] },
  { id: 'paper', label: 'Invitations and paper', weight: 3, priorities: [] },
  { id: 'cushion', label: 'Set aside for surprises', weight: 10, priorities: [] }
];
const PROTECTED_BOOST = 1.3;

export function budgetPlan(plan: BudgetInput): BudgetPlan {
  const target = parseMoney(plan.budgetTarget);
  const ceiling = parseMoney(plan.hardCeiling);
  const budget = target || ceiling;
  const limit = ceiling || target;
  const hard = plan.budgetMode === 'hard' || ceiling > 0;
  const words = !budget && plan.budgetTarget?.trim() ? plan.budgetTarget.trim() : '';
  const guests = parseGuests(plan.guestCount);
  const top = (plan.priorities ?? []).slice(0, 3);
  const warnings: string[] = [];

  const own = LINES.map(line => (line.field ? parseMoney(plan[line.field] as string | undefined) : 0));
  const yourTotal = own.reduce((sum, n) => sum + n, 0);
  let lines: BudgetLine[] = [];
  let over = 0;

  if (budget) {
    const base = Math.min(budget, limit);
    const weights = LINES.map((line, i) => (own[i] ? 0 : line.weight * (line.id !== 'cushion' && line.priorities.some(p => top.includes(p)) ? PROTECTED_BOOST : 1)));
    const weightSum = weights.reduce((sum, n) => sum + n, 0);
    const left = Math.max(0, base - yourTotal);
    let assigned = 0;
    lines = LINES.map((line, i) => {
      const amount = own[i] || (weightSum ? Math.round((left * weights[i]) / weightSum / 50) * 50 : 0);
      if (!own[i]) assigned += amount;
      return { id: line.id, label: line.label, amount, yours: own[i] > 0, protectedLine: line.priorities.some(p => top.includes(p)) };
    });
    // Rounding to $50 can leave a few dollars; the cushion line absorbs them so the split adds up to her number.
    const cushion = lines.find(line => line.id === 'cushion' && !line.yours);
    if (cushion && yourTotal <= base) {
      const adjustment = left - assigned;
      cushion.amount = Math.max(0, cushion.amount + adjustment);
      // A small remainder can round several lines upward by more than the
      // cushion contains. Reduce generated lines only; her own amounts stay put.
      let excess = lines.reduce((sum, line) => sum + line.amount, 0) - base;
      const generated = lines.filter(line => !line.yours && line.id !== 'cushion')
        .sort((a, b) => Number(a.protectedLine) - Number(b.protectedLine) || b.amount - a.amount);
      for (const line of generated) {
        if (excess <= 0) break;
        const reduction = Math.min(line.amount, excess);
        line.amount -= reduction;
        excess -= reduction;
      }
    }

    if (target && ceiling && target > ceiling) {
      over = target - ceiling;
      warnings.push(`Your budget of ${money(target)} is ${money(over)} over your hard limit of ${money(ceiling)}. The split below stays inside the limit.`);
    }
    if (yourTotal > base) {
      over = yourTotal - base;
      const cuttable = lines.filter(line => line.yours && !line.protectedLine).sort((a, b) => b.amount - a.amount);
      const names = (cuttable.length ? cuttable : lines.filter(line => line.yours).sort((a, b) => b.amount - a.amount)).slice(0, 2).map(line => `${line.label} (${money(line.amount)})`);
      warnings.push(`Your own numbers add up to ${money(yourTotal)}. That is ${money(over)} over your ${hard ? 'hard ' : ''}budget of ${money(base)}, with nothing left for the other lines. Lower ${names.join(' or ')} first${plan.saveAreas?.trim() ? `, or cut what you said you would save on: ${plan.saveAreas.trim()}` : ''}.`);
    }
    const pressure: string[] = [];
    if (plan.fullBuyout === 'required') pressure.push('a full venue buyout');
    if (plan.onsiteLodging === 'required') pressure.push('guests sleeping on site');
    if (hard && pressure.length) warnings.push(`With a hard budget, get the quote for ${pressure.join(' and ')} before anything else: it decides what is left for the rest.`);
  }

  return { budget, limit, hard, words, guests, perGuest: budget && guests ? Math.round(Math.min(budget, limit) / guests) : 0, lines, yourTotal, over, warnings };
}

/** The one headline every surface shows (planner card, floating pill, packet). */
export function budgetHeadline(plan: BudgetInput): string {
  const b = budgetPlan(plan);
  if (b.budget) return money(Math.min(b.budget, b.limit));
  if (b.words) return b.words;
  return 'Not set yet';
}

/** One plain line under the headline. Arithmetic on her inputs only. */
export function budgetSubline(plan: BudgetInput): string {
  const b = budgetPlan(plan);
  if (!b.budget) return b.words ? 'Add a number to see it split across the wedding.' : 'Add your budget to see it split across the wedding.';
  const kind = b.hard ? 'Hard limit' : 'Your number';
  return b.perGuest ? `${kind}. ${money(b.perGuest)} a guest for everything, across ${b.guests} guests.` : `${kind}. Add your guest count to see it per guest.`;
}
