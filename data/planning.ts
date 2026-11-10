import { money } from '@/lib/format';
import { budgetPlan } from '@/lib/budget-plan';
import { rankVenueTypes, type VenueType } from '@/lib/venue-fit';

export type Confidence = 'High' | 'Medium' | 'Low' | 'Unknown';
export type SourceKind = 'user_input' | 'seeded_benchmark' | 'curated_example' | 'llm_inference' | 'uploaded_inspiration' | 'description_input' | 'needs_research';
export type ConstraintMode = 'hard' | 'flexible' | 'discovery' | '';
export type PlannerBucket = 'Full concept' | 'Venue + Lodging' | 'Budget + Tradeoffs' | 'Design Direction' | 'Florals / Decor / Rentals' | 'Fashion / Beauty' | 'Food / Beverage' | 'Photo / Video / Moments' | 'Guest Experience / Hospitality' | 'Timeline / Weekend Flow' | 'Vendor Team / Inquiry Builder' | 'Risk / Reality Checks' | 'I am overwhelmed';

export interface TraceLabel {
  label: string;
  source: SourceKind;
  confidence: Confidence;
  needsVerification: boolean;
}

export interface WeddingPlan {
  stage: string;
  constraintMode: ConstraintMode;
  locations: string;
  backupLocations: string;
  locationFlexibility: string;
  destinationLocal: string;
  travelTolerance: string;
  guestCount: string;
  /** The wedding date, yyyy-mm-dd, or '' until the couple enters it. */
  weddingDate: string;
  season: string;
  venueTypes: string[];
  fullBuyout: string;
  onsiteLodging: string;
  onsiteSleepCount: string;
  nearbyLodgingOk: string;
  multiDayEvents: string[];
  outdoorNeeds: string;
  rainBackup: string;
  curfewFlexibility: string;
  accessibilityNeeds: string;
  outsideCatering: string;
  outsideBar: string;
  vendorFreedom: string;
  culturalFoodNeeds: string;
  productionFreedom: string;
  budgetMode: string;
  budgetTarget: string;
  hardCeiling: string;
  venueBudget: string;
  floralDecorBudget: string;
  photoVideoBudget: string;
  fashionBudget: string;
  hospitalityBudget: string;
  ownVibeWords: string;
  inspirationNotes: string;
  colorsLoved: string;
  colorsAvoided: string;
  makeItFeelLike: string;
  avoidFeelingLike: string;
  feelings: string[];
  settings: string[];
  formality: string[];
  florals: string[];
  food: string[];
  photos: string[];
  avoids: string[];
  priorities: string[];
  saveAreas: string;
  noCompromiseAreas: string;
  biggestFear: string;
  fixedItems: string;
  flexibleItems: string;
  unknownItems: string;
  nextDecision: string;
  constraints: string;
  recommendationFocus: PlannerBucket;
  recommendationQuestion: string;
  recommendationResult: PlannerRecommendation | null;
  selectedTrends: string[];
  selectedTemplate: string;
  selectedVenueIds: string[];
  selectedVendorCategories: string[];
  generatedAt: string;
  inspirationScopeNotes: string;
  /** Set when the AI draft step filled the plan; shown as an "AI-drafted" label everywhere. */
  aiDraft: AiDraftRecord | null;
}

export interface AiDraftRecord {
  at: string;
  description: string;
  fields: string[];
  notes: string[];
  /** false when the no-AI rules reader filled it (filledBy 'rules'); missing on older plans = AI. */
  byAi?: boolean;
}

export interface PlannerRecommendation {
  plannerRead: string;
  bestFitDirections: string[];
  constraintConflicts: string[];
  budgetImplications: string[];
  vendorQuestions: string[];
  nextDecisionChecklist: string[];
  confidence: Confidence;
}

