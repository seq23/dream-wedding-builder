export type Confidence = 'High' | 'Medium' | 'Low' | 'Unknown';
export type SourceKind = 'user_input' | 'seeded_benchmark' | 'curated_example' | 'llm_inference' | 'uploaded_inspiration' | 'description_input' | 'needs_research';

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
  locations: string;
  guestCount: string;
  season: string;
  budgetMode: string;
  budgetTarget: string;
  venueBudget: string;
  ownVibeWords: string;
  inspirationNotes: string;
  feelings: string[];
  settings: string[];
  formality: string[];
  florals: string[];
  food: string[];
  photos: string[];
  avoids: string[];
  priorities: string[];
  constraints: string;
  selectedTrends: string[];
  selectedTemplate: string;
  generatedAt: string;
  inspirationScopeNotes: string;
}

export const emptyPlan: WeddingPlan = {
  stage: '',
  locations: '',
  guestCount: '',
  season: '',
  budgetMode: 'unknown',
  budgetTarget: '',
  venueBudget: '',
  ownVibeWords: '',
  inspirationNotes: '',
  feelings: [],
  settings: [],
  formality: [],
  florals: [],
  food: [],
  photos: [],
  avoids: [],
  priorities: [],
  constraints: '',
  selectedTrends: [],
  selectedTemplate: '',
  generatedAt: '',
  inspirationScopeNotes: ''
};

export const planningStages = [
  'I just got engaged and have no idea where to start.',
  'I know the vibe but not the budget.',
  'I know the budget but not the venue.',
  'I have a venue but need design direction.',
  'I have vendors but need a complete plan.',
  'I am dreaming first and will make it realistic later.'
];

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
  { name: 'Lake Como Weekend', adopt: ['European destination energy', 'waterfront portraits', 'formal dinner-party pacing'], doNotAdopt: ['location', 'budget', 'guest count'] },
  { name: 'Charleston Garden Coastal', adopt: ['garden/coastal setting', 'guest comfort', 'warm hospitality'], doNotAdopt: ['vendor pricing without verification'] },
  { name: 'Modern City Hotel', adopt: ['logistics simplicity', 'black-tie polish', 'weather-safe venue'], doNotAdopt: ['ballroom stiffness'] },
  { name: 'Backyard Luxury', adopt: ['intimacy', 'family meaning', 'custom design'], doNotAdopt: ['hidden rental complexity'] },
  { name: 'Cultural Family Weekend', adopt: ['family rituals', 'multi-event structure', 'guest care'], doNotAdopt: ['one-size-fits-all timeline'] },
  { name: 'Restaurant Wedding', adopt: ['food-first experience', 'lower decor pressure', 'guest warmth'], doNotAdopt: ['late-night party assumptions'] }
];

export const venueExamples: VenueCandidate[] = [
  { id: 'charleston-garden-estate-example', name: 'Charleston garden-estate venue type', location: 'Charleston, SC area', venueType: 'Garden estate / historic property', capacity: '60–150 typical fit; verify per venue', estimatedAllIn: '$45k–$95k+ estimated wedding range before direct quote', budgetFit: 'Possible fit', styleFit: ['garden romantic', 'classic and elegant', 'coastal and relaxed'], includes: ['strong photo setting', 'ceremony/reception flow', 'southern hospitality feel'], verify: ['site fee', 'F&B minimum', 'rain plan', 'rental inclusions', 'service charge/tax', 'noise cutoff', 'planner requirement'], confidence: 'Low', sourceLabel: 'Seeded venue-type benchmark, not a live venue quote' },
  { id: 'city-hotel-ballroom-example', name: 'City hotel ballroom venue type', location: 'Any major city', venueType: 'Full-service hotel', capacity: '80–250 typical fit; verify per property', estimatedAllIn: '$55k–$150k+ estimated wedding range before direct quote', budgetFit: 'Possible fit', styleFit: ['black tie', 'formal', 'modern and clean'], includes: ['weather-safe', 'catering/bar often integrated', 'guest lodging support'], verify: ['food and beverage minimum', 'hotel block terms', 'vendor restrictions', 'service charge', 'overtime', 'ceremony fee'], confidence: 'Low', sourceLabel: 'Seeded venue-type benchmark, not live availability' },
  { id: 'restaurant-private-dining-example', name: 'Restaurant buyout / private dining venue type', location: 'User-selected city', venueType: 'Restaurant / private dining', capacity: '20–100 common; verify per restaurant', estimatedAllIn: '$15k–$75k+ estimated wedding range before direct quote', budgetFit: 'Strong fit', styleFit: ['warm dinner party', 'restaurant-quality dinner', 'intimate'], includes: ['food-first experience', 'less rental complexity', 'built-in atmosphere'], verify: ['buyout minimum', 'bar package', 'music limits', 'private room fee', 'cake/dessert rules', 'after-party plan'], confidence: 'Low', sourceLabel: 'Seeded venue-type benchmark; specific restaurant must be verified' }
];

