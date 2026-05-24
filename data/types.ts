export type BudgetMode = 'dream' | 'flexible' | 'strict';
export type Confidence = 'High' | 'Medium' | 'Low' | 'Quote Required';

export interface Estimate {
  low: number;
  likely: number;
  high: number;
  currency: 'USD' | 'EUR';
  confidence: Confidence;
  sourceType: string;
  sourceLabel: string;
  assumptions: string[];
  hiddenCosts: string[];
  plannerWarning: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  estimate: Estimate;
  plannerTip: string;
  levers: string[];
}

export interface Trend {
  id: string;
  name: string;
  category: string;
  labels: string[];
  description: string;
  bestFor?: string;
  avoidIf?: string;
  budgetPressure?: 'Low' | 'Medium' | 'High';
  costRange: string;
  complexity: 'Low' | 'Medium' | 'High';
  guestImpact: 'Low' | 'Medium' | 'High';
  photoImpact: 'Low' | 'Medium' | 'High';
  locationFit?: string[];
  whyItStandsOut?: string;
  supportNeeded?: string;
  verificationNote?: string;
  plannerWarning: string;
  vendorType: string;
}

export interface Lever {
  id: string;
  title: string;
  current: string;
  alternative: string;
  savingsLow: number;
  savingsHigh: number;
  tradeoff: string;
  visualImpact: string;
  guestImpact: string;
}
