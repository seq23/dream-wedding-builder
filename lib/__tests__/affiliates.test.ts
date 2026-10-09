import { describe, expect, it } from 'vitest';
import config from '@/data/affiliates/partners.json';
import { affiliateLink, linksFor, partners, placementForGuide } from '@/lib/affiliates';

describe('affiliate config', () => {
  it('carries exactly Zola, Minted and the Amazon registry, each with a plain https site', () => {
    expect(partners.map((p) => p.id).sort()).toEqual(['amazon-registry', 'minted', 'zola']);
    for (const p of partners) expect(p.plain_url).toMatch(/^https:\/\/www\.(zola|minted|amazon)\.com\//);
  });

  it('every placement resolves to known partners', () => {
    for (const placement of Object.keys(config.placements) as (keyof typeof config.placements)[]) {
      expect(linksFor(placement).length).toBeGreaterThan(0);
    }
  });

  it('without an affiliate id the link is the plain site, untracked, not sponsored', () => {
    const link = affiliateLink({ ...partners[0], affiliate_url: null });
    expect(link.href).toBe(partners[0].plain_url);
    expect(link.tracked).toBe(false);
    expect(link.rel).not.toContain('sponsored');
    expect(link.href).not.toMatch(/[?&](tag|ref|aff|irclickid|utm_)/i);
  });

  it('an affiliate url switches the link to tracked and sponsored', () => {
    const link = affiliateLink({ ...partners[0], affiliate_url: 'https://example.test/track?id=1' });
    expect(link).toMatchObject({ href: 'https://example.test/track?id=1', tracked: true });
    expect(link.rel).toContain('sponsored');
  });

  it('routes guest and invitation guides to the invitations-first placement', () => {
    expect(placementForGuide('wedding-guest-list-template')).toBe('guest-list');
    expect(placementForGuide('wedding-checklist')).toBe('checklist');
    expect(placementForGuide('wedding-budget-spreadsheet')).toBe('guide-default');
  });
});