export const emptyPlan: WeddingPlan = {
  stage: '',
  constraintMode: '',
  locations: '',
  backupLocations: '',
  locationFlexibility: '',
  destinationLocal: '',
  travelTolerance: '',
  guestCount: '',
  weddingDate: '',
  season: '',
  venueTypes: [],
  fullBuyout: '',
  onsiteLodging: '',
  onsiteSleepCount: '',
  nearbyLodgingOk: '',
  multiDayEvents: [],
  outdoorNeeds: '',
  rainBackup: '',
  curfewFlexibility: '',
  accessibilityNeeds: '',
  outsideCatering: '',
  outsideBar: '',
  vendorFreedom: '',
  culturalFoodNeeds: '',
  productionFreedom: '',
  budgetMode: 'unknown',
  budgetTarget: '',
  hardCeiling: '',
  venueBudget: '',
  floralDecorBudget: '',
  photoVideoBudget: '',
  fashionBudget: '',
  hospitalityBudget: '',
  ownVibeWords: '',
  inspirationNotes: '',
  colorsLoved: '',
  colorsAvoided: '',
  makeItFeelLike: '',
  avoidFeelingLike: '',
  feelings: [],
  settings: [],
  formality: [],
  florals: [],
  food: [],
  photos: [],
  avoids: [],
  priorities: [],
  saveAreas: '',
  noCompromiseAreas: '',
  biggestFear: '',
  fixedItems: '',
  flexibleItems: '',
  unknownItems: '',
  nextDecision: '',
  constraints: '',
  recommendationFocus: 'Full concept',
  recommendationQuestion: '',
  recommendationResult: null,
  selectedTrends: [],
  selectedTemplate: '',
  selectedVenueIds: [],
  selectedVendorCategories: [],
  generatedAt: '',
  inspirationScopeNotes: '',
  aiDraft: null
};

export const planningStages = [
  'I just got engaged and have no idea where to start.',
  'I have hard requirements and need the system to respect them.',
  'I know the vibe but not the budget.',
  'I know the budget but not the venue.',
  'I have a venue but need design direction.',
  'I have vendors but need a complete plan.',
  'I am dreaming first and will make it realistic later.'
];

export const plannerBuckets: PlannerBucket[] = ['Full concept', 'Venue + Lodging', 'Budget + Tradeoffs', 'Design Direction', 'Florals / Decor / Rentals', 'Fashion / Beauty', 'Food / Beverage', 'Photo / Video / Moments', 'Guest Experience / Hospitality', 'Timeline / Weekend Flow', 'Vendor Team / Inquiry Builder', 'Risk / Reality Checks', 'I am overwhelmed'];

export const plannerBucketDescriptions: Record<PlannerBucket, string> = {
  'Full concept': 'Overall concept, cohesion, and what to prioritize first.',
  'Venue + Lodging': 'Venue category, buyout, sleeping capacity, access, rain plan, and guest movement.',
  'Budget + Tradeoffs': 'Budget pressure, hidden costs, savings that do not damage protected priorities.',
  'Design Direction': 'Colors, mood, formality, vocabulary, and what to use or avoid.',
  'Florals / Decor / Rentals': 'Bouquets, ceremony, reception, candles, linen, lighting, tenting, and rental implications.',
  'Fashion / Beauty': 'Attire, dress code, wedding party, beauty timing, terrain/weather fit.',
  'Food / Beverage': 'Catering style, bar, late night, cultural food, outside catering, staffing/rentals.',
  'Photo / Video / Moments': 'Photo priorities, golden hour, getting-ready, detail shots, social/content moments.',
  'Guest Experience / Hospitality': 'Travel, lodging, shuttles, welcome party, accessibility, older guests, kids.',
  'Timeline / Weekend Flow': 'Multi-day flow, ceremony timing, reception pacing, load-in/load-out, rain timing.',
  'Vendor Team / Inquiry Builder': 'Vendor categories, questions, scope, and what to ask before deposits.',
  'Risk / Reality Checks': 'Weather, curfew, access, permits, budget, lodging, vendor, and family/cultural risks.',
  'I am overwhelmed': 'A decision-first triage of what matters now and what can wait.'
};

