// "Questions to settle next" replaces the free-text "ask the master planner anything"
// box (hostile review, 10 Nov 2026: it answered every question with the same canned
// text and implied a human planner). This is a tool, not a person and not AI: fixed
// rules read her own answers and list the decisions still open, each with the reason
// it came up. No model is called and nothing is sent anywhere.
import { budgetPlan, type BudgetInput } from '@/lib/budget-plan';
import { rankVenueTypes, wishText, type VenueFitInput } from '@/lib/venue-fit';
import { money } from '@/lib/format';

export type NextQuestionInput = BudgetInput & VenueFitInput & {
  weddingDate?: string;
  season?: string;
  rainBackup?: string;
  outsideCatering?: string;
  selectedVenueIds?: string[];
  selectedVendorCategories?: string[];
};

export interface NextQuestion {
  id: string;
  question: string;
  /** Why it came up, quoting what she told the planner. */
  why: string;
  /** The planner section that settles it. */
  href: string;
}

const OUTSIDE_FOOD = /\btaco\b|\bfood truck\b|\bbbq\b|\bbarbecue\b|\bcater(er|ing)?\b|\bfamily recipes?\b|\bpotluck\b|\bpizza\b/;

export function nextQuestions(plan: NextQuestionInput, limit = 6): NextQuestion[] {
  const out: NextQuestion[] = [];
  const text = wishText(plan);
  const budget = budgetPlan(plan);
  const { wants } = rankVenueTypes(plan, []);
  const place = plan.locations?.trim();

  if (!plan.weddingDate) out.push({ id: 'date', question: 'What is your date, or your best-guess month?', why: 'Every task in your plan is dated from it.', href: '#your-date' });
  if (!wants.guests) out.push({ id: 'guests', question: 'Roughly how many guests?', why: 'Guest count decides which venues fit and what each guest costs.', href: '#step-0' });
  if (!place) out.push({ id: 'place', question: 'Which town or area?', why: 'Venues, dates and prices all depend on where.', href: '#step-0' });
  if (!budget.budget) out.push({ id: 'budget', question: 'What is the most you want to spend in total?', why: 'With a number, the planner splits it across the wedding and warns you when your choices pass it.', href: '#step-3' });

  if (wants.outdoor && !plan.rainBackup?.trim()) out.push({ id: 'rain', question: 'What happens if it rains?', why: `You said outdoor${place ? ` in ${place}` : ''}. Ask each venue what cover it has, and what a tent would cost if it has none.`, href: '#step-2' });
  if (wants.liveMusic) out.push({ id: 'music', question: 'Can the venue power your music, and when must it stop?', why: 'You mentioned a band or dancing. Ask about power, a covered spot for the players and the noise cut-off time.', href: '#step-5' });
  if (OUTSIDE_FOOD.test(text) && plan.outsideCatering !== 'venue catering ok') out.push({ id: 'food', question: 'Does the venue let you bring your own caterer?', why: 'The food you described usually comes from an outside caterer. Ask what kitchen, power and serving space they would get.', href: '#step-5' });
  if (budget.budget && budget.guests) out.push({ id: 'per-guest', question: `Is ${money(budget.perGuest)} a guest enough for the venue and food you want?`, why: `${money(Math.min(budget.budget, budget.limit))} across ${budget.guests} guests. Get the venue and food quotes first: they are the two that move with guest count.`, href: '#step-3' });
  if (budget.hard && !plan.saveAreas?.trim()) out.push({ id: 'cuts', question: 'What would you drop first if a quote comes in high?', why: 'You have a hard budget. Deciding the cuts now is easier than deciding them with a quote in your hand.', href: '#step-3' });
  if ((plan.priorities ?? []).length === 0) out.push({ id: 'priorities', question: 'Which three things matter most to you?', why: 'The budget split leans toward them, and they are the last things to cut.', href: '#step-0' });
  if ((plan.selectedVenueIds ?? []).length === 0 && wants.guests) out.push({ id: 'venue-types', question: 'Which venue types will you ask for quotes?', why: 'Picking two or three types turns an open search into a short list.', href: '#step-2' });
  if ((plan.selectedVendorCategories ?? []).length === 0) out.push({ id: 'vendors', question: 'Who do you need to hire?', why: 'Each vendor you pick adds its questions to your printed plan.', href: '#step-5' });

  return out.slice(0, limit);
}
