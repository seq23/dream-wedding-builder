import { describe, expect, it } from 'vitest';
import { rulesDraft } from '@/lib/ai-draft-rules';
import { parseDraft } from '@/lib/ai-draft';

const TODAY = '2026-11-10';
const read = (s: string) => parseDraft(JSON.stringify(rulesDraft(s, TODAY)), TODAY);

// 15 real-looking sentences: what the rules parser (step c, no model) must read.
const CASES: [string, Record<string, unknown>][] = [
  ['200 guests, June in Memphis, small budget', { weddingDate: '2027-06-15', guestCount: '200', locations: 'Memphis', season: 'summer', budgetTarget: 'small budget', budgetMode: 'hard' }],
  ['about 120 guests next June in Nashville, TN, budget $20k', { weddingDate: '2027-06-15', guestCount: '120', locations: 'Nashville, TN', budgetTarget: '$20,000', budgetMode: 'hard' }],
  ['Wedding on 6/12/27 for around 80 people, budget 20,000', { weddingDate: '2027-06-12', guestCount: '80', budgetTarget: '$20,000', season: 'summer' }],
  ['October 3, 2027 at a vineyard in Napa, 150 guests, $45,000', { weddingDate: '2027-10-03', guestCount: '150', locations: 'Napa', season: 'fall', budgetTarget: '$45,000' }],
  ['small fall wedding in Asheville with 40 guests and a tight budget', { season: 'fall', locations: 'Asheville', guestCount: '40', budgetMode: 'hard' }],
  ['Spring 2027 garden wedding near Charleston, 100-140 guests', { season: 'spring', locations: 'Charleston', guestCount: '120' }],
  ['We want a winter wedding in Chicago for 250 people, $60k budget', { season: 'winter', locations: 'Chicago', guestCount: '250', budgetTarget: '$60,000' }],
  ['beach wedding in Destin in May 2027, ~90 guests', { weddingDate: '2027-05-15', locations: 'Destin', guestCount: '90', season: 'spring' }],
  ['12 September 2027, Austin, Texas, 175 guests, budget of 35000', { weddingDate: '2027-09-12', guestCount: '175', budgetTarget: '$35,000' }],
  ['Backyard wedding this December in Denver, 60 guests, $15k', { weddingDate: '2026-12-15', locations: 'Denver', guestCount: '60', budgetTarget: '$15,000', season: 'winter' }],
  ['2027-08-21 in Savannah, Georgia with 130 guests', { weddingDate: '2027-08-21', locations: 'Savannah, Georgia', guestCount: '130' }],
  ['Destination wedding in Tulum, March, 70 guests, $25K-$30K', { weddingDate: '2027-03-15', locations: 'Tulum', guestCount: '70', budgetTarget: '$25,000–$30,000', budgetMode: 'range' }],
  ['July 4th wedding in Boston, guest count of 220, great food and photos matter most', { weddingDate: '2027-07-04', locations: 'Boston', guestCount: '220' }],
  ['Late April 2028 in the Hudson Valley, 95 guests, 50 grand', { weddingDate: '2028-04-15', locations: 'Hudson Valley', guestCount: '95', budgetTarget: '$50,000' }],
  ['Courthouse wedding in Austin for 12 people next spring, no budget', { locations: 'Austin', guestCount: '12', season: 'spring', budgetMode: 'dream' }]
];

describe('rules parser (step c): reads 15 real-looking sentences without a model', () => {
  for (const [sentence, expected] of CASES) {
    it(sentence, () => {
      const d = read(sentence);
      expect(d).not.toBeNull();
      expect(d).toMatchObject(expected);
    });
  }

  it('priorities come only from the Builder list', () => {
    expect(read('July 4th wedding in Boston, 220 guests, great food and photos matter most')!.priorities).toEqual(['Food + Bar', 'Photography']);
  });

  it('"may" as a verb is not a month; nothing usable is null (the form, step d)', () => {
    expect(rulesDraft('we may have a big party', TODAY).weddingDate).toBe('');
    expect(read('we are so excited to start planning')).toBeNull();
  });

  it('is unlimited and pure: 3,000 runs, no network, under a second', () => {
    const t = Date.now();
    for (let i = 0; i < 3000; i++) rulesDraft(CASES[i % CASES.length][0], TODAY);
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