export type { VenueType };

export const priorityOptions = ['Venue privacy', 'Full buyout', 'Guest lodging', 'Food + Bar', 'Photography', 'Florals', 'Guest Comfort', 'Family Ease', 'Party Energy', 'Budget Control', 'Travel/Lodging', 'Cultural Traditions', 'Fashion', 'Rain Plan', 'Accessibility'];
export const venueTypeOptions = ['villa / estate', 'boutique resort / borgo', 'hotel / ballroom', 'beach club', 'vineyard', 'castle / historic property', 'restaurant buyout', 'private home / backyard', 'tent / blank canvas', 'garden / outdoor estate', 'museum / gallery', 'not sure'];
export const multiDayOptions = ['welcome party onsite', 'ceremony onsite', 'reception onsite', 'after-party onsite', 'brunch onsite', 'multi-day access required'];

export const visionQuestions = {
  feeling: ['calm and intimate', 'editorial and dramatic', 'warm dinner party', 'classic and elegant', 'coastal and relaxed', 'garden romantic', 'modern and clean', 'joyful party energy', 'cultural/family-centered', 'not sure yet'],
  setting: ['garden/estate', 'hotel ballroom', 'coastal venue', 'restaurant/private dining', 'museum/gallery', 'vineyard', 'destination resort', 'backyard/private home', 'blank canvas', 'not sure yet'],
  formality: ['black tie', 'formal', 'cocktail', 'elevated relaxed', 'weekend resort', 'family-traditional', 'not sure yet'],
  florals: ['lush garden', 'minimal sculptural', 'all white/ivory', 'colorful seasonal', 'wild/textural', 'orchids/tropical', 'candlelight over flowers', 'not sure yet'],
  food: ['restaurant-quality dinner', 'family-style warmth', 'cocktail-party grazing', 'multi-course formal', 'cultural food traditions', 'late-night bites', 'not sure yet'],
  photos: ['editorial magazine', 'documentary/candid', 'romantic film style', 'bright and clean', 'flash party photos', 'timeless portraits', 'not sure yet'],
  avoid: ['rustic barn', 'cheesy signage', 'overly trendy', 'stiff ballroom', 'too much pink', 'boho macrame', 'cold/minimal', 'chaotic party', 'not sure yet']
};

export const budgetModes = [
  { id: 'unknown', title: 'I have no idea what weddings cost', copy: 'Teach me what drives price before I commit to a number.' },
  { id: 'hard', title: 'I have a hard budget', copy: 'Warn me when a choice breaks the number.' },
  { id: 'range', title: 'I have a flexible range', copy: 'Keep me inside a comfort zone and show tradeoffs.' },
  { id: 'dream', title: 'I want to dream first', copy: 'Let me explore, but label everything as estimated and unverified.' }
];

export const inspirationTemplates = [
  { name: 'European Villa Weekend', adopt: ['European destination energy', 'waterfront portraits', 'formal dinner-party pacing'], doNotAdopt: ['location', 'budget', 'guest count'] },
  { name: 'Charleston Garden Coastal', adopt: ['garden/coastal setting', 'guest comfort', 'warm hospitality'], doNotAdopt: ['vendor pricing without verification'] },
  { name: 'Modern City Hotel', adopt: ['logistics simplicity', 'black-tie polish', 'weather-safe venue'], doNotAdopt: ['ballroom stiffness'] },
  { name: 'Backyard Luxury', adopt: ['intimacy', 'family meaning', 'custom design'], doNotAdopt: ['hidden rental complexity'] },
  { name: 'Cultural Family Weekend', adopt: ['family rituals', 'multi-event structure', 'guest care'], doNotAdopt: ['one-size-fits-all timeline'] },
  { name: 'Restaurant Wedding', adopt: ['food-first experience', 'lower decor pressure', 'guest warmth'], doNotAdopt: ['late-night party assumptions'] }
];

