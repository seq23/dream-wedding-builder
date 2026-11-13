import { PLAN_WINDOWS } from '@core/dated-plan';
import { taskKey } from '@core/plan-progress';
import { budgetPlan, parseGuests } from '@core/budget-plan';
import { isDestination } from '@core/venue-fit';
import { money } from '@core/format';
import type { Details } from './draftReview';

// What she told us (guests, place, budget, what matters most) shows on the tasks it bears on.
// Every line is arithmetic or a restatement of her own answers, using the website planner's
// rules (lib/budget-plan.ts, lib/venue-fit.ts): never a price claim, a venue or a quote.

/** Her free-text "what matters most" → the budget rule's own priority names. */
const PRIORITY_WORDS: [RegExp, string][] = [
  [/food|bar\b|drink|cater|dinner/, 'Food + Bar'], [/photo|video/, 'Photography'], [/flower|floral|decor/, 'Florals'],
  [/music|band|dj|danc|party/, 'Party Energy'], [/dress|attire|fashion|suit/, 'Fashion'], [/guest|famil|comfort/, 'Guest Comfort'],
];
export function prioritiesFrom(text: string | undefined): string[] {
  const lower = (text ?? '').toLowerCase();
  return PRIORITY_WORDS.filter(([word]) => word.test(lower)).map(([, name]) => name).slice(0, 3);
}

const TASK_BUDGET_LINE: Record<string, string> = {
  'Book the venue (it decides the date and the headcount)': 'venue-food-drink',
  'Book the photographer and the caterer': 'photo-video',
  'Book the band or DJ': 'music',
  'Start looking for wedding attire': 'attire',
  'Book the florist, cake and rentals': 'flowers-decor',
  'Order invitations and mail them 6 to 8 weeks before': 'paper',
};

/** One note per built-in task her details bear on, keyed like the task rows. Empty when she gave nothing. */
export function planNotes(details: Details): Record<string, string> {
  const guests = parseGuests(details.guestCount);
  const place = details.locations?.trim() ?? '';
  const budget = budgetPlan({ budgetTarget: details.budgetTarget, budgetMode: /hard|limit|max/i.test(details.budgetMode ?? '') ? 'hard' : undefined, guestCount: details.guestCount, priorities: prioritiesFrom(details.priorities) });
  const parts: Record<string, string[]> = {};
  const add = (text: string, line: string) => { (parts[text] ??= []).push(line); };

  if (budget.budget) {
    add('Agree the total budget and who is contributing', `Your ${budget.hard ? 'hard limit' : 'budget'}: ${money(Math.min(budget.budget, budget.limit))}${budget.perGuest ? `, about ${money(budget.perGuest)} a guest for ${guests} guests` : ''}.`);
    for (const [text, id] of Object.entries(TASK_BUDGET_LINE)) {
      const line = budget.lines.find(l => l.id === id);
      if (line?.amount) add(text, `A starting share of your budget: about ${money(line.amount)} for ${line.label.toLowerCase()}${line.protectedLine ? ' (larger, because you said it matters most)' : ''}. Not a quote.`);
    }
  }
  if (guests) {
    add('Draft the guest list and a headcount range', `You said ${guests} guests.`);
    add('Book the venue (it decides the date and the headcount)', `Ask each venue if it holds ${guests} guests.`);
    add('Reserve hotel room blocks for guests', `You are planning for ${guests} guests.`);
    add('Chase RSVPs and give the caterer the final headcount', `You planned for ${guests} guests.`);
    add('Make the seating chart and the day-of timeline', `Seats for ${guests} guests.`);
  }
  if (place) {
    add('Book the venue (it decides the date and the headcount)', `Your place: ${place}.`);
    add('Reserve hotel room blocks for guests', `Near ${place}.`);
    add('Get the marriage license (check your county’s waiting and validity period)', `Check with the office that issues licenses where you marry: ${place}.`);
    if (isDestination(place)) add('Send save-the-dates (8 months or more ahead for travel weddings)', `${place} means travel for your guests: send these 8 months or more ahead.`);
  }

  const notes: Record<string, string> = {};
  for (const w of PLAN_WINDOWS) for (const text of w.tasks) if (parts[text]) notes[taskKey(w.id, text)] = parts[text].join(' ');
  return notes;
}
