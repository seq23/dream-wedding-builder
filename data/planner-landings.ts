// The six planner landing pages.
//
// Deliberately six. A large programmatic batch of near-identical pages is the
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

export interface PlannerLanding {
  slug: string;
  host: string;
  /** The paid product this page's cluster belongs to, for the honest commerce CTA. */
  productId: string;
  title: string;
  h1: string;
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
  ctaLabel: string;
  seed: PlannerSeed;
  verificationBoundary: string;
  relatedSlugs: string[];
}

export const plannerLandings: PlannerLanding[] = [
  {
    slug: 'wedding-cost-per-guest',
    host: 'weddingbudgetspreadsheet.com',
    productId: 'budget-spreadsheet',
    title: 'Wedding cost per guest: what 50, 80, 100, and 150 guests actually cost',
    h1: 'What a wedding costs per guest — and why guest count is the only number that changes everything',
    description: 'Guest count is the single largest driver of wedding cost. Published planning benchmarks put the all-in figure at roughly $235–$400 per guest. Here is what that means at 50, 80, 100, 150, and 200 guests, which costs actually scale per head, and which do not.',
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
    ctaLabel: 'Run this against your own guest count →',
    seed: { guests: '80', focus: 'Budget + Tradeoffs', budgetmode: 'unknown', q: 'What does my wedding cost at my guest count, and what actually changes if I cut the list?' },
    verificationBoundary: 'Per-guest figures on this page are published planning benchmarks, not quotes. No live vendor pricing or availability is claimed anywhere on this site. Verify every number against a written quote before signing or paying a deposit.',
    relatedSlugs: ['wedding-budget-tradeoffs', 'wedding-planning-reality-check', 'micro-wedding-planning']
  },
  {
    slug: 'what-to-do-6-months-before-the-wedding',
    host: 'weddingtimelinetemplate.com',
    productId: 'timeline-template',
    title: 'What to do 6 months before the wedding (and at 12, 9, 3, and 1)',
    h1: 'What to do 6 months before the wedding',
    description: 'The six-month mark is where a wedding plan either converts into bookings or quietly stalls. Here is exactly what belongs at 12, 9, 6, 3, and 1 month out, what is genuinely late, and what most checklists put in the wrong place.',
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
    host: 'weddingbudgetspreadsheet.com',
    productId: 'budget-spreadsheet',
    title: 'Wedding budget tradeoffs: what a better venue actually costs you elsewhere',
    h1: 'Can I afford a better venue if I cut the open bar?',
    description: 'A structured answer to the wedding tradeoff question nobody answers well: what an upgrade in one category actually costs you in the others, which swaps are real, and which ones quietly cost more than they save.',
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
    description: 'A backyard wedding removes the venue fee and adds a venue\'s worth of infrastructure. Here is the full list of what a house has to supply, what it usually cannot, and when a backyard wedding is genuinely cheaper.',
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
    title: 'Micro wedding and courthouse wedding planning: what changes below 50 guests',
    h1: 'Micro weddings and courthouse weddings — what actually changes below 50 guests',
    description: 'Below about 50 guests a wedding stops being a smaller version of a big wedding and becomes a different event with different constraints. What changes, what stops mattering, and where the small-wedding budget actually goes.',
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
    description: 'An honest first step for couples with no reference point: why published averages mislead, the five numbers that decide everything else, and what to settle before talking to a single vendor.',
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
  }
];

export function landingBySlug(slug: string) {
  return plannerLandings.find((landing) => landing.slug === slug);
}