// Venue TYPES to ask about, never named venues. Fit is worked out per plan in
// lib/venue-fit.ts (rankVenueTypes); nothing here says a type suits anyone. Guest
// ranges are typical for the type and every card tells her to check the venue's own.
// The first three ids predate 10 Nov 2026 and stay so saved shortlists keep working.
export const venueExamples: VenueType[] = [
  { id: 'public-park-garden', name: 'Park, public garden or pavilion', setting: 'outdoor', minGuests: 20, maxGuests: 200, destination: false, costLevel: 1, goodFor: 'An outdoor ceremony and reception with room to bring your own food and music.', ask: ['permit and booking rules', 'what cover there is if it rains', 'power for music and food', 'the noise cut-off time', 'restrooms and parking', 'alcohol rules'] },
  { id: 'private-home-backyard', name: 'Backyard or private home', setting: 'outdoor', minGuests: 10, maxGuests: 150, destination: false, costLevel: 1, goodFor: 'A personal setting where you choose every vendor.', ask: ['tent, tables and chairs to rent', 'restrooms for your guest count', 'power for music and food', 'parking and neighbours', 'event insurance', 'rain plan'] },
  { id: 'farm-barn-ranch', name: 'Farm, ranch or barn', setting: 'both', minGuests: 50, maxGuests: 250, destination: false, costLevel: 2, goodFor: 'Outdoor space with a roof nearby if the weather turns.', ask: ['what is included (tables, chairs, restrooms)', 'whether you can bring your own caterer and bar', 'heating or cooling in the barn', 'the noise cut-off time', 'parking and how guests get there'] },
  { id: 'charleston-garden-estate-example', name: 'Garden or historic estate', setting: 'both', minGuests: 60, maxGuests: 150, destination: false, costLevel: 3, goodFor: 'A garden ceremony with indoor rooms for dinner or rain.', ask: ['site fee and what it covers', 'food and drink minimum', 'rain plan', 'which vendors you must use', 'service charge and tax', 'the noise cut-off time'] },
  { id: 'tent-blank-canvas', name: 'Tent on open land', setting: 'outdoor', minGuests: 50, maxGuests: 300, destination: false, costLevel: 3, goodFor: 'Any view you like, with everything brought in.', ask: ['tent, floor, lighting and power to rent', 'restroom trailers', 'kitchen space for the caterer', 'delivery, set-up and take-down days', 'wind and rain plan'] },
  { id: 'winery-brewery', name: 'Winery, brewery or distillery', setting: 'both', minGuests: 40, maxGuests: 200, destination: false, costLevel: 2, goodFor: 'A setting with its own character and drinks on site.', ask: ['whether you must buy their drinks', 'whether you can bring your own caterer', 'indoor space if it rains', 'closing time', 'what is included'] },
  { id: 'event-hall-loft', name: 'Event hall, loft or community hall', setting: 'indoor', minGuests: 50, maxGuests: 300, destination: false, costLevel: 1, goodFor: 'A weather-proof room you can decorate your own way.', ask: ['hire hours and overtime', 'whether you can bring your own caterer and bar', 'tables and chairs included', 'the noise cut-off time', 'parking'] },
  { id: 'city-hotel-ballroom-example', name: 'Hotel ballroom', setting: 'indoor', minGuests: 80, maxGuests: 250, destination: false, costLevel: 3, goodFor: 'Rooms for guests and food, drink and staff in one contract.', ask: ['food and drink minimum', 'room-block terms', 'which vendors you must use', 'service charge', 'overtime', 'ceremony fee'] },
  { id: 'restaurant-private-dining-example', name: 'Restaurant buyout or private dining', setting: 'indoor', minGuests: 20, maxGuests: 100, destination: false, costLevel: 2, goodFor: 'A food-first wedding with little to rent or decorate.', ask: ['buyout minimum', 'drinks package', 'music limits', 'private room fee', 'cake and dessert rules'] },
  { id: 'destination-estate-buyout', name: 'Private villa or estate buyout', setting: 'both', minGuests: 30, maxGuests: 120, destination: true, costLevel: 3, goodFor: 'Privacy and a several-day stay in one place.', ask: ['whether the whole property is yours', 'how many guests may sleep there', 'whether you can bring your own caterer', 'kitchen', 'music cut-off time', 'rain plan', 'how guests get there'] },
  { id: 'boutique-resort-borgo-buyout', name: 'Small resort or inn buyout', setting: 'both', minGuests: 30, maxGuests: 150, destination: true, costLevel: 3, goodFor: 'Guests sleep on site and the staff are already there.', ask: ['buyout terms', 'number of rooms', 'minimum nights', 'their catering rules', 'which vendors you must use', 'tax and service', 'indoor backup space'] },
  { id: 'villa-hotel-block-hybrid', name: 'Villa plus nearby hotel rooms', setting: 'both', minGuests: 30, maxGuests: 150, destination: true, costLevel: 3, goodFor: 'A villa that cannot sleep everyone, with rooms held close by.', ask: ['room-block terms', 'shuttle routes and late-night transport', 'who sleeps at the villa', 'what guests are told'] }
];

