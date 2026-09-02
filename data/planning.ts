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

export interface VenueCandidate {
  id: string;
  name: string;
  location: string;
  venueType: string;
  capacity: string;
  estimatedAllIn: string;
  budgetFit: 'Strong fit' | 'Possible fit' | 'Stretch fit' | 'Likely not realistic' | 'Needs verification';
  styleFit: string[];
  includes: string[];
  verify: string[];
  confidence: Confidence;
  sourceLabel: string;
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
  inspirationScopeNotes: ''
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

export const venueExamples: VenueCandidate[] = [
  { id: 'destination-estate-buyout', name: 'Private villa / estate buyout', location: 'Italy, France, Spain, Georgia, coastal or estate markets', venueType: 'Private estate / villa', capacity: 'Often 30–120 event guests; sleeping capacity varies and must be verified', estimatedAllIn: 'Highly variable; buyout, lodging, rentals, catering, staffing, transport, and production must be quoted', budgetFit: 'Needs verification', styleFit: ['destination resort', 'garden/estate', 'weekend resort', 'classic and elegant'], includes: ['privacy', 'multi-day feel', 'custom vendor freedom possible', 'strong photo setting'], verify: ['full property buyout', 'legal onsite sleeping count', 'outside catering policy', 'professional kitchen', 'music curfew', 'rain backup', 'transport access', 'rental inventory'], confidence: 'Low', sourceLabel: 'Seeded venue-type strategy; not a live venue recommendation' },
  { id: 'boutique-resort-borgo-buyout', name: 'Boutique resort / borgo buyout', location: 'Destination markets with hospitality infrastructure', venueType: 'Boutique hotel, resort, borgo, inn, or retreat property', capacity: 'Often better for sleeping guests; catering flexibility varies', estimatedAllIn: 'Venue minimums and lodging terms can dominate budget before decor', budgetFit: 'Possible fit', styleFit: ['destination resort', 'weekend resort', 'formal', 'guest comfort'], includes: ['onsite guest services', 'lodging operations', 'easier transport', 'rain and staffing infrastructure'], verify: ['exclusive buyout terms', 'guest-room count', 'minimum stay', 'in-house catering rules', 'vendor list', 'tax/service', 'backup spaces'], confidence: 'Low', sourceLabel: 'Seeded venue-type strategy; specific properties require sourced data' },
  { id: 'villa-hotel-block-hybrid', name: 'Villa + nearby hotel block hybrid', location: 'Destination regions where perfect villas cannot sleep everyone', venueType: 'Ceremony/reception estate plus hotel block', capacity: 'Useful when onsite sleeping falls short of guest count', estimatedAllIn: 'May reduce venue constraints but adds shuttles, logistics, and split guest experience', budgetFit: 'Possible fit', styleFit: ['destination resort', 'guest comfort', 'garden romantic'], includes: ['more venue inventory', 'flexible guest lodging', 'privacy for VIP/family', 'transport plan required'], verify: ['hotel block terms', 'shuttle routes', 'late-night transport', 'guest communication', 'VIP onsite lodging allocation'], confidence: 'Low', sourceLabel: 'Planner strategy; requires local venue/hotel verification' },
  { id: 'charleston-garden-estate-example', name: 'Garden / historic estate venue type', location: 'Charleston, Savannah, Georgia, estate markets', venueType: 'Garden estate / historic property', capacity: '60–150 typical fit; verify per venue', estimatedAllIn: '$45k–$95k+ estimated wedding range before direct quote', budgetFit: 'Possible fit', styleFit: ['garden romantic', 'classic and elegant', 'coastal and relaxed'], includes: ['strong photo setting', 'ceremony/reception flow', 'southern hospitality feel'], verify: ['site fee', 'F&B minimum', 'rain plan', 'rental inclusions', 'service charge/tax', 'noise cutoff', 'planner requirement'], confidence: 'Low', sourceLabel: 'Seeded venue-type benchmark, not a live venue quote' },
  { id: 'city-hotel-ballroom-example', name: 'City hotel ballroom venue type', location: 'Any major city', venueType: 'Full-service hotel', capacity: '80–250 typical fit; verify per property', estimatedAllIn: '$55k–$150k+ estimated wedding range before direct quote', budgetFit: 'Possible fit', styleFit: ['black tie', 'formal', 'modern and clean'], includes: ['weather-safe', 'catering/bar often integrated', 'guest lodging support'], verify: ['food and beverage minimum', 'hotel block terms', 'vendor restrictions', 'service charge', 'overtime', 'ceremony fee'], confidence: 'Low', sourceLabel: 'Seeded venue-type benchmark, not live availability' },
  { id: 'restaurant-private-dining-example', name: 'Restaurant buyout / private dining venue type', location: 'User-selected city', venueType: 'Restaurant / private dining', capacity: '20–100 common; verify per restaurant', estimatedAllIn: '$15k–$75k+ estimated wedding range before direct quote', budgetFit: 'Strong fit', styleFit: ['warm dinner party', 'restaurant-quality dinner', 'intimate'], includes: ['food-first experience', 'less rental complexity', 'built-in atmosphere'], verify: ['buyout minimum', 'bar package', 'music limits', 'private room fee', 'cake/dessert rules', 'after-party plan'], confidence: 'Low', sourceLabel: 'Seeded venue-type benchmark; specific restaurant must be verified' }
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

export const planningBuckets = [
  'Constraint Profile', 'Recommendation Studio', 'Venue + Lodging Matchmaker', 'Budget + Tradeoff Reality', 'Design Direction', 'Florals / Decor / Rentals', 'Fashion / Beauty', 'Food / Beverage', 'Photo / Video / Moments', 'Guest Experience / Hospitality', 'Timeline / Weekend Flow', 'Vendor Team / Inquiry Builder', 'Risk / Reality Checks', 'Planner Packet / Decision Brief'
];

export const intelligenceModules = [
  'Planning Reality Check', 'Constraint Profile', 'Recommendation Studio', 'Venue + Lodging Matchmaker', 'Budget + Tradeoff Reality', 'Design Direction', 'Florals / Decor / Rentals', 'Fashion / Beauty', 'Food / Beverage', 'Photo / Video / Moments', 'Guest Experience / Hospitality', 'Timeline / Weekend Flow', 'Vendor Team / Inquiry Builder', 'Risk / Reality Checks', 'Planner Packet / Decision Brief'
];

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

export function normalizeText(plan: WeddingPlan) {
  return [plan.locations, plan.backupLocations, plan.ownVibeWords, plan.inspirationNotes, plan.colorsLoved, plan.makeItFeelLike, plan.constraints, plan.recommendationQuestion, ...plan.venueTypes, plan.fullBuyout, plan.onsiteLodging, plan.outsideCatering, plan.vendorFreedom].join(' ').toLowerCase();
}

export function estimateRange(plan: WeddingPlan) {
  const guests = Number(plan.guestCount || 0);
  const target = Number(plan.budgetTarget || 0);
  if (target > 0) return { low: Math.round(target * 0.85), high: Math.round(target * 1.25) };
  if (!guests) return { low: 0, high: 0 };
  const destinationMultiplier = /italy|france|spain|destination|amalfi|tuscany|europe/.test(normalizeText(plan)) ? 1.35 : 1;
  const buyoutMultiplier = plan.fullBuyout === 'required' ? 1.25 : 1;
  return { low: Math.round(guests * 550 * destinationMultiplier * buyoutMultiplier), high: Math.round(guests * 1250 * destinationMultiplier * buyoutMultiplier) };
}

// The readiness rubric is published at /readiness-score, so it lives in one place
// that both the planner and that page import. Re-exported here so every existing
// caller keeps working.
export { derivePlanReadiness, readinessBreakdown, readinessBand, readinessChecks } from '@/lib/readiness';

export function planningConstraintSummary(plan: WeddingPlan) {
  const items = [
    plan.constraintMode ? `Constraint mode: ${plan.constraintMode}` : 'Constraint mode not selected',
    plan.locations || 'Location not selected',
    plan.guestCount ? `${plan.guestCount} guests` : 'Guest count unknown',
    plan.fullBuyout ? `Full buyout: ${plan.fullBuyout}` : '',
    plan.onsiteSleepCount ? `Sleeps onsite: ${plan.onsiteSleepCount}` : '',
    plan.outsideCatering ? `Outside catering: ${plan.outsideCatering}` : '',
    plan.vendorFreedom ? `Vendor freedom: ${plan.vendorFreedom}` : '',
    protectedPriorities(plan).length ? `Protected: ${protectedPriorities(plan).join(', ')}` : 'Protected priorities not selected'
  ].filter(Boolean);
  return items.join(' · ');
}

export function budgetReality(plan: WeddingPlan) {
  const guests = Number(plan.guestCount || 0);
  const target = Number(plan.budgetTarget || 0);
  const protectedItems = protectedPriorities(plan);
  const text = normalizeText(plan);
  const hasDestinationComplexity = /italy|france|spain|destination|amalfi|tuscany|europe/.test(text);
  const hasBuyout = plan.fullBuyout === 'required' || text.includes('buyout');
  const hasOutsideCatering = plan.outsideCatering === 'required' || text.includes('outside catering');
  if (!guests && !target) return 'Unknown until guest count and budget comfort are entered. Protect what matters: the app keeps the top three priorities safe when suggesting savings.';
  const risks: string[] = [];
  if (guests) risks.push(`Guest count ${guests} is synced from Step 0.`);
  if (target && guests && target / guests < 650) risks.push('High risk: budget per guest is tight once venue, food/bar, rentals, staffing, tax, service, photo, music, and florals are included.');
  if (hasDestinationComplexity) risks.push('Destination logistics add travel, lodging, transfers, vendor travel, currency/tax, and multi-day hospitality pressure.');
  if (hasBuyout) risks.push('Full buyout can protect privacy but may raise minimum stay, lodging, and exclusive-use costs.');
  if (hasOutsideCatering) risks.push('Outside catering can improve customization but can add rentals, kitchen, staffing, power, service, and transport complexity.');
  if (protectedItems.length) risks.push(`Protect what matters: do not cut ${protectedItems.join(', ')} first. Start savings with ${plan.saveAreas || 'lower-priority extras, guest favors, printed add-ons, or optional trend moments'}.`);
  return risks.join(' ');
}

export function venueMatchSummary(plan: WeddingPlan) {
  const text = normalizeText(plan);
  const sleeping = Number(plan.onsiteSleepCount || 0);
  if (/italy|tuscany|amalfi|france|spain/.test(text) && (plan.fullBuyout === 'required' || text.includes('buyout')) && (sleeping >= 60 || text.includes('70') || text.includes('80')) && (plan.outsideCatering === 'required' || text.includes('outside catering'))) {
    return 'Full buyout + sleeps 70–80 + outside catering allowed is a narrow destination-venue search. Best targets are private estates, villas, borgos, boutique resorts with flexible catering, or a villa + nearby hotel block hybrid. Standard hotels may solve lodging but often restrict catering.';
  }
  if (plan.fullBuyout === 'required') return 'Full buyout moves the search toward private estates, boutique hotels, resorts, restaurants, or blank-canvas properties with clear exclusive-use terms. If outside catering is required, prioritize venues that clearly allow external catering and confirm kitchen, staffing, bar, insurance, and cleanup rules before shortlisting.';
  if (plan.onsiteLodging === 'required') return 'Onsite lodging makes this a hospitality search, not just a venue search. Room count, minimum stay, airport access, and guest movement matter.';
  if (plan.outsideCatering === 'required') return 'Outside catering requires venue/vendor freedom, kitchen access, staffing clarity, rentals, and service charge review.';
  return 'Venue fit is based on location, guest count, budget, style, weather safety, logistics, vendor freedom, and protected priorities.';
}

export function visionTranslatorOutput(plan: WeddingPlan) {
  const useWords = [plan.ownVibeWords, plan.colorsLoved, plan.makeItFeelLike, ...plan.feelings, ...plan.formality].filter(Boolean).join(' · ') || 'No design language entered yet';
  const avoidWords = [plan.colorsAvoided, plan.avoidFeelingLike, ...plan.avoids].filter(Boolean).join(' · ') || 'No avoid language entered yet';
  const implications = [
    plan.locations ? `Design must suit ${plan.locations}.` : 'Location still needs to be selected.',
    plan.season ? `Season/date range: ${plan.season}.` : 'Season unknown; floral and weather guidance stays low confidence.',
    protectedPriorities(plan).length ? `Protected priorities: ${protectedPriorities(plan).join(', ')}.` : 'Top three priorities not selected yet.'
  ];
  return { summary: `Interpreted custom direction: ${useWords}. Avoid: ${avoidWords}.`, useWords: useWords.split(' · '), avoidWords: avoidWords.split(' · '), implications };
}

export function plannerLanguage(plan: WeddingPlan) {
  if (!plan.locations && !plan.ownVibeWords && !plan.colorsLoved) return 'No planner brief yet. Start with Planning Reality Check or ask Recommendation Studio what to decide first.';
  return `Planner-ready brief: ${planningConstraintSummary(plan)}. Style direction: ${plan.ownVibeWords || plan.makeItFeelLike || plan.colorsLoved || 'not defined yet'}. Avoid: ${plan.avoidFeelingLike || plan.colorsAvoided || plan.avoids.join(', ') || 'not defined yet'}. Next decision: ${plan.nextDecision || 'venue/budget/design priority needs to be chosen'}.`;
}

export function plannerBucketsForPacket() {
  return planningBuckets;
}

function floralDirections(plan: WeddingPlan) {
  const text = normalizeText(plan);
  const palette = plan.colorsLoved || plan.recommendationQuestion;
  if (/beach|coastal/.test(text)) return [`Sunset Beach Bright: coral roses, peach ranunculus, pink bougainvillea-style accents where locally appropriate, yellow orchids sparingly, airy greenery, and hardy blooms that tolerate wind/heat. Palette request: ${palette}.`, 'Keep bouquets lighter and breezy; avoid fragile, heavy, water-hungry blooms if ceremony is hot or windy.', 'Use premium color in bouquets and photo moments; simplify guest-table volume if budget is protected elsewhere.'];
  if (/georgia|garden|estate|outdoor|savannah|charleston/.test(text)) return [`Southern Citrus Garden: peach ranunculus, blush garden roses, coral charm peonies if seasonal, yellow butterfly ranunculus, zinnias/cosmos for budget texture, and soft greenery. Palette request: ${palette}.`, 'Works well for outdoor garden/estate settings when arranged softly instead of tropical/high-contrast.', 'Protect bouquets and ceremony focal florals first; use bud vases or mixed centerpiece scales for savings.'];
  if (/italy|tuscany|villa|estate/.test(text)) return [`Italian Villa Sorbet: apricot garden roses, butter-yellow ranunculus, soft pink sweet peas if seasonal, coral dahlias when available, citrus fruit accents only if the design calls for it. Palette request: ${palette}.`, 'Best when paired with stone, linen, candlelight, and restrained greenery so it feels destination-luxury rather than themed.', 'Verify seasonal availability with the florist and ask for substitutions before exact pricing.'];
  return [`Soft Citrus Garden: pink, peach, orange, and yellow can work when blended in tonal layers rather than equal blocks. Palette request: ${palette}.`, 'Ask the florist for seasonal substitutions and a bouquet/reception split so the expensive blooms show up where photographed.', 'Avoid neon orange/yellow dominance unless the wedding is intentionally modern or tropical.'];
}

export function generateRecommendation(plan: WeddingPlan): PlannerRecommendation {
  const question = (plan.recommendationQuestion || '').toLowerCase();
  const text = normalizeText(plan);
  const constraints = planningConstraintSummary(plan);
  const isVenue = question.includes('venue') || plan.recommendationFocus === 'Venue + Lodging' || text.includes('buyout') || text.includes('outside catering') || text.includes('sleeps');
  const isFloral = question.includes('flower') || question.includes('floral') || question.includes('bouquet') || plan.recommendationFocus === 'Florals / Decor / Rentals';
  const protectedItems = protectedPriorities(plan);
  const baseQuestions = ['What is fixed, flexible, and unknown?', 'What is the real hard ceiling before tax/service/rentals?', 'Which top three priorities must be protected if cuts are needed?', 'What must be verified before a deposit is paid?'];

  if (isVenue) {
    return {
      plannerRead: `You are describing a venue-and-hospitality search, not just a pretty venue search. Using saved constraints: ${constraints}.`,
      bestFitDirections: ['Private villa / estate buyout: best if privacy, custom vendor freedom, and a multi-day destination feel matter most.', 'Boutique resort / borgo buyout: best if onsite lodging, operations, and guest services need to be easier.', 'Villa + nearby hotel block hybrid: best if the perfect venue cannot sleep everyone onsite but the event setting is worth the transport plan.'],
      constraintConflicts: ['Full buyout + sleeps 70–80 + outside catering is narrow; many villas lack lodging depth, while hotels often restrict catering.', 'Remote beauty can conflict with older guest comfort, shuttle timing, late-night movement, and vendor load-in.', 'Outside catering requires kitchen, power, staffing, rentals, service, insurance, and waste-removal verification.'],
      budgetImplications: ['Buyout and lodging terms can consume budget before design begins.', 'Outside catering may move cost from venue package into rentals, staffing, kitchen, transport, and production.', protectedItems.length ? `Savings should not cut protected priorities first: ${protectedItems.join(', ')}.` : 'Choose protected priorities before accepting savings suggestions.'],
      vendorQuestions: ['Is full property buyout available for all wedding events?', 'How many guests can legally and comfortably sleep onsite?', 'Are outside catering and outside bar allowed?', 'Is there a professional catering kitchen?', 'What are music curfews, rain backups, insurance, access, and vendor restrictions?'],
      nextDecisionChecklist: ['Decide whether onsite sleeping is required for all guests or VIP/family only.', 'Decide if outside catering is truly required or just preferred.', 'Set maximum transfer time from airport/hotels.', 'Ask venues for buyout, room count, catering, curfew, rain, and rental terms before emotional shortlisting.'],
      confidence: 'Low'
    };
  }

  if (isFloral) {
    return {
      plannerRead: `You are asking for a design system, not just flower names. Using saved constraints: ${constraints}.`,
      bestFitDirections: floralDirections(plan),
      constraintConflicts: ['Color palette must flex by setting: beach needs hardier, airier blooms; outdoor Georgia gardens can handle softer garden texture; Italian villas need restraint so the palette feels luxurious instead of themed.', 'Exact flower availability depends on season, local sourcing, imports, and florist relationships.', 'Bouquet beauty does not equal full-room affordability; table count and installations drive cost.'],
      budgetImplications: ['Use premium blooms in bridal bouquet, bridesmaid bouquets, ceremony focal point, and photo-heavy details first.', 'Use simpler seasonal flowers, bud vases, candlelight, or mixed centerpiece scales for reception volume if budget pressure rises.', protectedItems.includes('Florals') ? 'Florals are protected, so savings should start outside core bouquets/photo florals.' : 'If florals are not protected, decide what floral moments matter most before cutting broadly.'],
      vendorQuestions: ['Which flowers fit this palette in our season and location?', 'What substitutions keep the color story if premium blooms are unavailable?', 'What is the bouquet-only price versus full wedding floral scope?', 'How many tables/installations does this imply?', 'What labor, vessels, delivery, strike, and repurposing options exist?'],
      nextDecisionChecklist: ['Pick one floral mood: garden, beach, villa, modern, or editorial.', 'Choose where flowers must be most visible in photos.', 'Ask florist for two versions: protected-dream and controlled-budget.', 'Confirm heat/wind/season risks before naming exact flowers.'],
      confidence: 'Medium'
    };
  }

  return {
    plannerRead: `Recommendation Studio is using the saved constraint profile and ${plan.selectedTrends.length} selected standout idea(s) instead of generic advice: ${constraints}.`,
    bestFitDirections: ['Start with the constraint that is least flexible, then build beauty around it.', 'Protect the top three priorities and simplify lower-priority extras first.', `For ${plan.recommendationFocus}, ask for a recommendation that names fit, conflicts, budget impact, vendor questions, and the next decision.`],
    constraintConflicts: ['Unknown constraints reduce confidence; the system should discover missing decisions before pretending certainty.', 'Design ideas may conflict with venue rules, weather, budget, logistics, or guest comfort.', 'Aesthetic inspiration and selected standout ideas need translation into vendor scope, venue permissions, and timing before pricing.'],
    budgetImplications: ['Budget pressure is driven by guest count, venue/catering terms, rentals, production, tax/service, travel, and protected priorities.', protectedItems.length ? `Protected priorities: ${protectedItems.join(', ')}.` : 'Top three priorities are not selected yet, so savings advice stays conservative.'],
    vendorQuestions: baseQuestions,
    nextDecisionChecklist: [plan.nextDecision || 'Choose the next decision you need help making.', 'Fill fixed/flexible/unknown fields.', 'Ask Recommendation Studio a messy question.', 'Save the recommendation and any selected standout ideas into the packet.'],
    confidence: plan.constraintMode === 'discovery' || !plan.constraintMode ? 'Low' : 'Medium'
  };
}

export function riskChecklist(plan: WeddingPlan) {
  const risks = ['Budget estimates require verification before deposits', 'No live venue/vendor availability is claimed'];
  if (plan.fullBuyout === 'required') risks.push('Full buyout terms, minimum stay, exclusivity, and lodging counts must be verified');
  if (plan.outsideCatering === 'required') risks.push('Outside catering requires kitchen, staffing, rentals, insurance, load-in, and service terms');
  if (plan.onsiteSleepCount) risks.push('Sleeping capacity must be legal, comfortable, and clear by room/bed count');
  if (plan.rainBackup === 'required' || plan.outdoorNeeds) risks.push('Outdoor plan needs weather, tenting, flooring, power, and backup timeline');
  if (plan.curfewFlexibility) risks.push('Curfew/noise limits may affect dancing and after-party');
  if (plan.accessibilityNeeds) risks.push('Accessibility and elderly guest comfort need route, restroom, shuttle, and terrain review');
  return risks;
}

export function designDirection(plan: WeddingPlan) {
  const palette = plan.colorsLoved || 'palette not selected';
  const avoid = plan.colorsAvoided || plan.avoidFeelingLike || plan.avoids.join(', ') || 'no avoid list yet';
  return `Design direction: ${palette}. Use words: ${[plan.ownVibeWords, plan.makeItFeelLike, ...plan.feelings, ...plan.formality].filter(Boolean).join(' · ') || 'not defined yet'}. Avoid: ${avoid}.`;
}
