import hubs from '@/data/seo/hub_pages.json';
import products from '@/data/products/product_catalog.json';
import { shippingPages } from '@/lib/authority-registry';
import { apexHost, isCanonicalHost, PARENT_HOST } from '@/lib/site-config';
import { plannerLandings } from '@/data/planner-landings';
import { PLANNER_ABSOLUTE } from '@/lib/planner-seed';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const raw = apexHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  const host = isCanonicalHost(raw) ? raw : PARENT_HOST;
  const product = products.products.find((item) => 'domain' in item && item.domain === host);
  const ownedHubs = Object.entries(hubs.pages).filter(([, page]) => page.host === host);
  // Same rule as the sitemap: never hand a crawler a URL the router will 404.
  const ownedGuides = shippingPages.filter((page) => page.product_id === product?.id);
  // The free planner and the pages that define the method are the first things a
  // reader or an answer engine should be pointed at - they were absent from this
  // file entirely while it listed 24 guides.
  const ownedLandings = plannerLandings.filter((landing) => landing.host === host);
  const lines = [
    `# ${product?.name ?? 'Dream Wedding Builder'}`,
    '',
    'Practical wedding planning guides, transparent paid-product previews, and protected working tools. Educational only; verify venue, vendor, contract, legal, dietary, accessibility, price, and timing requirements with the relevant source.',
    '',
    '## Free tool',
    `- [Free wedding planner - constraint-first planning in your browser, no account](${PLANNER_ABSOLUTE})`,
    `- [Constraint-first wedding planning: the method](https://${PARENT_HOST}/methodology)`,
    `- [The planning readiness score: inputs, weights, and what each number means](https://${PARENT_HOST}/readiness-score)`,
    ...(ownedLandings.length ? ['', '## Questions answered in full on this domain', ...ownedLandings.map((landing) => `- [${landing.question}](https://${host}/${landing.slug})`)] : []),
    '',
    '## Priority pages',
    ...ownedHubs.map(([slug, page]) => `- [${page.title}](https://${host}/${slug})`),
    ...ownedGuides.slice(0, 24).map((page) => `- [${page.title}](https://${host}/guides/${page.slug})`),
    '',
    `- [All guides](https://${host}/guides)`,
    `- [Sitemap](https://${host}/sitemap.xml)`
  ];
  return new Response(lines.join('\n') + '\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' } });
}