export const vendorCategories = [
  { name: 'Planner / Coordinator', questions: ['Do we need full planning, partial planning, or month-of?', 'Who owns budget tracking and vendor management?', 'Will they manage family logistics, transportation, and the timeline?'] },
  { name: 'Venue / Lodging', questions: ['Is full property buyout available?', 'How many guests can legally and comfortably sleep onsite?', 'What rain, curfew, insurance, accessibility, and transportation terms apply?'] },
  { name: 'Photographer / Video', questions: ['Editorial, documentary, film, bright, or flash-party style?', 'How many hours and do we need a second shooter?', 'What travel, overtime, and delivery terms apply?'] },
  { name: 'Florist / Designer', questions: ['Is there a minimum spend?', 'What installations require labor, strike, or rigging?', 'Can ceremony florals be repurposed?'] },
  { name: 'Catering / Bar', questions: ['Is outside catering or bar allowed?', 'What are tax, service charge, staff, rentals, kitchen, and vendor meals?', 'What dietary and cultural needs must be handled?'] },
  { name: 'Music / Entertainment', questions: ['Band, DJ, ceremony musicians, after-party?', 'Noise cutoff and power needs?', 'Emcee role and timeline coordination?'] },
  { name: 'Rentals / Lighting / Production', questions: ['Tables, chairs, linens, china, glassware, flatware?', 'Tent, generator, dance floor, heaters/fans?', 'Delivery, setup, strike, rigging, and damage waiver?'] },
  { name: 'Fashion / Beauty', questions: ['What must be sourced vs custom?', 'What are alteration, shipping, and return deadlines?', 'Will terrain/weather affect dress, shoes, hair, or makeup?'] },
  { name: 'Stationery / Paper Goods', questions: ['Menus, place cards, escort display, signage, invitation suite?', 'Who owns print deadlines and day-of installation?', 'What must match the tablescape or florals?'] },
  { name: 'Transportation / Hospitality', questions: ['Are shuttles needed?', 'How do guests move after late-night events?', 'What airport, hotel block, welcome bag, and accessibility support is required?'] }
];

export const hiddenFeeChecklist = ['tax', 'service charge', 'gratuity', 'ceremony fee', 'cake cutting', 'corkage', 'bar minimum', 'security', 'valet', 'shuttle', 'coat check', 'restroom trailers', 'generator', 'tenting', 'flooring', 'lighting', 'dance floor', 'tables/chairs', 'linens', 'china/glassware/flatware', 'vendor meals', 'overtime', 'setup/strike labor', 'delivery fees', 'travel fees', 'lodging for vendors', 'rain plan costs', 'flame permits', 'rigging approval', 'damage waiver', 'linen steaming', 'rental minimums'];

