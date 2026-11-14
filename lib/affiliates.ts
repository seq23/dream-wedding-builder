import config from '@/data/affiliates/partners.json';

// Affiliate links are driven by data/affiliates/partners.json alone. A partner with
// no affiliate_url links to its plain site with no tracking and no sponsored rel;
// filling affiliate_url in that file is the only step needed to switch it on.

export type AffiliatePartner = {
  id: string;
  name: string;
  category: 'registry' | 'invitations';
  label: string;
  blurb: string;
  plain_url: string;
  affiliate_url: string | null;
  signup_url: string;
};

export type Placement = keyof typeof config.placements;

export const partners = config.partners as AffiliatePartner[];

export type AffiliateLink = { id: string; name: string; label: string; blurb: string; category: string; href: string; tracked: boolean; rel: string };

export function affiliateLink(partner: AffiliatePartner): AffiliateLink {
  const tracked = typeof partner.affiliate_url === 'string' && partner.affiliate_url.startsWith('https://');
  return {
    id: partner.id,
    name: partner.name,
    label: partner.label,
    blurb: partner.blurb,
    category: partner.category,
    href: tracked ? (partner.affiliate_url as string) : partner.plain_url,
    tracked,
    rel: tracked ? 'sponsored noopener noreferrer' : 'noopener noreferrer'
  };
}

/** The disclosure printed beside a set of links (16 CFR 255.5: next to the link, not on
 * another page). Amazon Associates also requires its own sentence wherever an Amazon
 * tracked link shows. Empty when nothing on the list is tracked. */
export function affiliateDisclosure(links: AffiliateLink[]): string {
  if (!links.some((link) => link.tracked)) return '';
  const amazon = links.some((link) => link.tracked && /(^|\.)amazon\.com$/.test(new URL(link.href).hostname));
  return `Some of these are affiliate links: if you sign up or buy through them we may earn a commission, at no cost to you.${amazon ? ' As an Amazon Associate we earn from qualifying purchases.' : ''}`;
}

export function linksFor(placement: Placement): AffiliateLink[] {
  const ids = config.placements[placement] as string[];
  return ids.map((id) => {
    const partner = partners.find((item) => item.id === id);
    if (!partner) throw new Error(`Affiliate placement ${placement} names unknown partner ${id}`);
    return affiliateLink(partner);
  });
}

/** Guides about guests and invitations lead with Minted; everything else leads with registries. */
export function placementForGuide(slug: string, cluster = ''): Placement {
  const text = `${slug} ${cluster}`.toLowerCase();
  if (/guest|invitation|rsvp|seating/.test(text)) return 'guest-list';
  if (/checklist/.test(text)) return 'checklist';
  return 'guide-default';
}
