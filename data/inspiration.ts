import type { Confidence, SourceKind, WeddingPlan } from './planning';

export type InspirationInputType = 'image' | 'description';
export type InspirationCategory = 'tablescape' | 'bouquet' | 'florals' | 'attire' | 'stationery' | 'decor' | 'ceremony' | 'reception' | 'unknown';

export interface ScopeComponent {
  name: string;
  category: string;
  visibleStatus: 'Visible/requested' | 'Likely needed but not visible' | 'Optional upgrade' | 'Needs verification';
  quantityBasis: 'per guest' | 'per table' | 'per room' | 'flat fee' | 'per child/person' | 'unknown';
  estimate: string;
  vendors: string[];
  verificationQuestions: string[];
  confidence: Confidence;
  source: SourceKind;
}

export interface InspirationScope {
  title: string;
  intakePrompt: string;
  missingQuestions: string[];
  components: ScopeComponent[];
  vendorsNeeded: string[];
  sourcingStrategy: string[];
  warnings: string[];
  inquiryStarter: string;
  confidence: Confidence;
}

export const inspirationUseCases = [
  'Upload a tablescape photo or describe long tables, lace linens, candles, chandeliers, chairs with bows, and floral runners.',
  'Upload a bouquet or flower photo and convert it into possible blooms, palette, shape, size, substitutions, florist questions, and seasonal warnings.',
  'Upload or describe flower girl dresses and produce silhouette/fabric/search-term/retailer verification guidance.',
  'Type a description when no photo exists; the app treats text with the same scope, questions, pricing ranges, vendor map, and caveats.'
];

export const tablescapeScope: InspirationScope = {
  title: 'Tablescape Decoder',
  intakePrompt: 'Upload a reception table photo or describe the table look. Tell us guest count, table type, city, indoor/outdoor, and whether you want an exact match, inspired version, lower-cost version, or vendors/products that can create it.',
  missingQuestions: ['How many guests?', 'Long tables or rounds?', 'Every table or head table only?', 'Indoor or outdoor?', 'Real candles or LED?', 'Are chandeliers required or just the feeling?', 'What city/location and budget comfort?'],
  components: [
    { name: 'Specialty linens / lace cloths', category: 'rentals', visibleStatus: 'Visible/requested', quantityBasis: 'per table', estimate: '$45–$180 per table before delivery/labor', vendors: ['linen company', 'rental company'], verificationQuestions: ['Do you carry this fabric/color?', 'What are delivery, steaming, damage waiver, and strike fees?'], confidence: 'Medium', source: 'seeded_benchmark' },
    { name: 'Floral centerpieces / runners', category: 'floral', visibleStatus: 'Visible/requested', quantityBasis: 'per table', estimate: '$175–$800+ per table depending on density and blooms', vendors: ['florist', 'event designer'], verificationQuestions: ['What is your minimum spend?', 'Are vessels/candles/setup/strike included?', 'Can flowers be repurposed?'], confidence: 'Medium', source: 'seeded_benchmark' },
    { name: 'Taper candles, votives, candelabras', category: 'decor/rentals', visibleStatus: 'Visible/requested', quantityBasis: 'per table', estimate: '$20–$150+ per table plus flame/venue approval', vendors: ['florist', 'rental company', 'planner'], verificationQuestions: ['Does the venue allow open flame?', 'Who provides vessels and cleanup?'], confidence: 'Medium', source: 'seeded_benchmark' },
    { name: 'Specialty chairs with bows', category: 'rentals/attire detail', visibleStatus: 'Visible/requested', quantityBasis: 'per guest', estimate: '$8–$35+ per chair before delivery/labor/bows', vendors: ['rental company', 'linen/detail vendor'], verificationQuestions: ['Are bows included?', 'What chair count, delivery, setup, and damage waiver apply?'], confidence: 'Low', source: 'seeded_benchmark' },
    { name: 'Chandeliers / overhead lighting', category: 'lighting/production', visibleStatus: 'Optional upgrade', quantityBasis: 'flat fee', estimate: 'Highly variable; requires direct production quote', vendors: ['lighting vendor', 'production/rigging vendor', 'venue'], verificationQuestions: ['Is rigging permitted?', 'What power, insurance, lift access, install/strike windows, and labor are required?'], confidence: 'Low', source: 'needs_research' }
  ],
  vendorsNeeded: ['florist/event designer', 'rental company', 'linen company', 'lighting/production vendor if overhead installs are required', 'stationery designer', 'planner/coordinator'],
  sourcingStrategy: ['Search florist portfolios for full-service reception installations', 'Ask rental companies for specialty linens, tabletop, chair inventory, delivery, setup, and damage waiver', 'Ask lighting vendors about chandeliers, rigging, power, insurance, venue approval, and strike', 'Compare venue-included rentals before renting duplicates'],
  warnings: ['Chandeliers require venue approval, rigging, power, insurance, labor, and strike windows', 'An editorial single-table photo does not equal full-room pricing', 'Guest count and table count drive cost', 'Open flame, rigging, outdoor wind, heat, delivery, setup, and strike can change feasibility'],
  inquiryStarter: 'I am trying to recreate or adapt the attached/described reception tablescape for [guest count] guests in [location]. Could you price the floral/rental/lighting pieces separately, list what is included, and flag delivery, setup, strike, minimums, permits, and venue approval requirements?',
  confidence: 'Medium'
};

