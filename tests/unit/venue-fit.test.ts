import { describe, expect, it } from 'vitest';
import { emptyPlan, venueExamples, type WeddingPlan } from '@/data/planning';
import { rankVenueTypes } from '@/lib/venue-fit';
import { nextQuestions } from '@/lib/next-questions';

// Hostile review, 10 Nov 2026: "Outdoor fall wedding in Memphis, about 120 guests,
// budget about $30,000, live band and a taco bar" was offered Italian villa buyouts
// and a 20-100 guest restaurant as the only "Strong fit".
const memphis: WeddingPlan = {
  ...emptyPlan, locations: 'Memphis', guestCount: '120', budgetTarget: '$30,000', budgetMode: 'hard', weddingDate: '2027-10-15',
  aiDraft: { at: '2026-11-10T00:00:00Z', description: 'Outdoor fall wedding in Memphis, about 120 guests, October 2027, budget about $30,000, live band and a taco bar', fields: [], notes: [] }
};

describe('venue types follow her answers', () => {
  it('Memphis, outdoor, 120 guests: no destination buyouts, nothing too small, outdoor first', () => {
    const r = rankVenueTypes(memphis, venueExamples);
    expect(r.shown.length).toBeGreaterThan(3);
    expect(r.shown.some(f => f.venue.destination)).toBe(false);
    expect(r.shown.every(f => f.venue.maxGuests >= 120)).toBe(true);
    expect(r.shown.map(f => f.venue.id)).not.toContain('restaurant-private-dining-example');
    expect(r.shown[0].venue.setting).toBe('outdoor');
    expect(r.shown[0].level).toBe('fits');
    // Indoor-only rooms are never the top fit for an outdoor wedding.
    const firstIndoor = r.shown.findIndex(f => f.venue.setting === 'indoor');
    const lastOutdoor = r.shown.map(f => f.venue.setting === 'indoor').lastIndexOf(false);
    expect(firstIndoor).toBeGreaterThan(lastOutdoor);
    expect(r.hidden.find(h => h.venue.id === 'restaurant-private-dining-example')?.reason).toContain('you have 120');
  });

  it('a destination wedding still gets the destination types', () => {
    const r = rankVenueTypes({ ...emptyPlan, locations: 'Tuscany, Italy', guestCount: '80' }, venueExamples);
    expect(r.shown.map(f => f.venue.id)).toContain('destination-estate-buyout');
  });

  it('with nothing known, nothing is called a fit and no destination type is pushed', () => {
    const r = rankVenueTypes(emptyPlan, venueExamples);
    expect(r.basis).toEqual([]);
    expect(r.shown.some(f => f.venue.destination)).toBe(false);
  });
});

describe('questions to settle next come from her own answers', () => {
  it('asks about rain, power for the band and an outside caterer, with her numbers', () => {
    const ids = nextQuestions(memphis, 20).map(q => q.id);
    expect(ids).toEqual(expect.arrayContaining(['rain', 'music', 'food', 'per-guest', 'cuts']));
    expect(ids).not.toContain('date');
    expect(ids).not.toContain('budget');
    const perGuest = nextQuestions(memphis, 20).find(q => q.id === 'per-guest')!;
    expect(perGuest.question).toContain('$250');
    expect(perGuest.why).toContain('$30,000 across 120 guests');
  });

  it('a different plan gets different questions', () => {
    const ids = nextQuestions({ ...emptyPlan, locations: 'Chicago', guestCount: '60', ownVibeWords: 'hotel ballroom, black tie' }, 20).map(q => q.id);
    expect(ids).not.toContain('rain');
    expect(ids).toContain('budget');
  });
});
