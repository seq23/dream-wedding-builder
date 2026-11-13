// What the journey's form can send and what step 2 shows: shared by the page (client)
// and lib/wedding-read.ts (server). No model code here, so the browser bundle stays small.
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter', 'Not sure'] as const;
export const SETTINGS = ['Outdoors', 'Indoors', 'Either'] as const;
export const MOODS = ['Relaxed', 'Elegant', 'Garden', 'City', 'Rustic', 'Cultural', 'Party', 'Intimate'] as const;
export const LOVES = ['The table', 'The flowers', 'The light', 'The place', 'The dress'] as const;
export const BUDGETS = ['Under $10,000', '$10,000 to $25,000', '$25,000 to $50,000', 'Over $50,000'] as const;
export const TRADITIONS = ['Catholic', 'Jewish', 'Hindu', 'Muslim nikah', 'Nigerian traditional', 'Mexican', 'Chinese tea ceremony', 'Other'] as const;

export interface Photo { loves: string[]; colours: string[]; image?: string }
export interface Answers {
  path: 'idea' | 'dk';
  wish: string;
  season: string;
  setting: string;
  moods: string[];
  photos: Photo[];
  where: string;
  guests: number | null;
  budget: string;
  tradition: string;
  venueBooked: boolean;
  dateSet: boolean;
}

export interface WeddingRead {
  by: 'ai' | 'fixed';
  headline: string;
  read: string;
  directions: { name: string; what: string }[];
  colours: { name: string; hex: string }[];
  venueTypes: { id: string; name: string; why: string }[];
  ideas: { id: string; name: string; cost: string; why: string }[];
  details: string[];
  ask: string[];
  honest: string;
  photoNotes: string[];
}
