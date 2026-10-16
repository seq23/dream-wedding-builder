import pinImages from '@/data/pinterest/pin_images.json';
import { lastmodFor } from '@/lib/lastmod';

// Pinterest RSS feed for weddingchecklistpdf.com (owner-approved 16 Oct 2026).
// Canonical URL: https://weddingchecklistpdf.com/pinfeed.xml (/pinfeed answers too).
// Every link is a product or guide PAGE on this host, never a checkout URL, and
// carries the pinfeed UTM params. Every image is a committed 1000x1500 pin from
// scripts/pinterest/generate_pin_images.mjs. Guarded by tests/unit/pinfeed.test.ts
// and, against the built site, scripts/validators/validate_pinterest.mjs.
export const PINFEED_HOST = 'weddingchecklistpdf.com';
export const PINFEED_PATH = '/pinfeed.xml';
export const PINFEED_UTM = { utm_source: 'pinterest', utm_medium: 'organic', utm_campaign: 'pinfeed' } as const;
const FALLBACK_DATE = '2026-10-16';

type PinSlug = keyof typeof pinImages;
export type PinItem = { path: string; title: string; description: string; image: PinSlug };

export const pinItems: PinItem[] = [
  { path: '/products/checklist-pdf', image: 'wedding-checklist-pdf', title: 'Wedding Checklist PDF: Printable + Editable Planning Checklist ($9)', description: 'A 104-row editable wedding checklist plus a 13-page printable PDF. Assign target dates, owners, dependencies and priorities from 12+ months out through wedding week, with separate wedding-week and final-payment trackers. One-time $9, instant download.' },
  { path: '/products/operations-suite', image: 'wedding-planning-bundle', title: 'Wedding Planning Bundle: Checklist, Budget, Timeline and Seating Chart ($39)', description: 'All four Dream Wedding Builder planners in one $39 bundle: the Wedding Checklist PDF, Budget Spreadsheet, Timeline Template and Seating Chart Maker, plus venue comparison, vendor contact and payment trackers, and a wedding-week handoff packet.' },
  { path: '/printable-wedding-checklist', image: 'printable-wedding-checklist', title: 'Printable Wedding Checklist: Month-by-Month Planning Timeline', description: 'How to choose and use a printable wedding checklist, month by month from 12+ months out to wedding week, with real previews of the 13-page printable PDF and the editable planning workbook.' },
  { path: '/guides/elopement-planning-checklist', image: 'elopement-planning-checklist', title: 'Elopement Planning Checklist: License, Witnesses, Permits and Travel', description: 'An elopement drops guests but not legal rules. Check the marriage license, waiting period, witnesses, officiant authority and location permits before you travel, then plan photos, attire and the day itself.' },
  { path: '/guides/courthouse-wedding-checklist', image: 'courthouse-wedding-checklist', title: 'Courthouse Wedding Checklist: Appointment, License, ID and Witnesses', description: 'A courthouse wedding checklist starts with the rules of your jurisdiction: appointment booking, marriage license, witnesses, identification, security screening and photography rules, then the small plans around the ceremony.' },
  { path: '/guides/destination-wedding-checklist', image: 'destination-wedding-checklist', title: 'Destination Wedding Checklist: Travel, Lodging, Documents and Vendors', description: 'Destination planning adds travel, lodging, local vendor, documentation, shipping and guest-communication steps to the normal wedding plan. Work through each dependency in order so nothing is left to the week you fly.' }
];

export function pinLink(path: string): string {
  const url = new URL(`https://${PINFEED_HOST}${path}`);
  for (const [key, value] of Object.entries(PINFEED_UTM)) url.searchParams.set(key, value);
  return url.toString();
}

export function pinImage(slug: PinSlug) {
  const image = pinImages[slug];
  return { ...image, url: `https://${PINFEED_HOST}${image.path}` };
}

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
const rfc822 = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toUTCString();

export function buildPinfeed(): string {
  const items = pinItems.map((item) => {
    const image = pinImage(item.image);
    const link = pinLink(item.path);
    return [
      '    <item>',
      `      <title>${esc(item.title)}</title>`,
      `      <link>${esc(link)}</link>`,
      `      <guid isPermaLink="false">${esc(`https://${PINFEED_HOST}${item.path}`)}</guid>`,
      `      <description>${esc(item.description)}</description>`,
      `      <pubDate>${rfc822(lastmodFor(item.path) ?? FALLBACK_DATE)}</pubDate>`,
      `      <enclosure url="${esc(image.url)}" type="${image.type}" length="${image.length}"/>`,
      `      <media:content url="${esc(image.url)}" type="${image.type}" medium="image" width="${image.width}" height="${image.height}"/>`,
      '    </item>'
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Wedding Checklist PDF</title>',
    `    <link>https://${PINFEED_HOST}/</link>`,
    `    <atom:link href="https://${PINFEED_HOST}${PINFEED_PATH}" rel="self" type="application/rss+xml"/>`,
    '    <description>Printable wedding checklists and planning templates from weddingchecklistpdf.com.</description>',
    '    <language>en-us</language>',
    ...items,
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');
}
