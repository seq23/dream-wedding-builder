import type { Category } from './types';

export const categories: Category[] = [
  {
    id: 'venue', name: 'Venue', description: 'Location, rental fee, minimums, included infrastructure, and destination logistics.',
    estimate: { low: 15000, likely: 45000, high: 150000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded planner range; quote required', assumptions: ['125 guests', 'Saturday evening', 'ceremony and reception', 'moderate-to-luxury market'], hiddenCosts: ['service charge', 'tax/VAT', 'security', 'parking', 'extra hours', 'approved vendor rules'], plannerWarning: 'Venue fee is rarely the full venue cost. Confirm inclusions, access, staffing, rain plan, and overtime in writing.' },
    plannerTip: 'A naturally beautiful venue can save more than almost any decor hack.', levers: ['Change venue type', 'Choose Friday/Sunday', 'Reduce guest count', 'Use included rentals']
  },
  {
    id: 'food-bar', name: 'Food + Bar', description: 'Catering, bar, staffing, rentals, vendor meals, and service costs.',
    estimate: { low: 18000, likely: 38000, high: 90000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded per-person range', assumptions: ['125 guests', 'dinner reception', 'alcohol included'], hiddenCosts: ['service charge', 'tax', 'gratuity', 'bartenders', 'vendor meals', 'cake cutting', 'corkage'], plannerWarning: 'Menu price is not the catering total. Service, tax, staffing, rentals, and bar rules change the number quickly.' },
    plannerTip: 'Food timing and bar flow matter more to guests than many decorative extras.', levers: ['Beer/wine/signature cocktails', 'Stations instead of plated', 'Reduce guest count']
  },
  {
    id: 'attire', name: 'Dress + Attire', description: 'Dress, alterations, veil, shoes, accessories, groom and wedding party attire.',
    estimate: { low: 2500, likely: 9000, high: 35000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded attire range', assumptions: ['bridal gown plus accessories', 'professional alterations'], hiddenCosts: ['alterations', 'veil', 'shoes', 'undergarments', 'steaming', 'preservation', 'rush shipping'], plannerWarning: 'A gown price is not the full bridal attire cost. Tailoring can matter more than the label.' },
    plannerTip: 'Do not skimp on tailoring. A less expensive gown that fits perfectly often looks better than a costly gown altered poorly.', levers: ['Sample gown', 'Pre-owned luxury gown', 'One look instead of two']
  },
  {
    id: 'flowers', name: 'Flowers', description: 'Bouquets, ceremony pieces, centerpieces, installations, vessels, delivery, and teardown.',
    estimate: { low: 5000, likely: 18500, high: 75000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded floral production range', assumptions: ['125 guests', 'ceremony feature', 'guest table flowers', 'delivery/setup'], hiddenCosts: ['premium stems', 'labor', 'mechanics', 'vessels', 'teardown', 'refrigeration', 'venue access'], plannerWarning: 'Florals get expensive because of labor and installation, not just flowers.' },
    plannerTip: 'Concentrate flowers where photos happen: bouquet, ceremony backdrop, head table, and guest-facing tables.', levers: ['Candle-heavy tables', 'One statement moment', 'Seasonal stems', 'Lower floral density']
  },
  {
    id: 'decor-rentals', name: 'Decor + Rentals', description: 'Tables, chairs, linens, chargers, glassware, lounge, draping, signage, and delivery.',
    estimate: { low: 8000, likely: 22000, high: 90000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded rental range', assumptions: ['125 guests', 'upgraded tablescape', 'some specialty rentals'], hiddenCosts: ['delivery', 'pickup', 'damage waiver', 'setup labor', 'venue access', 'replacement fees'], plannerWarning: 'Cheap linens, bad chairs, and harsh lighting can make an expensive wedding look unfinished.' },
    plannerTip: 'Looks expensive for less: candles, clean linens, cohesive palette, and one statement focal point.', levers: ['Simplify lounge', 'Use venue chairs', 'Upgrade napkins only', 'Remove excess signage']
  },
  {
    id: 'lighting-production', name: 'Lighting + Production', description: 'Uplighting, pin spots, chandeliers, dance floor, AV, rigging, power, install, and teardown.',
    estimate: { low: 3500, likely: 14000, high: 70000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded production range', assumptions: ['event lighting', 'some production labor'], hiddenCosts: ['rigging', 'power', 'insured labor', 'venue approvals', 'teardown', 'extra hours'], plannerWarning: 'Buying a lighting object is not the same as installing an event-safe lighting plan.' },
    plannerTip: 'Lighting is one of the quietest ways to make a wedding feel expensive.', levers: ['One statement zone', 'Pin spots only', 'Skip ceiling installs']
  },
  {
    id: 'photo-video', name: 'Photography + Video', description: 'Photographer, videographer, coverage hours, second shooter, albums, drone, film, and travel.',
    estimate: { low: 5000, likely: 15000, high: 50000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded media range', assumptions: ['8-10 hours', 'professional team'], hiddenCosts: ['second shooter', 'albums', 'raw footage', 'travel', 'overtime', 'film processing'], plannerWarning: 'Weak photography can make expensive design look cheaper than it was.' },
    plannerTip: 'Do not hire someone whose portfolio does not show weddings similar to yours in lighting, venue type, and timeline complexity.', levers: ['Shorter coverage', 'Skip album now', 'Local team']
  },
  {
    id: 'guest-experience', name: 'Guest Experience', description: 'Welcome bags, favors, transportation, afterparty, late-night snacks, guest book, and comfort.',
    estimate: { low: 2500, likely: 11000, high: 60000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded guest experience range', assumptions: ['125 guests', 'some guest extras'], hiddenCosts: ['transportation', 'staffing', 'delivery', 'assembly labor', 'venue rules'], plannerWarning: 'Pretty photos do not compensate for hungry, hot, stranded, or confused guests.' },
    plannerTip: 'Guest comfort beats decorative clutter. Prioritize bathrooms, shade, water, food timing, and transportation.', levers: ['Skip favors', 'Simpler welcome bags', 'Late-night snack only']
  },
  {
    id: 'planner', name: 'Planner / Coordination', description: 'Day-of, month-of, partial, full-service, destination planning, and production management.',
    estimate: { low: 2500, likely: 12000, high: 60000, currency: 'USD', confidence: 'Medium', sourceType: 'Planning Estimate', sourceLabel: 'Seeded planner fee range', assumptions: ['professional coordination', 'multi-vendor event'], hiddenCosts: ['travel', 'design fee', 'production management', 'assistants'], plannerWarning: 'If you have destination logistics, many vendors, outdoor infrastructure, or family complexity, coordination is not fluff.' },
    plannerTip: 'A coordinator is usually cheaper than the mistakes they prevent.', levers: ['Month-of instead of full', 'Package venue with coordinator']
  }
];