export const bouquetScope: InspirationScope = {
  title: 'Bouquet + Floral Scope',
  intakePrompt: 'Upload a bouquet/flower photo or describe the blooms, colors, shape, and feel. The app turns it into florist language, substitutions, seasonal warnings, and related wedding floral scope.',
  missingQuestions: ['Bride bouquet only or full floral system?', 'Bridesmaid bouquets, boutonnières, corsages, ceremony, reception?', 'Season/date and wedding city?', 'Exact match or inspired version?', 'Color flexibility?'],
  components: [
    { name: 'Bride bouquet', category: 'floral', visibleStatus: 'Visible/requested', quantityBasis: 'flat fee', estimate: '$175–$650+ depending on size, premium blooms, and city', vendors: ['florist'], verificationQuestions: ['Which blooms are visually likely?', 'What substitutions are recommended for season/budget?', 'What is included in delivery?'], confidence: 'Medium', source: 'uploaded_inspiration' },
    { name: 'Bridesmaid bouquets', category: 'floral', visibleStatus: 'Likely needed but not visible', quantityBasis: 'per child/person', estimate: '$85–$250+ each depending on count and style', vendors: ['florist'], verificationQuestions: ['How many attendants?', 'Should they be smaller versions or complementary?'], confidence: 'Medium', source: 'llm_inference' },
    { name: 'Boutonnières/corsages', category: 'floral', visibleStatus: 'Likely needed but not visible', quantityBasis: 'per child/person', estimate: '$18–$65+ each', vendors: ['florist'], verificationQuestions: ['Who needs personal flowers?', 'Do family/cultural traditions affect counts?'], confidence: 'Medium', source: 'llm_inference' }
  ],
  vendorsNeeded: ['florist', 'planner/coordinator for delivery timing', 'photographer if bouquet is central to portraits'],
  sourcingStrategy: ['Use visual search terms for color, bloom, and shape', 'Ask florists for seasonal substitutions and premium bloom cost drivers', 'Request bouquet + full wedding floral scope separately'],
  warnings: ['Photo flower identification is possible but not guaranteed', 'Exact bloom availability depends on season, location, imports, and florist sourcing', 'Premium flowers can shift price quickly'],
  inquiryStarter: 'I have a bouquet/flower inspiration image or description. Could you identify possible blooms, seasonal substitutions, bouquet range, and what it would cost to extend this floral direction into personal flowers, ceremony, and reception pieces?',
  confidence: 'Medium'
};

