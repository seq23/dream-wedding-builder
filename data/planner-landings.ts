// The planner landing pages.
//
// Deliberately few, each hand-written. A large programmatic batch of near-identical pages is the
// pattern that appears to be hurting a sister property, so each record here was
// chosen against two tests and kept only if it passed both:
//
//   1. Does the page answer its question COMPLETELY on its own? If it needs the
//      tool to be useful, it cannot rank and it cannot be cited.
//   2. Does the planner add something the page cannot? If an article fully
//      settles it, that is a blog post, not an entry point - and it was dropped.
//
// What these pages deliberately are NOT: a wedding budget calculator. That
// category is saturated by publishers with far more authority, and a calculator
// answers "what does a wedding cost" - a question about the market. This planner
// answers "what should I do given what I have already committed to" - a question
// about one couple. Every page below is written to the second question.
//
// Numbers stated on these pages are published planning benchmarks and are labelled
// as such. Nothing here is a quote, and no page claims live vendor pricing.

import type { PlannerSeed } from '@/lib/planner-seed';

export interface LandingSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LandingTable {
  caption: string;
  columns: string[];
  rows: string[][];
  note: string;
}

/** A dated outside source for a fact on the page; rendered under "Sources". */
export interface LandingSource {
  label: string;
  url: string;
  /** The day we read it, e.g. "21 Nov 2026". */
  read: string;
}

export interface PlannerLanding {
  slug: string;
  host: string;
  /** The paid product this page's cluster belongs to, for the honest commerce CTA. */
  productId: string;
  title: string;
  h1: string;
  /**
   * Short link text for the site directory in the footer, which is what gives
   * this page an inbound internal link on its own host. Required: a landing
   * with no directory label is a landing nothing links to, which is how
   * /what-to-do-6-months-before-the-wedding shipped as an orphan on 2026-09-02.
   */
  directoryLabel: string;
  description: string;
  /** The exact question a person types. Rendered as the page's stated question. */
  question: string;
  /** The complete general answer, given before anything is asked of the reader. */
  directAnswer: string[];
  sections: LandingSection[];
  table?: LandingTable;
  faqs: { question: string; answer: string }[];
  /** What the planner does that this page cannot. If this is weak, the page is a blog post. */
  plannerAdds: string[];
  /**
   * The category contrast, on the two pages where a reader has almost certainly
   * arrived from a calculator query and is holding that expectation. Stated
   * against the category, never against a named competitor. Omitted elsewhere:
   * repeating positioning on a page that did not raise the question is noise.
   */
  categoryContrast?: string;
  ctaLabel: string;
  seed: PlannerSeed;
  verificationBoundary: string;
  relatedSlugs: string[];
  /** Required wherever the page states an outside fact (a fee, a price, a company fact). */
  sources?: LandingSource[];
}

