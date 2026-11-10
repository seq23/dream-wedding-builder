import { describe, expect, it } from 'vitest';
import { emptyPlan } from '@/data/planning';
import { applyAiDraft, dayWasGuessed, draftValues } from '@/components/AiDraftCard';
import { MESSAGES } from '@/lib/ai-draft';
import { AI_DRAFT_USED_TEXT } from '@/lib/builder-signup';

describe('AI draft result', () => {
  const draft = { weddingDate: '2027-10-15', guestCount: '120', locations: 'Memphis', season: 'fall', budgetTarget: '$30,000', budgetMode: 'hard', priorities: ['Party Energy'], notes: [] };
  const sentence = 'Outdoor fall wedding in Memphis, about 120 guests, October 2027, budget about $30,000';

  it('shows the values it filled, says when the day was a guess, and points each at where to change it', () => {
    const { plan } = applyAiDraft(emptyPlan, draft, sentence, '2026-11-10T00:00:00Z');
    const values = draftValues(plan);
    expect(values.map(v => v.value)).toEqual(expect.arrayContaining(['120', 'Memphis', '$30,000']));
    expect(values.find(v => v.field === 'weddingDate')!.value).toMatch(/15 Oct(ober)? 2027.*guess/);
    expect(values.every(v => v.href.startsWith('#'))).toBe(true);
  });

  it('does not call the day a guess when she gave it', () => {
    expect(dayWasGuessed('October 15th 2027 in Memphis', '2027-10-15')).toBe(false);
    expect(dayWasGuessed('October 2027, 150 guests', '2027-10-15')).toBe(true);
  });

  it('the card on her own device says the same sentence the server gives', () => {
    expect(MESSAGES.usedEmail).toBe(AI_DRAFT_USED_TEXT);
  });
});