export const attireScope: InspirationScope = {
  title: 'Flower Girl Dress / Attire Finder',
  intakePrompt: 'Upload a dress photo or describe the silhouette, fabric, sleeve, bow, length, color, and age range. The app turns it into search terms, budget bands, retailer strategy, sizing warnings, and verification steps.',
  missingQuestions: ['How many children and ages?', 'Exact match or inspired?', 'Color requirements?', 'Season/weather?', 'Shipping deadline?', 'Budget per dress?'],
  components: [
    { name: 'Flower girl dress silhouette', category: 'attire', visibleStatus: 'Visible/requested', quantityBasis: 'per child/person', estimate: 'Under $75 / $75–$175 / $175–$350+ bands depending on retailer and fabric', vendors: ['retailer', 'children\'s formalwear shop', 'alterations tailor'], verificationQuestions: ['What size chart, return policy, and shipping date apply?', 'Does color match the wedding palette and bridal gown?'], confidence: 'Medium', source: 'uploaded_inspiration' },
    { name: 'Alterations and accessories', category: 'attire', visibleStatus: 'Likely needed but not visible', quantityBasis: 'per child/person', estimate: '$20–$125+ per child depending on fit/accessories', vendors: ['alterations tailor', 'retailer'], verificationQuestions: ['Are bows, shoes, tights, hair pieces, or backup sizes needed?'], confidence: 'Low', source: 'llm_inference' }
  ],
  vendorsNeeded: ['retailer', 'children\'s formalwear shop', 'alterations tailor', 'planner/stylist for palette match'],
  sourcingStrategy: ['Generate retail search terms from silhouette/fabric/color', 'Check shipping and returns before purchase', 'Order early enough for child growth and alterations', 'Keep a backup dress if deadline is tight'],
  warnings: ['Exact product matches require live retail data', 'Children\'s sizing is inconsistent', 'Fabric color can photograph differently than online images'],
  inquiryStarter: 'I am looking for flower girl dresses similar to the attached/described style. Please confirm sizing, ship date, return policy, fabric/color details, and whether alterations are commonly needed.',
  confidence: 'Medium'
};

export const genericScope: InspirationScope = {
  title: 'Description-to-Scope Intelligence',
  intakePrompt: 'Describe any wedding object, scene, flower, outfit, stationery piece, venue feeling, or decor moment. The app scopes components, vendors, prices, questions, sourcing, and verification steps.',
  missingQuestions: ['What is this for?', 'How many people/tables/items?', 'Where is the wedding?', 'Exact match or inspired version?', 'Budget comfort?', 'What matters most?'],
  components: [],
  vendorsNeeded: ['planner/coordinator', 'category-specific vendor', 'research needed'],
  sourcingStrategy: ['Translate description into search terms', 'Identify vendor categories', 'Ask for minimums and included/excluded items', 'Compare sourced options before trusting pricing'],
  warnings: ['Description-only results are planning estimates until sourced and verified'],
  inquiryStarter: 'I am trying to price and source this wedding inspiration: [description]. Could you confirm whether you can provide it, estimated pricing, minimums, included/excluded items, timing, delivery/setup/strike, and verification requirements?',
  confidence: 'Low'
};

export const inspirationScopes = [tablescapeScope, bouquetScope, attireScope, genericScope];

export function chooseScope(category: string): InspirationScope {
  const value = category.toLowerCase();
  if (value.includes('flower girl') || value.includes('dress') || value.includes('attire') || value.includes('fashion')) return attireScope;
  if (value.includes('table')) return tablescapeScope;
  if (value.includes('bouquet') || value.includes('flower') || value.includes('floral')) return bouquetScope;
  return genericScope;
}

export function tableCountFromPlan(plan: WeddingPlan) {
  const guests = Number(plan.guestCount || 0);
  if (!guests) return 'Unknown until guest count is entered';
  return `${Math.ceil(guests / 8)}–${Math.ceil(guests / 10)} guest tables before head table, cake table, bars, escort display, and lounge moments`;
}

export const typedDescriptionStandard = 'typed description input receives the same scope, questions, price range, vendor map, and verification checklist as an uploaded image';