export const inspirationCategories = [
  'tablescape', 'bouquet', 'centerpieces', 'ceremony arch', 'reception room', 'flower girl dresses', 'bridesmaid dresses', 'bridal fashion', 'stationery', 'cake', 'lighting/chandeliers', 'chairs/linens/rentals', 'welcome party', 'guest hospitality', 'food and beverage', 'photo/video moments', 'timeline/weekend flow', 'custom idea'
];

export const scopeComponents = [
  { category: 'florals/decor/rentals', components: ['bouquets', 'ceremony florals', 'reception florals', 'centerpieces', 'candles', 'linens', 'chairs', 'tableware', 'installations', 'lighting', 'tenting'], vendors: ['florist', 'event designer', 'rental company', 'lighting/production'], warnings: ['guest count/table count drives cost', 'installations add labor/strike', 'outdoor settings need wind/heat/rain checks'] },
  { category: 'fashion/beauty', components: ['bride attire', 'groom attire', 'wedding party', 'flower girl/ring bearer', 'dress code', 'hair/makeup', 'weather/terrain fit'], vendors: ['bridal salon', 'tailor', 'beauty team', 'stylist'], warnings: ['shipping/alterations deadlines', 'terrain can break shoe choices', 'heat/wind affects hair and fabric'] },
  { category: 'food/beverage', components: ['catering style', 'bar', 'welcome party food', 'late-night food', 'cake/dessert', 'dietary/cultural needs', 'staffing/rentals'], vendors: ['caterer', 'bar service', 'cake/dessert', 'rental company'], warnings: ['outside catering needs kitchen/staffing/rentals', 'service charge/tax may be large', 'late-night food affects timeline'] },
  { category: 'photo/video/moments', components: ['shot priorities', 'golden hour', 'getting-ready space', 'detail shots', 'first look', 'family portraits', 'content capture'], vendors: ['photographer', 'videographer', 'content creator'], warnings: ['light and timeline drive results', 'private estates may need room styling', 'must protect priority moments'] },
  { category: 'guest experience/hospitality', components: ['travel', 'hotel blocks', 'transport', 'welcome bags', 'welcome party', 'accessibility', 'older guests', 'kids', 'weather comfort'], vendors: ['planner', 'hotel block manager', 'transportation', 'stationery/signage'], warnings: ['remote venues need transport', 'lodging gaps create friction', 'heat/cold/rain affect guest comfort'] },
  { category: 'timeline/weekend flow', components: ['wedding day timeline', 'ceremony timing', 'cocktail hour', 'reception pacing', 'after-party', 'welcome dinner', 'brunch', 'vendor load-in/out'], vendors: ['planner', 'venue', 'catering', 'photo/video', 'entertainment'], warnings: ['beautiful ideas fail if load-in/curfew/transport timing is impossible'] }
];

export function protectedPriorities(plan: WeddingPlan) {
  return plan.priorities.slice(0, 3);
}

export function selectedVenues(plan: WeddingPlan) {
  return venueExamples.filter(venue => plan.selectedVenueIds.includes(venue.id));
}

export function selectedVendors(plan: WeddingPlan) {
  return vendorCategories.filter(vendor => plan.selectedVendorCategories.includes(vendor.name));
}

// The readiness rubric is published at /readiness-score, so it lives in one place
// that both the planner and that page import. Re-exported here so every existing
// caller keeps working.
export { derivePlanReadiness, readinessBreakdown, readinessBand, readinessChecks } from '@/lib/readiness';

