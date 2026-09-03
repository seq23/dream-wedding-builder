import ownership from '@/data/seo/route_ownership.json';
import hubsJson from '@/data/seo/hub_pages.json';
import { plannerLandings } from '@/data/planner-landings';
import { PARENT_HOST, isCanonicalHost } from '@/lib/site-config';

// Why this module exists.
//
// data/seo/route_ownership.json is the sole producer of every sitemap this site
// publishes. Nothing consumed it to produce an internal link, so any route added
// there shipped in the sitemap immediately and acquired an inbound link only if
// somebody separately remembered to hand-write one somewhere. Twice in five days
// nobody did:
//
//   2026-08-29  the five /amazon/<slug> Kindle companion pages were added. No
//               file in this repo has ever contained a link to any of them.
//   2026-09-02  six planner landing pages were added. Each links to three
//               "related" landings, but those links are absolute and mostly
//               cross-host, so /what-to-do-6-months-before-the-wedding - the only
//               landing on weddingtimelinetemplate.com - received nothing.
//
// Ahrefs crawled on 2026-09-03 and reported exactly that: five orphan pages on
// weddingchecklistpdf.com and one on weddingtimelinetemplate.com. A page in the
// sitemap with no inbound link can neither receive nor pass authority; it is a
// published page that the site itself does not admit exists.
//
// The fix is here rather than on the six pages because the defect is the missing
// consumer, not the missing links. This module turns route_ownership.json into
// internal links, AppShell renders them into the footer of every page of every
// host, and scripts/validators/validate_internal_link_graph.mjs crawls the built
// site and hard-fails if any sitemap URL still has no inbound link.

export type DirectoryGroup = 'Planning hubs' | 'Planning questions' | 'For book readers' | 'About this site';
export type DirectoryLink = { href: string; label: string; group: DirectoryGroup };

// Routes deliberately excluded, each with the surface that already links it. An
// exclusion here is a claim that some other component produces the link; the
// crawl-based validator is what keeps that claim honest, so a stale entry in this
// list fails the build rather than quietly orphaning a page.
const COVERED_EXACT: Record<string, string> = {
  '/': 'the header wordmark links here on the parent host',
  '/guides': 'the primary nav and the footer resources column',
  '/shop': 'the header button and the footer product list',
  '/free-wedding-planner': 'the top banner, the desktop nav and the footer',
  '/privacy': 'the footer legal column',
  '/disclaimer': 'the footer legal column',
  '/terms': 'the footer legal column',
  '/refund-policy': 'the footer legal column'
};
// /guides/* is linked from the /guides index, which is in the nav on every host.
// /products/* is linked from the footer product list and from every hub page.
const COVERED_PREFIXES = ['/guides/', '/products/'];

// Labels for the parent-host informational routes, which carry no hub or landing
// record to take a name from. Adding an indexable route to route_ownership.json
// without a name here, a hub record, or a landing record produces no link and so
// produces an orphan - which is what the link-graph gate fails on.
const PARENT_LABELS: Record<string, string> = {
  '/photos': 'Real wedding photo library',
  '/trends': 'Wedding trend catalogue',
  '/methodology': 'Constraint-first planning: the method',
  '/readiness-score': 'How the readiness score is calculated'
};

const hubPages = hubsJson.pages as Record<string, { title: string; host: string }>;
const landingBySlugMap = new Map(plannerLandings.map((landing) => [landing.slug, landing]));

function groupFor(path: string, type: string): DirectoryGroup {
  if (path.startsWith('/amazon/')) return 'For book readers';
  if (type === 'landing') return 'Planning questions';
  if (type === 'hub') return 'Planning hubs';
  return 'About this site';
}

// Returns the link text for a directory-eligible route, or null when no record
// in this repo names it. Null is a defect, not a state to render around: the
// caller reports it and the validator fails on the orphan that results.
export function labelFor(path: string): string | null {
  const slug = path.slice(1);
  const hub = hubPages[slug];
  if (hub) return hub.title.split(':')[0].trim();
  const landing = landingBySlugMap.get(slug);
  if (landing) return landing.directoryLabel;
  return PARENT_LABELS[path] ?? null;
}

export function isDirectoryEligible(path: string): boolean {
  if (path in COVERED_EXACT) return false;
  return !COVERED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Every indexable route this host owns that no other surface links. Ordered by
// group so the footer reads as a directory rather than a link dump.
export function siteDirectory(rawHost: string): DirectoryLink[] {
  const host = isCanonicalHost(rawHost) ? rawHost : PARENT_HOST;
  const order: DirectoryGroup[] = ['Planning hubs', 'Planning questions', 'For book readers', 'About this site'];
  const links: DirectoryLink[] = [];
  for (const route of ownership.routes) {
    if (route.host !== host || !route.indexable) continue;
    if (!isDirectoryEligible(route.path)) continue;
    const label = labelFor(route.path);
    // No label means no link, which means an orphan URL - and the crawl in
    // scripts/validators/validate_internal_link_graph.mjs is what fails on it.
    // Skipping here rather than throwing keeps one missing string from 500-ing
    // every page on the site; the gate is what stops it reaching production.
    if (!label) continue;
    links.push({ href: route.path, label, group: groupFor(route.path, route.type) });
  }
  return links.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.label.localeCompare(b.label));
}