export const vendorCategories = [
  { name: 'Planner / Coordinator', questions: ['Do we need full planning, partial planning, or month-of?', 'Who owns budget tracking and vendor management?', 'Will they manage family logistics and the timeline?'] },
  { name: 'Photographer', questions: ['Editorial, documentary, film, bright, or flash-party style?', 'How many hours and do we need a second shooter?', 'What travel, overtime, and delivery terms apply?'] },
  { name: 'Florist / Designer', questions: ['Is there a minimum spend?', 'What installations require labor, strike, or rigging?', 'Can ceremony florals be repurposed?'] },
  { name: 'Catering / Bar', questions: ['What is included vs extra?', 'What are tax, service charge, staff, rentals, and vendor meals?', 'What dietary and cultural needs must be handled?'] },
  { name: 'Music / Entertainment', questions: ['Band, DJ, ceremony musicians, after-party?', 'Noise cutoff and power needs?', 'Emcee role and timeline coordination?'] },
  { name: 'Rentals / Lighting', questions: ['Tables, chairs, linens, china, glassware, flatware?', 'Tent, generator, dance floor, heaters/fans?', 'Delivery, setup, strike, damage waiver?'] },
  { name: 'Attire / Fashion', questions: ['What must be sourced vs custom?', 'What are alteration, shipping, and return deadlines?', 'Are child sizes, flower girl dresses, or family attire involved?'] },
  { name: 'Stationery / Paper Goods', questions: ['Menus, place cards, escort display, signage, invitation suite?', 'Who owns print deadlines and day-of installation?', 'What must match the tablescape or florals?'] }
];

export const hiddenFeeChecklist = ['tax', 'service charge', 'gratuity', 'ceremony fee', 'cake cutting', 'corkage', 'bar minimum', 'security', 'valet', 'shuttle', 'coat check', 'restroom trailers', 'generator', 'tenting', 'flooring', 'lighting', 'dance floor', 'tables/chairs', 'linens', 'china/glassware/flatware', 'vendor meals', 'overtime', 'setup/strike labor', 'delivery fees', 'travel fees', 'lodging for vendors', 'rain plan costs', 'flame permits', 'rigging approval', 'damage waiver', 'linen steaming', 'rental minimums'];

export const intelligenceModules = [
  'Vibe + Theme Translator', 'Budget Reality Engine', 'Venue Finder / Matchmaker', 'Vendor Finder', 'Photo/Description-to-Scope Intelligence', 'Tablescape Decoder', 'Bouquet + Floral Scope', 'Flower Girl Dress Finder Strategy', 'Hidden Fee Intelligence', 'Planner Packet Export'
];

export const inspirationCategories = [
  'tablescape', 'bouquet', 'centerpieces', 'ceremony arch', 'reception room', 'flower girl dresses', 'bridesmaid dresses', 'bridal fashion', 'stationery', 'cake', 'lighting/chandeliers', 'chairs/linens/rentals', 'welcome party', 'hotel welcome bags'
];

export const scopeComponents = [
  { category: 'Tablescape', components: ['tables', 'chairs', 'linens', 'napkins', 'chargers', 'plates', 'flatware', 'glassware', 'menus', 'place cards', 'floral centerpieces', 'taper candles', 'votives', 'candelabras', 'fruit/decor accents', 'lighting/chandeliers', 'delivery/setup/strike labor'], vendors: ['florist/event designer', 'rental company', 'linen company', 'lighting/production vendor', 'stationery designer', 'planner/coordinator'], warnings: ['Open flame may be restricted', 'Chandeliers require venue approval, rigging, power, insurance, and labor', 'Per-table florals multiply quickly at high guest counts'] },
  { category: 'Bouquet / Flowers', components: ['flower types if visually likely', 'palette', 'shape', 'size', 'density', 'seasonality', 'premium blooms', 'substitutions', 'bridesmaid bouquets', 'boutonnieres/corsages'], vendors: ['florist', 'event designer', 'planner for scope coordination'], warnings: ['Flower identification from a photo is not guaranteed', 'Seasonality and import needs can change price', 'Exact flower match must be confirmed by florist'] },
  { category: 'Flower Girl Dresses / Attire', components: ['silhouette', 'fabric', 'sleeve', 'length', 'color', 'bow/sash detail', 'age range', 'alterations', 'shipping timeline', 'return policy'], vendors: ['retailer', 'children\'s formalwear shop', 'alterations tailor', 'stylist/planner if matching full party'], warnings: ['Exact product match requires live retail data', 'Children\'s sizing varies heavily', 'Color should be checked against wedding palette and bridal gown'] }
];