/** The plan in one plain line: only what she has actually answered. */
export function planSummary(plan: WeddingPlan) {
  const budget = budgetPlan(plan);
  const items = [
    plan.locations.trim(),
    plan.guestCount.trim() ? `${plan.guestCount.trim()} guests` : '',
    plan.season.trim(),
    budget.budget ? `${budget.hard ? 'hard budget' : 'budget'} ${money(Math.min(budget.budget, budget.limit))}` : budget.words,
    plan.fullBuyout === 'required' ? 'whole venue to ourselves' : '',
    plan.onsiteLodging === 'required' ? `guests sleep on site${plan.onsiteSleepCount ? ` (${plan.onsiteSleepCount})` : ''}` : '',
    plan.outsideCatering === 'required' ? 'our own caterer' : '',
    protectedPriorities(plan).length ? `most important: ${protectedPriorities(plan).join(', ')}` : ''
  ].filter(Boolean);
  return items.length ? items.join(' · ') : 'Nothing filled in yet.';
}

/**
 * The budget read back in plain sentences: her number, the per-guest arithmetic,
 * what her own numbers do to it, what to leave alone and where cutting starts.
 * Rendered by the planner's budget step, the packet and /methodology.
 */
export function budgetReality(plan: WeddingPlan) {
  const b = budgetPlan(plan);
  const top = protectedPriorities(plan);
  if (!b.budget) return b.words ? `You said "${b.words}". Add a number and it is split across the wedding here.` : 'Add your budget and guest count and they are worked through here.';
  const parts = [`${b.hard ? 'Hard budget' : 'Budget'}: ${money(Math.min(b.budget, b.limit))}.`];
  if (b.perGuest) parts.push(`Across ${b.guests} guests that is ${money(b.perGuest)} a guest for everything: venue, food, drink, music, photos, flowers and clothes.`);
  parts.push(...b.warnings);
  if (top.length) parts.push(`Leave these alone: ${top.join(', ')}. Start any cutting with ${plan.saveAreas.trim() || 'favours, printed extras, late-night add-ons and anything guests would not miss'}.`);
  else parts.push('Pick the three things that matter most and the split leans toward them.');
  return parts.join(' ');
}

/** One line above the venue cards saying what the sort used. */
export function venueMatchSummary(plan: WeddingPlan) {
  const { basis, hidden } = rankVenueTypes(plan, venueExamples);
  if (!basis.length) return 'Add your guest count and where you want to marry, and these sort themselves to fit.';
  return `Sorted for: ${basis.join(' · ')}.${hidden.length ? ` ${hidden.length} venue type${hidden.length === 1 ? '' : 's'} left out because ${hidden.length === 1 ? 'it does' : 'they do'} not fit.` : ''}`;
}

export function designSummary(plan: WeddingPlan) {
  const use = [plan.ownVibeWords, plan.makeItFeelLike, plan.colorsLoved, ...plan.feelings, ...plan.formality, ...plan.florals].filter(item => item && item !== 'not sure yet');
  const avoid = [plan.colorsAvoided, plan.avoidFeelingLike, ...plan.avoids].filter(item => item && item !== 'not sure yet');
  return { use, avoid };
}

/** Things to check that follow from her own answers. Empty when none apply. */
export function riskChecklist(plan: WeddingPlan) {
  const { wants } = rankVenueTypes(plan, venueExamples);
  const risks: string[] = [];
  if (wants.outdoor) risks.push('Outdoor: agree the rain plan, and who pays for a tent, before you sign.');
  if (wants.liveMusic) risks.push('Music: get the noise cut-off time and the power supply in writing.');
  if (plan.fullBuyout === 'required') risks.push('Whole venue to yourselves: get the buyout terms and minimum nights in writing.');
  if (plan.outsideCatering === 'required') risks.push('Your own caterer: confirm the venue allows it, and what kitchen, power and insurance they need.');
  if (plan.onsiteSleepCount || plan.onsiteLodging === 'required') risks.push('Guests sleeping on site: ask for the room and bed count, not a total.');
  if (plan.curfewFlexibility) risks.push('Late night: ask when music must stop and when guests must leave.');
  if (plan.accessibilityNeeds) risks.push('Access: walk the route from parking to seat to restroom for anyone who needs step-free access.');
  return risks;
}
