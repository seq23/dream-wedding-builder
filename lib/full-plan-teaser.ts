// Two task names per window from the paid full plan, shown greyed and dated inside the
// free plan so she can see what $9 adds (owner, 10 Nov 2026). These twelve names are
// the only part of the paid list that lives in this repository; the list itself is a
// private object the Worker reads (lib/full-plan.ts). daysBefore counts back from her date.
export const FULL_PLAN_TEASER: Record<string, { text: string; daysBefore: number }[]> = {
  '12-plus': [
    { text: 'Read the venue contract for the cancellation, rain and overtime terms before you sign', daysBefore: 390 },
    { text: 'Pay the venue deposit and note the date the balance is due', daysBefore: 388 }
  ],
  '9-months': [
    { text: 'Book the officiant, or ask the friend who will marry you', daysBefore: 255 },
    { text: 'Ask the caterer what staff, rentals, service charge and tax add to the quote', daysBefore: 230 }
  ],
  '6-months': [
    { text: 'Order the wedding attire, allowing time for delivery and alterations', daysBefore: 175 },
    { text: 'Decide the rain plan and what a tent or indoor room would cost', daysBefore: 145 }
  ],
  '3-months': [
    { text: 'Give the photographer the list of family photos you must have', daysBefore: 50 },
    { text: 'Make a list of every balance still owed, with its due date and how it is paid', daysBefore: 40 }
  ],
  '1-month': [
    { text: 'Write a contact sheet: every vendor, a phone number, and who calls them if something is late', daysBefore: 14 },
    { text: 'Work out tips for each vendor and take out the cash', daysBefore: 9 }
  ],
  'wedding-week': [
    { text: 'Give the envelopes to the person who will hand them out, with a list of who gets which', daysBefore: 2 },
    { text: 'Hold the rehearsal and walk through who stands where', daysBefore: 1 }
  ]
};
