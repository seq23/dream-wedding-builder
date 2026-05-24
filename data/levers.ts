import type { Lever } from './types';
export const levers: Lever[] = [
  { id: 'guest-count', title: 'Reduce Guest Count', current: '150 guests', alternative: '120 guests', savingsLow: 12000, savingsHigh: 30000, tradeoff: 'Smaller guest list, easier food/bar/rental control.', visualImpact: 'Low', guestImpact: 'High' },
  { id: 'bar-style', title: 'Change Bar Package', current: 'Full open bar', alternative: 'Beer, wine, and two signature cocktails', savingsLow: 6000, savingsHigh: 16000, tradeoff: 'Preserves hospitality while reducing premium liquor exposure.', visualImpact: 'Low', guestImpact: 'Medium' },
  { id: 'floral-density', title: 'Lower Floral Density', current: 'Full floral installation', alternative: 'Candle-heavy tables + one ceremony statement', savingsLow: 12000, savingsHigh: 55000, tradeoff: 'Less full-room transformation; ceremony photos can still feel elevated.', visualImpact: 'Medium', guestImpact: 'Low' },
  { id: 'date-day', title: 'Move Off Saturday', current: 'Saturday evening', alternative: 'Friday or Sunday', savingsLow: 5000, savingsHigh: 25000, tradeoff: 'May affect travel and guest convenience but can lower venue minimums.', visualImpact: 'Low', guestImpact: 'Medium' },
  { id: 'decor-simplify', title: 'Simplify Low-Photo Decor', current: 'Lounge, excess signage, extras', alternative: 'Keep one statement area and remove clutter', savingsLow: 3000, savingsHigh: 18000, tradeoff: 'Less decorative coverage; more money stays in high-impact areas.', visualImpact: 'Low-Medium', guestImpact: 'Low' }
];