export function derivePlanReadiness(plan: WeddingPlan) {
  const known = [plan.stage, plan.locations, plan.guestCount, plan.season, plan.budgetTarget, plan.venueBudget, plan.constraints, plan.ownVibeWords, plan.inspirationNotes, plan.inspirationScopeNotes].filter(Boolean).length;
  const choices = plan.feelings.length + plan.settings.length + plan.formality.length + plan.florals.length + plan.food.length + plan.photos.length + plan.avoids.length + plan.priorities.length;
  return Math.min(100, Math.round(((known + choices) / 28) * 100));
}

export function budgetReality(plan: WeddingPlan) {
  const guests = Number(plan.guestCount || 0);
  const budget = Number(plan.budgetTarget || 0);
  if (!guests || !budget) return 'Unknown — enter guest count and budget to pressure-test realism.';
  const perGuest = budget / guests;
  if (perGuest < 350) return 'High risk — this guest count and budget will require a very disciplined venue, food/bar, rental, floral, and event-scope strategy.';
  if (perGuest < 700) return 'Possible with tradeoffs — prioritize venue fit, food/bar clarity, and avoid hidden rental-heavy venues.';
  if (perGuest < 1200) return 'Flexible — many polished options may be possible, but venue minimums and service charges still need verification.';
  return 'Luxury range — still verify minimums, service charges, planner scope, travel, lodging, and production costs.';
}

export function plannerLanguage(plan: WeddingPlan) {
  const ownWords = plan.ownVibeWords.trim();
  const inspiration = plan.inspirationNotes.trim();
  const feeling = plan.feelings.length ? plan.feelings.join(', ') : 'still discovering the emotional direction';
  const setting = plan.settings.length ? plan.settings.join(', ') : 'venue type undecided';
  const avoid = plan.avoids.length ? plan.avoids.join(', ') : 'no hard aesthetic boundaries chosen yet';
  const base = ownWords || inspiration
    ? `Interpreted from the bride's own words/inspiration: ${ownWords || inspiration}. Translate this into ${feeling} with a setting direction of ${setting}.`
    : `You are describing a wedding that should feel ${feeling}, with a setting direction of ${setting}.`;
  return `${base} Avoid: ${avoid}. Use planner/vendor language that is specific, visual, and verifiable. Treat this as a working interpretation, not a final theme.`;
}

export function visionTranslatorOutput(plan: WeddingPlan) {
  const words = [plan.ownVibeWords, plan.inspirationNotes, plan.feelings.join(', '), plan.settings.join(', ')].filter(Boolean).join(' · ');
  const direction = words ? 'Interpreted custom direction' : 'Direction not selected yet';
  return {
    direction,
    summary: plannerLanguage(plan),
    useWords: ['intimate', 'guest-centered', 'textural', 'intentional', 'planner-ready', ...(plan.feelings.length ? plan.feelings : [])].slice(0, 8),
    avoidWords: plan.avoids.length ? plan.avoids : ['rustic, boho, glam, princess, or trendy unless the bride explicitly chooses those words'],
    implications: ['Venue type affects budget more than palette', 'Florals/rentals/light level must be scoped by guest count and table count', 'Every aesthetic claim needs a cost driver and verification checklist']
  };
}

export function estimateRange(plan: WeddingPlan) {
  const guests = Number(plan.guestCount || 0);
  const budget = Number(plan.budgetTarget || 0);
  if (budget) return { low: Math.round(budget * 0.85), high: Math.round(budget * 1.25) };
  if (guests) return { low: Math.max(15000, guests * 350), high: Math.max(30000, guests * 900) };
  return { low: 0, high: 0 };
}