export const plannerLandings: PlannerLanding[] = [
  {
    slug: 'wedding-cost-per-guest',
    host: 'weddingchecklistpdf.com',
    productId: 'budget-spreadsheet',
    title: 'Wedding cost per guest: what 50, 100 and 150 guests actually cost',
    h1: 'What a wedding costs per guest — and why guest count is the only number that changes everything',
    directoryLabel: 'What a wedding costs per guest',
    description: 'Guest count drives wedding cost more than anything else. See what roughly $235-$400 per guest means at 50, 100, 150 and 200 guests, and what scales per head.',
    question: 'How much does a wedding cost for 80 guests?',
    directAnswer: [
      'Published planning benchmarks put an all-in wedding somewhere between roughly $235 and $400 per guest, before venue-specific minimums. At 80 guests that is a working range of about $19,000 to $32,000; at 100 guests, about $23,500 to $40,000; at 150 guests, about $35,000 to $60,000.',
      'That spread is wide because it is honest. The low end assumes a venue that already owns tables, chairs, and a kitchen. The high end assumes a blank space where every plate, glass, chair, and light is a rental line item. Which of those you are looking at matters far more than the city you are in.',
      'The useful move is not to pick a number from that range. It is to notice which of your costs scale with guest count and which do not, because that is the only place a guest-count decision actually saves money.'
    ],
    sections: [
      {
        heading: 'Which costs scale per guest, and which are fixed',
        paragraphs: [
          'Cutting the guest list is the most-repeated wedding budget advice, and it is only about half true. Roughly 60–70% of a typical wedding budget moves with guest count. The rest does not move at all, which is why cutting twenty people rarely saves what couples expect.'
        ],
        bullets: [
          'Scales per guest: catering, bar, cake and dessert, rentals (chairs, china, glassware, linens), staffing, invitations, favours, welcome bags, shuttle capacity, vendor meals.',
          'Scales in steps, not smoothly: table count drives centrepieces, so 82 guests and 88 guests can cost the same but 88 and 92 may not. Tent size, generator size, and restroom trailers also step.',
          'Does not scale at all: photography, videography, music, officiant, planner, attire, hair and makeup, ceremony florals, lighting design, marriage licence.',
          'Behaves as a floor, not a per-head cost: food and beverage minimums. Below the minimum you pay it anyway, so cutting guests under a venue minimum saves nothing.'
        ]
      },
      {
        heading: 'Why the per-guest number is a poor budget and a good sanity check',
        paragraphs: [
          'A per-guest average is built from weddings that already made their decisions. Yours has not. Using it as a budget bakes in the average couple\'s priorities, which are probably not yours: if photography matters more to you than florals, the average is wrong in both directions at once.',
          'Where the number earns its keep is as a reality check on a plan that already exists. If your list is 150 people and your ceiling is $25,000, the per-guest maths says that is roughly $167 a head all-in. That is not impossible, but it is well under the benchmark range, and it means the plan needs to change in a specific way — usually format, not vendor selection.'
        ]
      },
      {
        heading: 'What to do when the number does not work',
        paragraphs: [
          'There are only four honest levers, and they are in order of how much they move: change the format, change the count, change the date, change the scope. Everything else is negotiation at the margins.'
        ],
        bullets: [
          'Format: a restaurant buyout or a lunch reception removes rentals, staffing, and often the bar minimum in one decision.',
          'Count: effective only above the venue minimum, and only in whole tables.',
          'Date: Friday, Sunday, and off-peak months move venue and vendor pricing more than any single line item negotiation will.',
          'Scope: cutting an entire category (no videographer, no favours, ceremony florals repurposed for the reception) beats trimming several.'
        ]
      }
    ],
    table: {
      caption: 'All-in planning range by guest count, at published benchmark rates',
      columns: ['Guests', 'Lower benchmark (~$235/guest)', 'Upper benchmark (~$400/guest)', 'Typical tables of 8–10'],
      rows: [
        ['50', '$11,750', '$20,000', '5–7'],
        ['80', '$18,800', '$32,000', '8–10'],
        ['100', '$23,500', '$40,000', '10–13'],
        ['150', '$35,250', '$60,000', '15–19'],
        ['200', '$47,000', '$80,000', '20–25']
      ],
      note: 'Planning benchmark ranges, not quotes. Regional cost, venue minimums, and whether the venue owns its own rentals will move any of these substantially. Verify against a real quote before committing.'
    },
    faqs: [
      { question: 'How much does a wedding cost for 80 guests?', answer: 'Roughly $18,800 to $32,000 all-in at published benchmark rates of about $235–$400 per guest. The low end assumes a venue that supplies tables, chairs, and a kitchen; the high end assumes a blank space where everything is rented.' },
      { question: 'Does cutting the guest list actually save money?', answer: 'Only partly. About 60–70% of a wedding budget moves with guest count; photography, music, attire, planning, and ceremony florals do not move at all. And below a venue food and beverage minimum, cutting guests saves nothing, because the minimum is charged regardless.' },
      { question: 'Is cost per guest a good way to set a budget?', answer: 'It is a good sanity check and a poor budget. A per-guest average encodes the average couple\'s priorities. Use it to test whether an existing plan is plausible, then allocate against what you personally refuse to cut.' },
      { question: 'Why is the per-guest range so wide?', answer: 'Because the biggest variable is not the guest, it is the venue. A venue that owns chairs, china, linens, and a commercial kitchen removes an entire cost category. A blank canvas venue adds it back, along with the labour to set and strike it.' }
    ],
    plannerAdds: [
      'Applies the per-guest maths to your actual count rather than a published average.',
      'Scores that number against the priorities you said you will not cut, so the tradeoff it suggests is yours and not the average couple\'s.',
      'Flags the hidden fee categories — service charge, tax, vendor meals, setup and strike labour — that a per-guest average silently includes and a venue quote silently excludes.'
    ],
    categoryContrast: 'A calculator answers what 80 guests cost and stops there. The question after that one is "I only have $18,000 — what do I change?", and answering it needs to know which three things you refuse to cut.',
    ctaLabel: 'Run this against your own guest count →',
    seed: { guests: '80', focus: 'Budget + Tradeoffs', budgetmode: 'unknown', q: 'What does my wedding cost at my guest count, and what actually changes if I cut the list?' },
    verificationBoundary: 'Per-guest figures on this page are published planning benchmarks, not quotes. No live vendor pricing or availability is claimed anywhere on this site. Verify every number against a written quote before signing or paying a deposit.',
    relatedSlugs: ['wedding-budget-tradeoffs', 'wedding-planning-reality-check', 'micro-wedding-planning']
  },
  {
    slug: 'what-to-do-6-months-before-the-wedding',
    host: 'weddingchecklistpdf.com',
    productId: 'timeline-template',
    title: 'What to do 6 months before the wedding (and at 12, 9, 3, and 1)',
    h1: 'What to do 6 months before the wedding',
    directoryLabel: 'What to do 6 months before the wedding',
    description: 'Six months out, a wedding plan either turns into bookings or stalls. What belongs at 12, 9, 6, 3, and 1 month, and what is genuinely late by now.',
    question: 'What should I be doing 6 months before my wedding?',
    directAnswer: [
      'At six months out, the work is conversion: turning shortlists into signed contracts. Specifically — send invitations or save-the-dates if they have not gone out, lock catering and bar, confirm the photographer and any second shooter, book hair and makeup, order attire that needs alterations, reserve the hotel block, and put a written timeline in front of every booked vendor.',
      'Six months is not the halfway point of the work. It is the last comfortable moment to change anything structural. After this, changing venue, date, or guest count stops being a decision and starts being a recovery.',
      'The single most common six-month mistake is treating the timeline as a to-do list rather than a dependency chain. Attire alterations cannot start before attire arrives; the seating chart cannot be finished before RSVPs close; the photography timeline cannot be set before the ceremony time is fixed. Ordering matters more than completeness.'
    ],
    sections: [
      {
        heading: 'The full sequence, by months remaining',
        paragraphs: [
          'Every horizon below assumes the previous one is done. If you are behind, do not skip forward — find the earliest unfinished item and start there, because the later items depend on it.'
        ],
        bullets: [
          '12 months: budget position, guest list draft, venue and date, planner or coordinator if using one, photographer and band or DJ (the three vendors that book out furthest).',
          '9 months: save-the-dates, attire ordered, catering direction and tasting scheduled, hotel block opened, officiant confirmed.',
          '6 months: invitations designed, catering and bar contracted, hair and makeup booked, florist contracted, rentals scoped, written timeline circulated to every booked vendor.',
          '3 months: invitations mailed, menu and bar finalised, alterations begun, ceremony details and readings, rain plan confirmed in writing, transport and shuttles booked.',
          '1 month: RSVPs closed, final headcount to caterer, seating chart, final payments scheduled, day-of timeline distributed, marriage licence, and a named person who is not you holding the vendor contact list.'
        ]
      },
      {
        heading: 'What is genuinely late at six months, and what is not',
        paragraphs: [
          'Checklists tend to induce panic evenly across every item, which is useless. Some things at six months are urgent and some are simply not.',
          'Urgent: anything with a lead time you do not control. Attire (ordering plus alterations routinely runs four to six months), printed stationery, and any vendor whose calendar fills a year ahead. Not urgent: favours, signage, playlists, welcome bags, and almost every decision that can be made in an afternoon at the two-month mark.'
        ]
      },
      {
        heading: 'The dependency chain most timelines get wrong',
        paragraphs: [
          'A wedding timeline is not a list of tasks; it is a graph. Four dependencies cause most of the real trouble.'
        ],
        bullets: [
          'Ceremony time depends on sunset, which fixes the photography timeline, which fixes when hair and makeup must start, which fixes the getting-ready call time.',
          'Final headcount depends on RSVP close, which fixes catering numbers, rentals, and the seating chart — none of which can be finished early no matter how organised you are.',
          'Load-in and strike windows depend on the venue contract, and they quietly govern what florals and lighting are physically possible.',
          'Alterations depend on attire arrival, which depends on an order date you may already have missed.'
        ]
      }
    ],
    faqs: [
      { question: 'Is 6 months enough time to plan a wedding?', answer: 'Yes, with two conditions: flexibility on date or venue, and willingness to shorten the vendor search rather than the vendor quality. The binding constraints at six months are attire lead times and the calendars of photographers and venues, not the number of tasks.' },
      { question: 'What should be booked by 6 months before the wedding?', answer: 'Venue, date, photographer, and music should already be signed. At six months you are contracting catering and bar, florist, hair and makeup, and rentals, and circulating a written timeline to everyone already booked.' },
      { question: 'When do wedding invitations go out?', answer: 'Design and order at around six months, mail at three months for a local wedding and four or more for a destination. Save-the-dates go out at nine months, or as soon as the date and venue are fixed if that is earlier.' },
      { question: 'What is the most common six-month mistake?', answer: 'Working the list in order of ease rather than dependency. Favours and playlists get done because they are pleasant; alterations and the vendor timeline get deferred because they are not — and those are the two that cannot be recovered later.' }
    ],
    plannerAdds: [
      'Re-derives the sequence from your actual months remaining rather than a generic 12-month chart, so nothing that no longer applies is shown to you.',
      'Puts your fixed constraints — venue already booked, date immovable, guest count set — ahead of the checklist, which is what changes the order of the remaining work.',
      'Names the next single decision instead of a list, which is the thing a checklist structurally cannot do.'
    ],
    ctaLabel: 'Build your 6-month plan →',
    seed: { months: '6', focus: 'Timeline / Weekend Flow', mode: 'hard', q: 'I am six months out. What is the next decision, and what is already late?' },
    verificationBoundary: 'Lead times on this page are typical planning benchmarks. Your vendors\' contracts, your venue\'s load-in terms, and your region\'s stationery and alteration turnarounds override every figure here. Confirm each in writing.',
    relatedSlugs: ['wedding-planning-reality-check', 'wedding-cost-per-guest', 'backyard-wedding-planning']
  },
  {
    slug: 'wedding-budget-tradeoffs',
    host: 'weddingchecklistpdf.com',
    productId: 'budget-spreadsheet',
    title: 'Wedding budget tradeoffs: what a better venue costs you elsewhere',
    h1: 'Can I afford a better venue if I cut the open bar?',
    directoryLabel: 'Wedding budget tradeoffs: what to cut first',
    description: 'What an upgrade in one wedding budget category really costs in the others, which swaps are real, and which quietly cost more than they save.',
    question: 'Can I afford a better venue if I cut the open bar?',
    directAnswer: [
      'Usually yes on the arithmetic and often no on the outcome, and the reason is that venue and bar are not independent line items. A full open bar commonly runs $20–$45 per guest for a four-to-five hour reception, so at 120 guests cutting to beer, wine, and one signature cocktail frees roughly $2,000–$4,000. That is real money and it is rarely enough to move you a venue tier.',
      'The trap is that the better venue frequently carries a food and beverage minimum, and bar spend counts toward it. Cutting the bar at such a venue does not free the money — it just moves the same spend into a category you chose less deliberately, or leaves you paying the shortfall for nothing.',
      'The tradeoff that actually works at that scale is a format or date change, not a category cut. Moving from Saturday evening to Friday or Sunday, or from dinner to lunch, moves venue pricing by a margin that no bar decision can match.'
    ],
    sections: [
      {
        heading: 'How to test any wedding tradeoff in four questions',
        paragraphs: [
          'Every "should we cut X to afford Y" question resolves the same way. The questions are in order, and most tradeoffs fail at question two.'
        ],
        bullets: [
          'Does the saving clear a threshold? A cut that does not move you across a venue tier, a minimum, or a package boundary buys you nothing but a slightly smaller number.',
          'Does the money actually leave the building? If the venue has an F&B minimum, or the cut item is bundled into a package, the saving is notional.',
          'Does it damage something you named as protected? A cut that touches a protected priority is not a tradeoff, it is a loss you have not admitted yet.',
          'Does it create a new cost? Cutting the bar package for a self-supplied bar adds corkage, licensing, staffing, glassware, ice, and insurance. Several classic "savings" are net-negative once the replacement is priced.'
        ]
      },
      {
        heading: 'Tradeoffs that generally work',
        paragraphs: [
          'These move real money without touching what most couples say they care about, because they change format rather than quality.'
        ],
        bullets: [
          'Off-peak date or non-Saturday: often the single largest lever available, and it touches nothing on the day itself.',
          'Lunch or brunch reception instead of dinner: lower food cost, lower bar consumption, shorter event, and frequently a lower venue rate for the same room.',
          'Beer, wine, and one signature cocktail instead of a full open bar: the tier most guests do not notice.',
          'Ceremony florals repurposed for the reception: one arrangement, two jobs, with a labour line for the move.',
          'Fewer, larger tables: fewer centrepieces, fewer linens, less rental count, identical guest experience.',
          'A venue that owns its own tables, chairs, china, and kitchen: removes an entire rental and labour category rather than shrinking it.'
        ]
      },
      {
        heading: 'Tradeoffs that usually cost more than they save',
        paragraphs: [
          'These look like savings on a spreadsheet and are not, once the second-order costs are counted.'
        ],
        bullets: [
          'Self-supplied bar at a venue that permits it: corkage, licence, staffing, glassware, ice, delivery, and liability insurance frequently exceed the package you cut.',
          'A cheaper blank-canvas venue: the site fee drops and rentals, generator, restrooms, flooring, lighting, kitchen, and labour all appear.',
          'Cutting photography hours: the hours cut are almost always the ones at the end, which is where the party photographs are.',
          'Skipping a coordinator to save the fee: the work does not disappear, it lands on a family member during the event.',
          'Trimming several categories by 10%: it damages the whole plan slightly and rarely clears any threshold. One whole-category decision beats five partial ones.'
        ]
      }
    ],
    faqs: [
      { question: 'How much does an open bar cost per guest?', answer: 'Commonly $20–$45 per guest for a four-to-five hour reception at benchmark rates, depending on tier and region. Beer, wine, and one signature cocktail typically lands in the lower half of that range.' },
      { question: 'Will cutting the bar let me afford a better venue?', answer: 'Only if the saving clears a real threshold and the venue does not have a food and beverage minimum that the bar spend was counting toward. At a venue with a minimum, cutting the bar usually moves the spend rather than removing it.' },
      { question: 'What is the biggest single lever in a wedding budget?', answer: 'The date and the format. Off-peak or non-Saturday, and lunch rather than dinner, move venue and catering pricing by more than any within-category negotiation, and neither touches the quality of anything.' },
      { question: 'Is it cheaper to bring your own alcohol?', answer: 'Sometimes, and less often than expected. Once corkage, licensing, bar staffing, glassware, ice, delivery, and liability insurance are priced, the self-supplied bar can exceed the package it replaced. Price the full replacement before deciding.' }
    ],
    plannerAdds: [
      'Scores a proposed swap against the priorities you marked protected, which is the only reason one tradeoff is better than another for you specifically.',
      'Surfaces the second-order costs a swap creates — corkage, staffing, rentals, labour — rather than only the line you cut.',
      'Tells you when a saving does not clear a threshold, which is the answer an article cannot give because it depends on your venue.'
    ],
    categoryContrast: 'A calculator prices the wedding you described. It has no view on which swap is right, because that depends entirely on what you already said you would not give up.',
    ctaLabel: 'Test your own tradeoff →',
    seed: { focus: 'Budget + Tradeoffs', mode: 'flexible', protect: 'Food + Bar,Photography', q: 'If I cut this category, can I afford the better venue, and what does it cost me elsewhere?' },
    verificationBoundary: 'Per-guest bar and catering figures are published planning benchmarks, not quotes. Venue minimums, corkage terms, and licensing rules vary by property and jurisdiction and must be confirmed in the contract.',
    relatedSlugs: ['wedding-cost-per-guest', 'wedding-planning-reality-check', 'backyard-wedding-planning']
  },
  {
    slug: 'backyard-wedding-planning',
    host: 'weddingchecklistpdf.com',
    productId: 'checklist-pdf',
    title: 'Backyard wedding planning: the costs a blank space adds back',
    h1: 'Backyard wedding planning — what a free venue actually costs',
    directoryLabel: 'Backyard wedding planning',
    description: 'A backyard wedding drops the venue fee but adds a venue\'s worth of infrastructure: what a house must supply, what it cannot, and when it is really cheaper.',
    question: 'How much does a backyard wedding cost, and what do I have to supply myself?',
    directAnswer: [
      'A backyard wedding removes the site fee and adds everything the site fee was paying for. You become the venue: power, water, level ground, shelter, restrooms, a kitchen, parking, waste removal, insurance, and the labour to install and remove all of it.',
      'For roughly 30 to 60 guests at a house that already has parking, a flat lawn, and neighbours who do not mind, a backyard wedding is genuinely cheaper and often meaningfully so. Above about 75 guests, tenting, restroom trailers, generators, and flooring usually push the total past a mid-tier venue that already owns those things.',
      'The decision is not about money in the abstract. It is about whether this specific property can absorb the load — and that is a checklist of physical facts, not a matter of taste.'
    ],
    sections: [
      {
        heading: 'What the house has to supply',
        paragraphs: [
          'Work this list against the actual property before pricing anything. Each item that fails becomes a rental line, a permit, or a reason to choose a different format.'
        ],
        bullets: [
          'Power: catering, lighting, and a band draw far more than a domestic supply. A generator plus a distribution plan is the norm, not the exception.',
          'Shelter: a rain plan for a backyard is a tent, and a tent booked in the week of the wedding is not a rain plan. Tents also need flooring on uneven or soft ground.',
          'Restrooms: household plumbing is not rated for a hundred people in five hours. Trailers are the standard answer and they need level access and power.',
          'Kitchen: caterers need prep space, water, refrigeration, and a staging area out of guest sightlines. A domestic kitchen rarely qualifies.',
          'Ground: heels, tables, and dance floors all need level, dry, load-bearing ground. Irrigation, septic fields, and tree roots all constrain where a tent may be staked.',
          'Parking and access: guest parking, plus a delivery route wide enough for a tent lorry, plus a load-in and strike window that does not run into the ceremony.',
          'Permits and neighbours: noise ordinances, curfews, amplified music rules, open flame permits, and — practically — the neighbours whose weekend you are borrowing.',
          'Insurance: event liability cover, and confirmation of what a homeowner policy does and does not extend to.',
          'Waste and reinstatement: refuse removal, and the lawn repair nobody budgets for.'
        ]
      },
      {
        heading: 'When a backyard wedding is genuinely cheaper',
        paragraphs: [
          'The economics are strongly size-dependent, and the break point is lower than most couples expect.'
        ],
        bullets: [
          'Under about 50 guests, on a property with existing parking, level lawn, and a usable indoor fallback: usually cheaper, sometimes dramatically.',
          '50 to 75 guests: depends almost entirely on whether you need a tent. Tent, flooring, and lighting together often exceed a small venue\'s site fee.',
          'Above 75 guests: the infrastructure stack — tent, generator, restrooms, flooring, kitchen, parking management — typically costs more than a venue that already owns all of it and amortises it across many events.',
          'Any guest count, if the property has no indoor fallback: price the tent as a certainty, not a contingency, and re-run the comparison.'
        ]
      },
      {
        heading: 'What a backyard buys that no venue sells',
        paragraphs: [
          'Cost is not the only reason to do this, and it is worth being explicit about the actual return: unlimited time, no curfew imposed by a booking after yours, no vendor list, no F&B minimum, and a place that already means something to the family. Couples who choose a backyard for meaning are rarely disappointed. Couples who choose it purely to save money above 75 guests frequently are.'
        ]
      }
    ],
    faqs: [
      { question: 'Is a backyard wedding cheaper?', answer: 'Under roughly 50 guests on a suitable property, usually yes. Above roughly 75, usually no — tent, flooring, generator, restroom trailers, kitchen staging, and the labour to install and strike them typically exceed the site fee of a venue that already owns those things.' },
      { question: 'Do I need a tent for a backyard wedding?', answer: 'If there is no indoor space that can hold every guest, yes, and it should be budgeted as a certainty rather than a contingency. A tent booked as a last-minute rain response is not a rain plan.' },
      { question: 'Do I need a permit for a backyard wedding?', answer: 'Frequently. Noise ordinances, amplified music curfews, open flame permits, tent permits, and parking restrictions vary by municipality. Check before booking vendors, not after.' },
      { question: 'How many bathrooms does a backyard wedding need?', answer: 'Household plumbing is not designed for a hundred guests over five hours. Restroom trailers are the standard solution above about 40 guests, and they need level access and a power supply.' }
    ],
    plannerAdds: [
      'Prices the infrastructure stack against your actual guest count, which is the number that decides whether a backyard is cheaper or more expensive.',
      'Runs the rain plan as a cost rather than a hope, because in a backyard those are the same decision.',
      'Turns the property audit into vendor questions you can send, rather than a list you read and forget.'
    ],
    ctaLabel: 'Cost your backyard wedding →',
    seed: { venue: 'private home / backyard', focus: 'Venue + Lodging', mode: 'hard', protect: 'Rain Plan,Guest Comfort', q: 'What does my backyard actually have to supply, and at my guest count is it still cheaper?' },
    verificationBoundary: 'Permits, noise ordinances, tent and open flame rules, and insurance requirements are jurisdiction-specific. Nothing on this page is legal or insurance advice, and every requirement must be confirmed with the local authority and your insurer.',
    relatedSlugs: ['micro-wedding-planning', 'wedding-cost-per-guest', 'wedding-planning-reality-check']
  },
  {
    slug: 'micro-wedding-planning',
    host: 'weddingchecklistpdf.com',
    productId: 'checklist-pdf',
    title: 'Micro and courthouse wedding planning below 50 guests',
    h1: 'Micro weddings and courthouse weddings — what actually changes below 50 guests',
    directoryLabel: 'Micro and courthouse wedding planning',
    description: 'Under about 50 guests a wedding becomes a different event, not a smaller one: what changes, what stops mattering, and where a micro-wedding budget goes.',
    question: 'What is different about planning a micro wedding or a courthouse wedding?',
    directAnswer: [
      'A micro wedding is not a large wedding scaled down. Below roughly 50 guests, three structural things change: venue options invert, the fixed costs stop being amortised, and the guest experience becomes the point rather than the logistics.',
      'Venue options invert because restaurants, private dining rooms, small historic properties, and homes all become available while ballrooms and large estates become badly proportioned and often refuse the booking or impose a minimum you cannot reach. The best small-wedding venues are usually not wedding venues.',
      'Fixed costs stop being amortised: a photographer, an officiant, and a licence cost the same for 20 guests as for 200. That is why per-guest cost rises sharply as the count falls, and why a $15,000 micro wedding can feel more generous per person than a $45,000 wedding for 150.',
      'A courthouse wedding is the extreme case — the ceremony is a fixed, scheduled, low-cost civil procedure, and every planning decision moves to what happens afterwards.'
    ],
    sections: [
      {
        heading: 'What stops mattering below 50 guests',
        paragraphs: [
          'A large part of the standard wedding checklist exists to manage crowd logistics. At this size those problems simply do not arise, and continuing to solve them is where small weddings waste money.'
        ],
        bullets: [
          'Shuttles and parking management: usually unnecessary.',
          'An escort card display: with under 50 guests a single seating plan or open seating works.',
          'A large dance floor and a full band: a small room with a DJ or a playlist frequently outperforms both.',
          'Multiple bars and bar staff ratios: one bar clears 40 guests comfortably.',
          'Tiered cake for volume: dessert becomes a choice rather than a portion-count exercise.',
          'A full planning team: month-of coordination is generally sufficient at this scale.'
        ]
      },
      {
        heading: 'What starts mattering more',
        paragraphs: [
          'The things that scale badly downward are the things guests notice most at close range.'
        ],
        bullets: [
          'Food quality: at 30 guests a restaurant can cook to order. This is the single biggest upgrade a micro wedding buys, and it is worth spending the saved logistics money here.',
          'The room itself: with no crowd to fill it, proportions and light do the work that decor does at scale. A too-large room is the most common micro wedding mistake.',
          'Timeline pacing: a small event has no crowd noise to hide a gap. Twenty minutes of nothing is visible in a way it never is at 150.',
          'Who is in the room: at 30 guests every invitation is a decision with consequences, and the guest list conversation is harder than any vendor conversation.',
          'Photography: fewer people, closer quarters, more candid coverage, and no second shooter needed — but the room\'s light matters much more.'
        ]
      },
      {
        heading: 'The courthouse variant',
        paragraphs: [
          'A courthouse ceremony fixes the one thing weddings usually spend most on deciding: the ceremony is scheduled, brief, legally sufficient, and inexpensive. What remains is entirely optional and entirely yours.',
          'The planning question becomes what the day is around it — a lunch, a dinner, a party later in the year, or nothing at all. Couples who plan the courthouse ceremony and forget to plan the hours either side of it are the ones who report it felt anticlimactic. The ceremony is not the part that needs planning; the day is.'
        ],
        bullets: [
          'Confirm licence requirements, waiting periods, witness counts, and identification well in advance — these are jurisdictional and inflexible.',
          'Photography for a courthouse ceremony is usually an hour or two, and often the best value photography a couple ever buys.',
          'Book somewhere for immediately afterwards. A restaurant table for eight at 2pm is the whole reception, and it is enough.',
          'A larger celebration later is a separate event with a separate budget, and separating them deliberately is a legitimate plan rather than a compromise.'
        ]
      }
    ],
    faqs: [
      { question: 'What counts as a micro wedding?', answer: 'Commonly under about 50 guests, with roughly 20 to 40 the most typical range. The number matters less than the structural shift: below this size, venue options invert and fixed costs stop being spread across a crowd.' },
      { question: 'Is a micro wedding cheaper per guest?', answer: 'No — per guest it is usually more expensive, because photography, officiant, licence, attire, and coordination cost the same regardless of headcount. The total is lower; the per-head figure is higher, and that is what buys the noticeably better food and room.' },
      { question: 'Where should you have a micro wedding?', answer: 'Frequently somewhere that is not a wedding venue: a restaurant buyout, a private dining room, a small historic property, or a home. Purpose-built wedding venues are proportioned for larger counts and often impose minimums a small wedding cannot reach.' },
      { question: 'What do you do after a courthouse wedding?', answer: 'Plan the hours either side deliberately — photography, and somewhere booked immediately afterwards, even if it is one restaurant table. The ceremony is fixed and brief; the day around it is the part that needs planning.' }
    ],
    plannerAdds: [
      'Re-scores the standard checklist for your actual count, so the crowd-logistics items stop being shown to you at all.',
      'Redirects the freed budget against your protected priorities rather than leaving it unallocated, which is where small weddings quietly become expensive ones.',
      'Builds the vendor questions for a restaurant or private-home booking, which are not the questions you ask a wedding venue.'
    ],
    ctaLabel: 'Plan your micro wedding →',
    seed: { guests: '30', venue: 'restaurant buyout', focus: 'Full concept', mode: 'hard', protect: 'Food + Bar,Guest Comfort', q: 'What actually changes in my plan at this guest count, and where should the money go instead?' },
    verificationBoundary: 'Marriage licence requirements, waiting periods, witness rules, and courthouse scheduling are jurisdiction-specific and change. Nothing here is legal advice; confirm every requirement with the issuing authority.',
    relatedSlugs: ['backyard-wedding-planning', 'wedding-cost-per-guest', 'wedding-planning-reality-check']
  },
  {
    slug: 'wedding-planning-reality-check',
    host: 'weddingchecklistpdf.com',
    productId: 'checklist-pdf',
    title: 'We have no idea what a wedding costs: an honest starting point',
    h1: 'We have no idea what things cost. Where do we actually start?',
    directoryLabel: 'Where to start when you do not know costs',
    description: 'A first step for couples with no reference point: why published wedding cost averages mislead, the five numbers that decide the rest, and what to settle first.',
    question: 'We just got engaged and have no idea what anything costs. Where do we start?',
    directAnswer: [
      'Start by refusing to pick a budget number. You cannot set one yet, and a number chosen before you know what drives cost will be wrong in a way that shapes every later decision.',
      'Settle five things first, in this order: roughly how many people, roughly where, roughly when, what kind of event it is, and what the two of you will not compromise on. Those five determine the cost. The cost does not determine them.',
      'Published averages are the worst possible starting point, and they are the first thing everyone reads. An average is a single number produced by weddings of wildly different formats in wildly different markets. It tells you nothing about yours, and it anchors you to a figure you then negotiate against for a year.'
    ],
    sections: [
      {
        heading: 'Why the average wedding cost is a bad number',
        paragraphs: [
          'National wedding averages are widely republished and rarely useful. They mix a 200-guest city hotel with a 40-guest restaurant lunch, they are usually collected from couples who were already engaged with the wedding industry, and they almost never state what is included — attire, rings, honeymoon, and pre-wedding events are in some figures and not others.',
          'Worse, the average functions as an anchor. Once you have read a number, every quote is judged against it rather than against what you actually want. Couples who never learn the average tend to make better decisions, because they judge each quote against their own priorities instead.'
        ]
      },
      {
        heading: 'The five numbers that decide everything else',
        paragraphs: [
          'None of these is a budget. All of them constrain the budget, and all of them are answerable today without a single vendor conversation.'
        ],
        bullets: [
          'Guest count, roughly. The single largest cost driver. You do not need the list, only the order of magnitude: 30, 80, 150, or 250.',
          'Region. Cost varies by more between markets than between most of your vendor choices within one.',
          'Season and day. Off-peak and non-Saturday move pricing more than any negotiation will.',
          'Format. A seated dinner, a lunch, a cocktail reception, and a restaurant buyout are four different cost structures, not four styles of the same one.',
          'What is protected. The two or three things you would keep if the budget halved. This is the only one that is about you, and it is the one that makes every later tradeoff decidable.'
        ]
      },
      {
        heading: 'What to do before talking to any vendor',
        paragraphs: [
          'Vendors quote against a brief. With no brief you receive packages, and packages are designed to be compared on price, which is exactly the comparison you are least equipped to make.'
        ],
        bullets: [
          'Write the five numbers down, even as ranges. "Somewhere between 70 and 100 people, spring, our own region, seated dinner, and we will not cut photography or food" is a brief.',
          'Decide your budget position honestly — a hard ceiling, a comfortable range, or genuinely unknown. Admitting "unknown" is a real position and a workable one; pretending to a number you invented is not.',
          'List what you do not want. Avoidances constrain vendor proposals faster than preferences do.',
          'Agree who decides. Most wedding budget conflict is not about money, it is about an undeclared decision-making structure between two people and their families.'
        ]
      },
      {
        heading: 'What a first quote will actually contain',
        paragraphs: [
          'Knowing this in advance is most of the reason a first quote is alarming. A venue quote typically excludes tax and service charge — together often 25% or more on top — and may exclude ceremony fee, cake cutting, corkage, security, valet, overtime, vendor meals, and setup and strike labour. A quote is not a total. Ask for the total, in writing, with every add-on named, and compare those.'
        ]
      }
    ],
    faqs: [
      { question: 'What is the average cost of a wedding?', answer: 'It is a published figure and a poor planning input. Averages mix formats, guest counts, and markets, rarely state what is included, and function as an anchor that distorts every quote you subsequently read. Guest count, region, season, and format tell you far more about your own cost than any average does.' },
      { question: 'How do you set a wedding budget with no reference point?', answer: 'You do not set one first. Settle guest count, region, season, format, and what you refuse to compromise on. Those five determine a realistic range; a number chosen before them is a guess you will then defend for a year.' },
      { question: 'What should we decide before contacting vendors?', answer: 'The five constraints, your honest budget position (hard ceiling, range, or unknown), a short list of what you do not want, and who between you actually decides. That is a brief, and vendors quote against briefs far better than against silence.' },
      { question: 'Why is the first venue quote so much higher than expected?', answer: 'Because a quote is usually not a total. Tax and service charge together often add 25% or more, and ceremony fees, corkage, cake cutting, security, valet, overtime, vendor meals, and setup and strike labour are commonly separate lines. Ask for the all-in figure in writing.' }
    ],
    plannerAdds: [
      'Records the five constraints as a profile every later step is scored against, instead of leaving them in a conversation you had once.',
      'Produces a range from your own inputs rather than a national average, and labels its confidence rather than presenting it as fact.',
      'Names what is still unknown, which is the thing a first-time planner most needs and no article can tell you.'
    ],
    ctaLabel: 'Run the planning reality check →',
    seed: { focus: 'I am overwhelmed', mode: 'discovery', budgetmode: 'unknown', q: 'We have no reference point at all. What do we need to decide first?' },
    verificationBoundary: 'This page describes how wedding cost behaves, not what your wedding will cost. Every figure quoted anywhere on this site is a published planning benchmark and not a quote. No live vendor pricing or availability is claimed.',
    relatedSlugs: ['wedding-cost-per-guest', 'wedding-budget-tradeoffs', 'micro-wedding-planning']
  },
  // --- Added 21 Nov 2026 from the audience research (populations 1, 3, 4, 5 and 7).
  // Each still passes the two tests at the top of this file. Every number names its
  // source and the day it was read; nothing here is a quote or a promise.
  {
    slug: 'courthouse-wedding',
    host: 'weddingchecklistpdf.com',
    productId: 'courthouse-wedding-kit',
    title: 'Courthouse wedding: cost, what to bring and a dated plan',
    h1: 'Courthouse wedding: what it costs, what to bring, and a plan dated to your day',
    directoryLabel: 'Courthouse wedding: cost and plan',
    description: 'What a courthouse wedding costs in fees at four large US offices, what to bring on the day, and a short plan dated back from your appointment.',
    question: 'How much does it cost to get married at the courthouse, and what do we need to bring?',
    directAnswer: [
      'The government fees are small. At the four offices in the table below, a marriage license cost $35 to $98 when we read their pages on 21 November 2026, and a ceremony at the courthouse added $10 to about $120 where one is offered. The bigger costs are the ones you choose: photos, outfits, rings and dinner afterwards.',
      'What catches couples out is timing, not cost. Some offices make you wait a day or more between the license and the ceremony, licenses expire (60 days in New York City and Cook County), and some ceremony fees are cash only. Check those three things with your own county clerk first; everything else follows from them.',
      'On the day, bring photo ID for both of you, the license (or both of you, if you are getting it that day), any witnesses your office requires, the fee in a form it accepts, and the rings.'
    ],
    table: {
      caption: 'License and ceremony fees at four large offices (read 21 November 2026)',
      columns: ['Office', 'License fee', 'Courthouse ceremony', 'Wait and validity'],
      rows: [
        ['New York City (City Clerk)', '$35', 'Held by the City Clerk; check the fee when you book', 'Ceremony at least 24 hours after the license; usually valid 60 days (180 for active military)'],
        ['Los Angeles County (Registrar-Recorder/County Clerk)', '$91 public, $85 confidential', '$35, plus $20 if the office supplies the witness', 'Ceremonies by appointment; confidential licenses need no witness'],
        ['Cook County, Illinois (County Clerk and Marriage Court)', '$60', '$10 administrative fee at Marriage Court', 'Effective the day after issue; valid 60 days; ceremony in Cook County'],
        ['Maricopa County, Arizona (Clerk of Superior Court and Justice Courts)', '$98', 'Set by each judge, usually $100 to $120, cash only', 'Usable the day you get it; valid one year; two witnesses aged 18+']
      ],
      note: 'Read from each office’s own page on 21 November 2026 (links under Sources). Fees change: Los Angeles County supervisors approved higher marriage fees in September 2025 (LAist), and the county’s page still listed these amounts when we read it. Confirm with your clerk before you go.'
    },
    sections: [
      {
        heading: 'What to bring on the day',
        paragraphs: [
          'Offices differ, so treat this as the list to check against your clerk’s page, not a replacement for it.'
        ],
        bullets: [
          'Government photo ID for both of you, the same documents you used to apply if the license is already issued.',
          'The marriage license, unless you are applying and marrying on the same visit.',
          'Witnesses, if your office requires them (Maricopa County’s justice courts ask for two, aged 18 or over; a Los Angeles confidential license needs none).',
          'The fees in a form the office takes. Maricopa County’s courtroom ceremony fee is cash only, while its license can be paid by card.',
          'Your appointment confirmation, and time to spare for security screening.',
          'Rings, any vows you wrote, and the name of someone who will take photos if you have no photographer.'
        ]
      },
      {
        heading: 'A plan dated back from your appointment',
        paragraphs: [
          'Count back from the day you want. The spacing below suits an office with a short wait and a 60-day license; stretch it if yours is stricter.'
        ],
        bullets: [
          '6 to 8 weeks before: choose the office and read its page for appointments, ceremony days, waiting period, validity and accepted payment. Decide whether you want a separate party later.',
          '4 weeks before: book the ceremony slot if your office takes bookings, a photographer if you want one, and the table for dinner afterwards. Ask your witnesses.',
          '1 to 3 weeks before: apply for the license inside its validity window, with both IDs. Set out what you will wear.',
          'The week of: confirm the appointment, your witnesses and the cash or card you need. Put the license, IDs and rings in one envelope.',
          'After: check how and when the signed license is returned, order certified copies, then start any name change.'
        ]
      },
      {
        heading: 'Legal day now, party later',
        paragraphs: [
          'Many couples marry at the courthouse first and hold the celebration months later, for a move, a deployment, a visa timeline or simply to spread the cost. That is two plans with two dates: a short legal plan for the courthouse, and an ordinary wedding plan for the party, without the license tasks.',
          'Give the party its own date in the planner so its tasks are dated from the party, not from the day you signed. Tell guests on the invitation that you are already married, so nobody expects a ceremony they will not see.'
        ]
      }
    ],
    faqs: [
      { question: 'How much does a courthouse wedding cost?', answer: 'In fees, $35 to about $220 at the four offices we checked on 21 November 2026: a $35 to $98 license, plus $10 to about $120 for a courthouse ceremony where one is offered. Photos, outfits, rings and dinner afterwards are the larger costs, and you choose all of them.' },
      { question: 'Do we need witnesses for a courthouse wedding?', answer: 'It depends on the office. Maricopa County’s justice courts ask for two witnesses aged 18 or over, and Los Angeles County will supply one for $20; a Los Angeles confidential license needs none. Your clerk’s page says what yours requires.' },
      { question: 'Can we get the license and marry on the same day?', answer: 'Sometimes. A Maricopa County license can be used the day you get it, while New York City requires 24 hours between the license and the ceremony unless a judge grants a waiver, and a Cook County license takes effect the day after issue.' },
      { question: 'Can we have a party after a courthouse wedding?', answer: 'Yes. Treat it as its own event with its own date, so the party plan is dated from the party. Say on the invitation that you are already married.' }
    ],
    plannerAdds: [
      'Dates each step from your own appointment, so the license lands inside its validity window.',
      'Keeps the party later as its own plan with its own date, if you are having one.',
      'Prints one page to hand to a witness or a parent with the time, place and what to bring.'
    ],
    ctaLabel: 'Date my courthouse plan →',
    seed: { guests: '10', focus: 'Timeline / Weekend Flow', mode: 'hard', q: 'We are marrying at the courthouse. What do we do, and when, before the appointment?' },
    verificationBoundary: 'Fees, waits and rules on this page were read from each office’s own website on 21 November 2026 and are not legal advice. Counties change them without notice; your county clerk’s current page is the authority.',
    sources: [
      { label: 'NYC 311: marriage license fee, 24-hour wait and validity', url: 'https://portal.311.nyc.gov/article?kanumber=KA-02115', read: '21 Nov 2026' },
      { label: 'Los Angeles County Registrar-Recorder/County Clerk: license fees', url: 'https://www.lavote.gov/home/county-clerk/marriage-licenses-ceremonies/fees', read: '21 Nov 2026' },
      { label: 'Los Angeles County Registrar-Recorder/County Clerk: ceremonies', url: 'https://www.lavote.gov/home/county-clerk/marriage-licenses-ceremonies/ceremonies', read: '21 Nov 2026' },
      { label: 'LAist: Los Angeles County marriage license fees set to rise', url: 'https://laist.com/news/politics/marriage-licenses-cost-increase-los-angeles-county', read: '21 Nov 2026' },
      { label: 'Cook County Clerk: marriage licenses', url: 'https://www.cookcountyclerkil.gov/vital-records/marriage-civil-union/marriage-licenses', read: '21 Nov 2026' },
      { label: 'Circuit Court of Cook County: Marriage Court', url: 'https://www.cookcountycourtil.gov/case-type/marriage-and-civil-union', read: '21 Nov 2026' },
      { label: 'Maricopa County Justice Courts: get married', url: 'https://justicecourts.maricopa.gov/i-want-to/get-married', read: '21 Nov 2026' }
    ],
    relatedSlugs: ['micro-wedding-planning', 'wedding-to-do-list', 'wedding-without-a-coordinator']
  },
  {
    slug: 'maid-of-honor-duties',
    host: 'weddingchecklistpdf.com',
    productId: 'maid-of-honor-kit',
    title: 'Maid of honor duties: the list by month, and what is optional',
    h1: 'Maid of honor duties: what is expected, what is optional, and when each one happens',
    directoryLabel: 'Maid of honor duties, by month',
    description: 'The maid of honor duties most couples expect, the ones that are optional, and when each falls, from the day she is asked to the morning after.',
    question: 'What does a maid of honor actually have to do?',
    directAnswer: [
      'Fewer things than the internet suggests. Most couples expect their maid of honor to say yes honestly, keep the dates free, get her outfit sorted on time, help with the wedding-week jobs she is given, and be beside the couple on the day. Everything else is a choice the couple and she make together.',
      'The usual extras are hosting or co-hosting a shower, leading the bachelorette, giving a toast, holding the rings or the bouquet, and acting as the point person on the day. None is a rule, and each one costs time or money, so the useful step is to agree which ones she is doing early, in writing, rather than finding out in the last month.',
      'If she is also running the day because there is no coordinator, she needs paper: the timeline, who to call, and what is paid. That is a different job from being maid of honor, and it is worth naming it as one.'
    ],
    table: {
      caption: 'Her jobs by month: expected and optional',
      columns: ['When', 'Job', 'Expected or optional'],
      rows: [
        ['The week she is asked', 'Say yes only if she can; ask what the couple are hoping for, including costs', 'Expected'],
        ['9 to 6 months before', 'Help choose and order her outfit; keep the key dates free', 'Expected'],
        ['6 to 3 months before', 'Plan or co-host the shower', 'Optional (often shared with family)'],
        ['3 to 1 months before', 'Plan the bachelorette with the couple’s budget and guest list', 'Optional'],
        ['1 month before', 'Write the toast, if she is giving one', 'Optional'],
        ['Wedding week', 'Do the jobs on her list; collect the timeline and the contacts she needs', 'Expected'],
        ['The day', 'Be with the couple while getting ready; hold the rings, bouquet or vows if asked', 'Expected'],
        ['The day after', 'Return anything borrowed or rented that she took charge of', 'Expected if she agreed to it']
      ],
      note: 'This is common practice, not a rule. Couples and their maids of honor change it all the time; the point of the table is to agree the split early.'
    },
    sections: [
      {
        heading: 'The conversation that saves the friendship',
        paragraphs: [
          'Most maid-of-honor stress comes from guessing. One short talk soon after she says yes settles it: which of the optional jobs she is taking, who pays for what (her outfit, the shower, her travel), and whether she or someone else is the point person on the day.'
        ],
        bullets: [
          'Write down the jobs she has agreed to, with the month each falls in.',
          'Agree a spending ceiling for anything she hosts.',
          'Name who answers vendor calls on the day, so it is not assumed to be her.'
        ]
      },
      {
        heading: 'If she is also the one running the day',
        paragraphs: [
          'With no coordinator, the person running the day needs the same things a coordinator would bring: the timeline by the minute, every vendor’s arrival time and phone number, what is already paid and what goes in an envelope, and who to call when something runs late. A hand-over packet puts that on paper so she is not ringing the couple during photos.'
        ]
      }
    ],
    faqs: [
      { question: 'Does the maid of honor have to throw the bridal shower?', answer: 'No. Hosting the shower is a common job but an optional one, and it is often shared with family. Agree early who is hosting and who is paying.' },
      { question: 'Does the maid of honor pay for her own dress?', answer: 'Usually she does, which is why the cost belongs in the first conversation. If the couple choose an expensive outfit, some offer to pay part of it.' },
      { question: 'Does the maid of honor have to give a speech?', answer: 'Only if the couple want toasts and she agrees. If she is giving one, a month before is a good time to write it, and two or three minutes is plenty.' },
      { question: 'What does the maid of honor do on the wedding day?', answer: 'She is with the couple while they get ready, helps with anything they hand her (rings, bouquet, vows, the dress), and does the jobs on her list. If she is also running the day, she needs the timeline and the vendor contacts on paper.' }
    ],
    plannerAdds: [
      'Puts her agreed jobs into the couple’s plan, dated from the real wedding date.',
      'Prints a hand-over packet with the timeline, contacts and what is paid, for whoever runs the day.',
      'Keeps the optional jobs visible as optional, so nothing is assumed.'
    ],
    ctaLabel: 'Date the wedding plan she will follow →',
    seed: { focus: 'Timeline / Weekend Flow', mode: 'flexible', protect: 'Family Ease', q: 'Our maid of honor is helping. Which jobs are hers, and when does each one happen?' },
    verificationBoundary: 'This page describes common wedding practice in the US, not a set of rules. No statistics are claimed. Agree the jobs with your own maid of honor.',
    relatedSlugs: ['wedding-without-a-coordinator', 'wedding-to-do-list', 'who-pays-for-what-wedding']
  },
  {
    slug: 'zola-vs-the-knot',
    host: 'weddingchecklistpdf.com',
    productId: 'checklist-pdf',
    title: 'Zola vs The Knot: dated facts, and what the merger news means',
    h1: 'Zola vs The Knot: the dated facts, and what the reported deal changes',
    directoryLabel: 'Zola vs The Knot, dated facts',
    description: 'Zola and The Knot compared on dated, linked facts: who owns what, the reported deal, seating limits, card fees, Android and data sharing. Read 21 Nov 2026.',
    question: 'Should we plan our wedding with Zola or The Knot, now that The Knot is reported to be buying Zola?',
    directAnswer: [
      'Both are free to use and paid for in other ways: The Knot mainly by vendors who advertise to couples, Zola mainly by its registry and stationery. On 14 October 2026 Reuters reported, citing two people familiar with the deal, that The Knot Worldwide had agreed to buy Zola, subject to regulatory clearance, with Zola kept as a standalone brand. The companies declined to comment.',
      'If the deal closes, the three largest free planning sites in the US (The Knot, WeddingWire, which The Knot already owns, and Zola) will belong to one company. That matters less for your checklist than for where your guest list, address book and registry live, and who may see them.',
      'Pick on the thing you need most. Zola is strongest on registry and a matching website; The Knot on finding vendors. If what you need is a dated plan and paper you can hand to whoever runs the day, neither is built around that, and you do not need an account for it.'
    ],
    table: {
      caption: 'Zola and The Knot side by side (read 21 November 2026)',
      columns: ['', 'Zola', 'The Knot'],
      rows: [
        ['Who owns it', 'Zola, Inc.; The Knot Worldwide agreed to buy it (Reuters, 14 Oct 2026, unconfirmed by the companies)', 'The Knot Worldwide, which also owns WeddingWire and, since July 2024, Simply Eloped'],
        ['How it is paid for', 'Registry, stationery and other commerce', 'Vendor advertising, registry and invitations'],
        ['Seating chart', 'Free for up to 15 guests; Premium to add more (Zola help page)', 'Not compared here'],
        ['Card gifts to cash funds', 'A 2.5% handling fee on card payments (Zola help page)', 'Not compared here'],
        ['Phones', 'iPhone app; no Zola app found in a Google Play search on 21 Nov 2026', 'iPhone app, and an Android app listed on Google Play'],
        ['App Store rating (21 Nov 2026)', '4.91 from 99,338 ratings', '4.85 from 224,289 ratings'],
        ['Data sharing it discloses', 'See Zola’s privacy policy', 'Its California notice says it “sometimes disclose[s] information to unaffiliated third parties to provide offers”']
      ],
      note: 'Each fact is linked under Sources with the day we read it. We describe both services by name only to compare them; Dream Wedding is not connected with Zola or The Knot.'
    },
    sections: [
      {
        heading: 'What couples say in their own reviews',
        paragraphs: [
          'Reading the most recent 1- and 2-star App Store reviews of both apps on 21 November 2026, the common complaints were bugs and lost guest data, guest list and RSVP trouble, and support. Two short examples, in the reviewers’ words:'
        ],
        bullets: [
          '“Adding guests from contacts will freeze the app” (The Knot, App Store review, 18 Nov 2026).',
          '“they make you pay to seat more than 15 guests” (Zola, App Store review, 17 Aug 2026).',
          'A partner joining the planning came up too: “there is no feature to let your fiance join the planning” (The Knot, 22 Aug 2026).'
        ]
      },
      {
        heading: 'Where Dream Wedding fits, and where it does not',
        paragraphs: [
          'Dream Wedding is a dated wedding plan, not a registry, wedding website or RSVP service, so if you need those, Zola or The Knot is the better choice for that part. What it does: the plan is free with no account, every task gets a real date from your wedding date, and the printable packet is made for the friend or parent running your day. The paid files are one-time purchases, and we never sell your plan or your email.'
        ]
      }
    ],
    faqs: [
      { question: 'Is The Knot buying Zola?', answer: 'Reuters reported on 14 October 2026, citing two people familiar with the deal, that The Knot Worldwide agreed to buy Zola, subject to regulatory clearance, with Zola run as a standalone brand. The companies declined to comment, so treat it as reported, not confirmed.' },
      { question: 'Is Zola free?', answer: 'Its planning tools are free, with limits. Zola’s own help page says the seating chart is free for up to 15 guests and Premium adds more, and card gifts to cash funds carry a 2.5% handling fee.' },
      { question: 'Does Zola have an Android app?', answer: 'We found no Zola app in a Google Play search on 21 November 2026. Zola works in a phone browser.' },
      { question: 'Do I need an account to plan a wedding?', answer: 'Not for a dated checklist. Dream Wedding’s free plan opens with no account. You need accounts for a registry or a wedding website, which Dream Wedding does not offer.' }
    ],
    plannerAdds: [
      'A dated plan from your wedding date, with no account and no vendor marketplace.',
      'A printable packet for whoever runs your day, made in your browser.',
      'One-time prices for the paid files, with no subscription.'
    ],
    ctaLabel: 'Open the free dated plan →',
    seed: { focus: 'Full concept', mode: 'flexible', q: 'We want a dated plan without signing up for a wedding site. Where do we start?' },
    verificationBoundary: 'Facts about Zola and The Knot come from their own pages, Reuters and Business Wire, each linked with the day we read it (21 November 2026). Review quotes are short, dated and linked to the App Store pages. Dream Wedding is not affiliated with either company; their names are used only to describe them.',
    sources: [
      { label: 'Reuters via The Star: The Knot Worldwide to acquire Zola, sources say (14 Oct 2026)', url: 'https://www.thestar.com.my/tech/tech-news/2026/10/15/the-knot-worldwide-to-acquire-zola-in-wedding-platform-union-sources-say', read: '21 Nov 2026' },
      { label: 'Business Wire: The Knot Worldwide welcomes Simply Eloped (8 Jul 2024)', url: 'https://www.businesswire.com/news/home/20240708208200/en/The-Knot-Worldwide-Welcomes-Simply-Eloped-Into-Its-Portfolio-of-Brands', read: '21 Nov 2026' },
      { label: 'Zola help: how do I use the seating chart', url: 'https://www.zola.com/faq/360038917171-how-do-i-use-the-zola-seating-chart-', read: '21 Nov 2026' },
      { label: 'Zola help: cash fund card fee', url: 'https://www.zola.com/faq/115002838152', read: '21 Nov 2026' },
      { label: 'The Knot Worldwide: California privacy notice', url: 'https://www.theknotww.com/ca-privacy', read: '21 Nov 2026' },
      { label: 'Zola on the App Store', url: 'https://apps.apple.com/us/app/id852691916', read: '21 Nov 2026' },
      { label: 'The Knot on the App Store', url: 'https://apps.apple.com/us/app/id457941553', read: '21 Nov 2026' },
      { label: 'The Knot Wedding Planner on Google Play', url: 'https://play.google.com/store/apps/details?id=com.xogrp.planner', read: '21 Nov 2026' }
    ],
    relatedSlugs: ['wedding-to-do-list', 'wedding-planner-cost', 'wedding-without-a-coordinator']
  },
  {
    slug: 'wedding-without-a-coordinator',
    host: 'weddingchecklistpdf.com',
    productId: 'timeline-template',
    title: 'Running your wedding day without a coordinator',
    h1: 'Running your wedding day without a coordinator: the hand-over that makes it work',
    directoryLabel: 'Running the day without a coordinator',
    description: 'What a day-of coordinator costs, what they actually do, and how to hand the same jobs to a friend or parent on paper so the day runs without you.',
    question: 'Can we run our wedding day without a day-of coordinator?',
    directAnswer: [
      'Yes, if someone other than the two of you has the plan in their hands. A day-of coordinator mostly does four things: keeps the timeline, meets the vendors, solves small problems before you hear about them, and makes sure the right people are paid and fed. A calm friend, a parent or your venue’s contact can do most of that with the right paper.',
      'Joy’s 2026 guide puts the national average for a day-of coordinator at about $1,800 (updated 12 August 2026). If that is not in the budget, the job does not disappear; it moves to someone you know, so give them what a coordinator would have.',
      'The hand-over should hold the timeline by the minute, every vendor’s arrival time and phone number, what is already paid and what goes in an envelope, the rain plan, and who decides when something changes. Give it to them a week before, not on the morning.'
    ],
    table: {
      caption: 'Who can take each coordinator job',
      columns: ['Job', 'What it means on the day', 'Who usually takes it without a coordinator'],
      rows: [
        ['Timeline keeper', 'Moves people to the next thing on time', 'A friend who is not in the wedding party'],
        ['Vendor contact', 'Meets each vendor on arrival and answers their questions', 'The venue’s own contact, if the venue provides one, or a parent'],
        ['Payments and tips', 'Hands over the labelled envelopes', 'A parent or a trusted friend'],
        ['Problem solver', 'Decides small changes so the couple does not have to', 'Whoever holds the packet, with a named back-up'],
        ['Set-up and pack-down', 'Puts out and collects your own items', 'Two or three friends with a written list']
      ],
      note: 'Ask your venue what its own contact does and does not do; many look after the building and their own staff, not your vendors or your timeline.'
    },
    sections: [
      {
        heading: 'What goes in the hand-over packet',
        paragraphs: [
          'Write it so someone who has never seen your plan could run the day from it.'
        ],
        bullets: [
          'The day’s timeline by the minute, from the first vendor arrival to the last pack-down.',
          'Each vendor: name, phone, arrival time, and who calls them if they are late.',
          'What is paid, what is due on the day, and which envelope it is in.',
          'The rain or heat plan, and the moment someone decides to use it.',
          'Your own items to set out and collect, and where they go after.',
          'Two names: who decides, and who is their back-up.'
        ]
      },
      {
        heading: 'Be fair to the person you ask',
        paragraphs: [
          'Running the day is work. Ask someone who is not in the wedding party, tell them early, give them the packet a week before and walk through it once. Thank them in a way that fits; some couples cover a meal or a gift. Nobody running your day should be learning the plan on the morning.'
        ]
      }
    ],
    faqs: [
      { question: 'How much does a day-of coordinator cost?', answer: 'Joy’s 2026 cost guide puts the national average for a day-of coordinator at about $1,800 (updated 12 August 2026). Prices vary widely by region and by how many hours are included.' },
      { question: 'What does a day-of coordinator do?', answer: 'Keeps the timeline, meets the vendors, solves small problems, and makes sure people are paid and fed. Most also confirm vendors in the final weeks.' },
      { question: 'Can a friend be our day-of coordinator?', answer: 'Yes, with a written hand-over: the timeline, every vendor’s contact and arrival time, what is paid and what is due, and who decides when something changes. Choose someone outside the wedding party.' },
      { question: 'Does the venue coordinator do the same job?', answer: 'Often not. Many venue contacts look after the building and their own staff. Ask yours exactly what they do on the day before you decide.' }
    ],
    plannerAdds: [
      'Builds your wedding-week list and day timeline from your own date.',
      'Prints the hand-over packet with the timeline, contacts and payments for whoever runs the day.',
      'Keeps it on paper, so nobody needs an app or an account on the day.'
    ],
    ctaLabel: 'Build the hand-over for our day →',
    seed: { focus: 'Timeline / Weekend Flow', mode: 'hard', protect: 'Family Ease', q: 'We have no coordinator. What does the person running our day need from us, and by when?' },
    verificationBoundary: 'Coordinator costs are a published average from Joy’s cost guide, linked with the date it was updated, and are not a quote. Dream Wedding is a plan and a printable packet; it is not a coordinator and no person runs your day for you.',
    sources: [
      { label: 'Joy: How much does a wedding planner cost in 2026? (updated 12 Aug 2026)', url: 'https://withjoy.com/blog/cost-of-wedding-planner/', read: '21 Nov 2026' }
    ],
    relatedSlugs: ['maid-of-honor-duties', 'wedding-planner-cost', 'courthouse-wedding']
  },
  {
    slug: 'wedding-to-do-list',
    host: 'weddingchecklistpdf.com',
    productId: 'checklist-pdf',
    title: 'Wedding to-do list, dated from your wedding date',
    h1: 'The wedding to-do list, with a real date on every task',
    directoryLabel: 'Wedding to-do list, dated',
    description: 'A wedding planning to-do list in the order it happens, with a date on every task from your own wedding date. Short engagement? The dates close up by themselves.',
    question: 'What is on a wedding to-do list, and when should each task be done?',
    directAnswer: [
      'The list itself is short: settle the budget and guest count, book the venue, then the photographer, caterer and music, then attire, flowers and stays, then invitations, then the license, final numbers and payments. The order matters more than the length, because each booking decides the next.',
      'What most lists leave out is the date. “Book the photographer 9 months before” only helps once it is a day on your calendar. Enter your wedding date below and every task gets one; if your engagement is short, the windows close up and the tasks that are already due are listed first.',
      'Print it when you have your dates, tick it on the fridge, and hand a copy to whoever is helping.'
    ],
    sections: [
      {
        heading: 'If your wedding is less than six months away',
        paragraphs: [
          'Nothing is skipped; it is compressed. Book the venue and the photographer in the same week, choose attire you can buy rather than order, and send invitations as soon as the venue is confirmed. The dated list does this for you: tasks whose window has passed move to the top as the ones to do first.'
        ]
      },
      {
        heading: 'Adding your own tasks and traditions',
        paragraphs: [
          'Every wedding has tasks no general list knows about: a second ceremony, a family tradition, a dress from abroad. Add them to the window they belong in so they are dated with the rest, and they print on the same page.'
        ]
      }
    ],
    faqs: [
      { question: 'What should be on a wedding to-do list?', answer: 'Budget and guest count first, then the venue, then photographer, caterer and music, then attire, flowers and guest stays, then invitations, then the marriage license, final headcount and payments, and finally the wedding-week confirmations.' },
      { question: 'How far ahead should we start the wedding to-do list?', answer: 'Twelve months is comfortable for a large wedding, but any length works. The dates are counted back from your wedding date, so a short engagement simply puts more tasks in the first weeks.' },
      { question: 'Is there a printable wedding to-do list?', answer: 'Yes. Enter your date, then print the dated list from your browser. The $9 Wedding Checklist PDF is the longer printable version.' }
    ],
    plannerAdds: [
      'Puts a real date on every task from your wedding date, and moves them all if the date changes.',
      'Shows what is already due first on a short engagement.',
      'Keeps your ticks and your own tasks in this browser, with no account.'
    ],
    ctaLabel: 'Date my to-do list →',
    seed: { focus: 'Timeline / Weekend Flow', mode: 'hard', q: 'What is on my wedding to-do list, and what date is each task due?' },
    verificationBoundary: 'The tasks and windows are general planning practice, not legal advice; marriage license timing varies by county, so that task says to check yours.',
    relatedSlugs: ['courthouse-wedding', 'wedding-without-a-coordinator', 'what-to-do-6-months-before-the-wedding']
  },
  {
    slug: 'nigerian-traditional-and-white-wedding',
    host: 'weddingchecklistpdf.com',
    productId: 'timeline-template',
    title: 'Nigerian traditional and white wedding: one plan for both',
    h1: 'Nigerian traditional and white wedding: one plan for both days',
    directoryLabel: 'Nigerian traditional + white wedding',
    description: 'How to plan a Nigerian traditional wedding and a white wedding together: what each day holds, what the families decide, and how to date both on one plan.',
    question: 'How do we plan a Nigerian traditional wedding and a white wedding together?',
    directAnswer: [
      'Treat them as two events with one plan. The traditional wedding is led by the families and their customs; the white wedding is the church or civil ceremony and reception most US wedding lists describe. Many couples hold them on different days, some on the same day, and each needs its own date, guest count and budget line.',
      'Start with the families, because they decide much of the traditional day. Customs differ between Yoruba, Igbo, Hausa and other families and between towns, so ask both families early which steps they expect, who leads them, and what the groom’s family is asked to bring.',
      'Then date everything back from each event. The traditional day’s tasks run from the families’ timetable; the white wedding follows the usual windows for venue, officiant, attire and invitations.'
    ],
    table: {
      caption: 'What each day usually holds',
      columns: ['', 'Traditional wedding', 'White wedding'],
      rows: [
        ['Who leads it', 'The two families, often through people chosen to speak for each side', 'The couple and their officiant'],
        ['The core of it', 'The families meet and agree; the groom’s family presents the items the bride’s family has asked for', 'The ceremony and the reception'],
        ['What the families decide', 'Which customs, the list of items, who speaks, the order of the day', 'Usually less: guest list share and any contributions'],
        ['Attire', 'Traditional dress, often chosen with the families', 'Wedding dress, suit or tuxedo'],
        ['Legal marriage', 'Ask the officiant or county clerk where you marry what makes it legal there', 'A marriage license from the county, then the ceremony']
      ],
      note: 'A general outline, not a description of any one family’s custom. Ask both families what they expect; the steps and the list differ by region and by family.'
    },
    sections: [
      {
        heading: 'What the sources describe for the traditional day',
        paragraphs: [
          'A University of Texas at Austin description of Yoruba marriage sets out an introduction, where the groom’s family introduces itself and states its intention, a proposal letter and an acceptance letter, and then the engagement, or traditional marriage, where the groom’s family brings the items on the bride’s family’s list. The items it names vary by family.',
          'Among Igbo families the traditional ceremony is often called igba nkwu, “wine carrying”. The bride price agreed between the families is often symbolic and differs by region, and families set their own terms.'
        ]
      },
      {
        heading: 'Planning both on one calendar',
        paragraphs: [
          'Most of the work is in keeping two events from competing for the same weeks.'
        ],
        bullets: [
          'Fix both dates first, and decide whether guests are invited to one event or both.',
          'Give each event its own budget line and guest count; the guest lists are often very different sizes.',
          'Ask the families for the list of items early, and note who is buying each one.',
          'Book attire for both days with fittings well apart, especially fabric ordered from abroad.',
          'Decide who speaks for each family, and give them the day’s order on paper.',
          'Get the marriage license for whichever ceremony makes the marriage legal where you are.'
        ]
      }
    ],
    faqs: [
      { question: 'Do we need two separate weddings?', answer: 'Many couples hold the traditional wedding and the white wedding on different days, and some hold both on one day. Either works; what matters is giving each its own date, guest count and budget line.' },
      { question: 'What is igba nkwu?', answer: 'The Igbo traditional marriage ceremony, often translated as “wine carrying”. The details differ by family and region, so ask both families what they expect.' },
      { question: 'Who decides the list for the traditional wedding?', answer: 'The bride’s family usually sets the list, and the groom’s family brings the items. What is on it differs by family; ask early so there is time to buy or order everything.' },
      { question: 'Is the traditional wedding a legal marriage in the US?', answer: 'In the US, a marriage is legal through a license from the county where you marry and the ceremony that follows. Ask the county clerk where you marry what they require.' }
    ],
    plannerAdds: [
      'Adds the Nigerian traditional pack to your plan, with each step sourced, alongside up to two other traditions.',
      'Dates the tasks from your real wedding date, so both events stay on one calendar.',
      'Prints the plan for the families and whoever runs each day.'
    ],
    ctaLabel: 'Plan both days together →',
    seed: { focus: 'Timeline / Weekend Flow', mode: 'hard', protect: 'Cultural Traditions,Family Ease', q: 'We are having a Nigerian traditional wedding and a white wedding. How do we plan both on one calendar?' },
    verificationBoundary: 'This page outlines traditions in general terms and links its sources; it does not describe any one family’s customs and is not legal advice. Your families are the authority on your traditional wedding, and your county clerk on the legal marriage.',
    sources: [
      { label: 'University of Texas at Austin, Africa database: Yoruba marriage', url: 'https://www.laits.utexas.edu/africa/2004/database/adejola.html', read: '21 Nov 2026' },
      { label: 'Traditional marriage in Igbo culture (reference overview)', url: 'https://en.wikipedia.org/wiki/Traditional_marriage_in_Igbo_culture', read: '21 Nov 2026' }
    ],
    relatedSlugs: ['wedding-to-do-list', 'who-pays-for-what-wedding', 'wedding-without-a-coordinator']
  },
  {
    slug: 'who-pays-for-what-wedding',
    host: 'weddingchecklistpdf.com',
    productId: 'budget-spreadsheet',
    title: 'Who pays for what in a wedding: tradition and today',
    h1: 'Who pays for what in a wedding: the traditional split, and how couples split it now',
    directoryLabel: 'Who pays for what in a wedding',
    description: 'The traditional split of wedding costs between the two families, how couples and parents usually share them now, and how to agree it before the first deposit.',
    question: 'Who pays for what in a wedding?',
    directAnswer: [
      'By tradition in the US, the bride’s family paid for the wedding and reception and the groom’s family paid for the rehearsal dinner and the honeymoon, as the Emily Post Institute describes the old division. Very few families follow that line by line now.',
      'Today it is usually shared. An AP report in August 2024, citing The Knot’s editors, said parents on average contribute slightly more than half of the budget and couples cover the rest. Many split by event or by category instead of by family: one side takes the rehearsal dinner, the other the flowers, the couple the photographer.',
      'The step that matters is to ask early and write it down: who is giving what, by when, and whether it comes with a say in the guest list.'
    ],
    table: {
      caption: 'The traditional split, as a starting point',
      columns: ['Cost', 'Traditionally paid by', 'Common today'],
      rows: [
        ['Ceremony and reception', 'Bride’s family', 'Shared by the couple and both families'],
        ['Invitations and stationery', 'Bride’s family', 'The couple'],
        ['Rehearsal dinner', 'Groom’s family', 'Either family, or the couple'],
        ['Officiant’s fee and marriage license', 'Groom’s family', 'The couple'],
        ['Honeymoon', 'Groom’s family', 'The couple, sometimes with a honeymoon fund'],
        ['Wedding party outfits', 'Each attendant', 'Each attendant, unless the couple offer']
      ],
      note: 'Traditional column from the Emily Post Institute’s description of the old division. “Common today” is a summary of current practice, not a survey figure; your families will have their own version.'
    },
    sections: [
      {
        heading: 'How to have the money conversation',
        paragraphs: [
          'Have it before you book anything. Ask each family separately what they would like to give, in an amount or as a category, and when; then put it in one place so everyone sees the same numbers.'
        ],
        bullets: [
          'Ask for a figure or a category, not “help”.',
          'Agree the due dates, since deposits fall months before the day.',
          'Say plainly whether a gift comes with a say in the guest list or the venue.',
          'Keep the couple’s own share as the line that absorbs surprises.'
        ]
      }
    ],
    faqs: [
      { question: 'What does the bride’s family traditionally pay for?', answer: 'By the old division described by the Emily Post Institute, the ceremony and reception and the invitations. Most families now share these costs.' },
      { question: 'What does the groom’s family traditionally pay for?', answer: 'The rehearsal dinner, the officiant’s fee, the marriage license and the honeymoon, by the old division. Today these are often taken by either family or the couple.' },
      { question: 'How much do parents usually contribute?', answer: 'An AP report in August 2024, citing The Knot’s editors, said parents on average contribute slightly more than half of the wedding budget. Every family differs.' }
    ],
    plannerAdds: [
      'Records who is giving what and by when, against your own budget.',
      'Dates every deposit and final payment from your wedding date.',
      'Shows the couple’s own share, the line that takes the surprises.'
    ],
    ctaLabel: 'Plan who pays for what →',
    seed: { focus: 'Budget + Tradeoffs', mode: 'flexible', budgetmode: 'unknown', protect: 'Family Ease', q: 'Our families want to help pay. How do we split the costs and keep track of who gives what?' },
    verificationBoundary: 'The traditional split is the Emily Post Institute’s description of old etiquette; the parents’ share is an average reported by AP in August 2024. Neither is advice on your family’s arrangement.',
    sources: [
      { label: 'Emily Post Institute: Wedding expenses, who pays for what', url: 'https://emilypost.com/advice/wedding-expenses-who-pays-for-what', read: '21 Nov 2026' },
      { label: 'AP via ABC News: Who pays for the wedding? Traditional etiquette doesn’t always hold (Aug 2024)', url: 'https://abcnews.go.com/Business/wireStory/pays-wedding-traditional-etiquette-hold-113017271', read: '21 Nov 2026' }
    ],
    relatedSlugs: ['wedding-budget-tradeoffs', 'wedding-cost-per-guest', 'wedding-planner-cost']
  },
  {
    slug: 'wedding-planner-cost',
    host: 'weddingchecklistpdf.com',
    productId: 'checklist-pdf',
    title: 'Wedding planner cost in 2026, and what you get for it',
    h1: 'What a wedding planner costs in 2026, and what you get for the money',
    directoryLabel: 'What a wedding planner costs',
    description: 'Wedding planner and day-of coordinator costs in 2026 from a dated published guide, what each level of service includes, and what to do if it is not in the budget.',
    question: 'How much does a wedding planner cost?',
    directAnswer: [
      'Joy’s 2026 cost guide (updated 12 August 2026) puts full-service planners at $3,500 to $15,000 or more, with a national average near $5,500; partial planning at around $3,200; and a day-of coordinator at around $1,800. Some full-service and luxury planners charge 10% to 20% of the total budget instead of a flat fee.',
      'The price follows the hours. Full service runs from the first venue search to the last vendor tip; partial planning picks up a few months out; a day-of coordinator mostly confirms vendors in the last weeks and runs the day itself.',
      'If none of that fits the budget, the work still has to be done by someone. A dated plan covers the months before; a written hand-over lets a friend or parent cover the day.'
    ],
    table: {
      caption: 'Planner costs by level of service (Joy, updated 12 August 2026)',
      columns: ['Level', 'Published average', 'What it usually covers'],
      rows: [
        ['Full service', 'About $5,500 (range $3,500 to $15,000+)', 'Budget, venue and vendor search, design, contracts, the whole timeline and the day'],
        ['Partial planning', 'About $3,200', 'Takes over a few months out: vendor gaps, timeline, confirmations and the day'],
        ['Day-of coordination', 'About $1,800', 'Confirms vendors in the final weeks and runs the day'],
        ['Percentage of budget', '10% to 20% of the total, where charged', 'Usually full-service or luxury planning']
      ],
      note: 'Published national averages from Joy’s cost guide, not quotes. Prices vary by region, season and the hours included.'
    },
    sections: [
      {
        heading: 'What to ask before you hire one',
        paragraphs: [
          'The fee only means something next to the hours and the list of what is included.'
        ],
        bullets: [
          'How many hours on the day, and is there an overtime rate?',
          'From what date do you start, and how many meetings are included?',
          'Do you take commission or referral fees from vendors you recommend?',
          'Who comes on the day: you, or an assistant?',
          'What happens if you are ill on the day?'
        ]
      },
      {
        heading: 'Doing it yourselves',
        paragraphs: [
          'Many couples plan without one. A planner’s real value is the system and the person on the day. You can copy the system: a plan with a date on every task, a payments schedule, a wedding-week sheet and a hand-over packet for whoever runs the day. That is what Dream Wedding gives you, with no planner and no planner’s fee.'
        ]
      }
    ],
    faqs: [
      { question: 'How much does a wedding planner cost in 2026?', answer: 'Joy’s 2026 guide, updated 12 August 2026, puts the national average near $5,500 for full service, about $3,200 for partial planning and about $1,800 for a day-of coordinator.' },
      { question: 'Do wedding planners charge a percentage?', answer: 'Some full-service and luxury planners charge 10% to 20% of the total wedding budget, according to the same guide. Others charge a flat fee or by the hour.' },
      { question: 'Is a wedding planner worth it?', answer: 'It depends on your time, the size of the wedding and how many vendors you are managing. If the fee does not fit, a dated plan and a written hand-over for the day cover most of what a planner organises.' }
    ],
    plannerAdds: [
      'A plan with a date on every task, from your wedding date.',
      'Payments and the final-payment schedule, dated to your day.',
      'A printable hand-over packet for the friend or parent running the day.'
    ],
    ctaLabel: 'Open the plan without the planner’s fee →',
    seed: { focus: 'I am overwhelmed', mode: 'discovery', budgetmode: 'unknown', q: 'We cannot afford a planner. What does a planner do that we now need to cover ourselves?' },
    verificationBoundary: 'Planner prices are published averages from Joy’s 2026 cost guide, linked with its update date, and are not quotes. Dream Wedding is a plan and printable files; no person plans or runs your wedding for you.',
    sources: [
      { label: 'Joy: How much does a wedding planner cost in 2026? (updated 12 Aug 2026)', url: 'https://withjoy.com/blog/cost-of-wedding-planner/', read: '21 Nov 2026' }
    ],
    relatedSlugs: ['wedding-without-a-coordinator', 'who-pays-for-what-wedding', 'zola-vs-the-knot']
  }
];

export function landingBySlug(slug: string) {
  return plannerLandings.find((landing) => landing.slug === slug);
}
