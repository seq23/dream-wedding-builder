import { apexHost, isCanonicalHost, PARENT_HOST } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

// Search engines and AI answer engines are welcomed by name rather than left to
// the `User-agent: *` group. A crawler that finds a group carrying its own name
// stops reading the wildcard entirely, and the zone-level managed robots.txt
// prepends exactly that -- a per-agent `Disallow: /` for several of these. The
// explicit groups below merge with the prepended ones under RFC 9309, where an
// equal-length Allow beats a Disallow, so our Allow wins.
const CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'DuckDuckBot',
  'OAI-SearchBot',
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'DuckAssistBot',
  'Amazonbot',
  'CCBot',
  'meta-externalagent',
  'Bytespider',
  'cohere-ai',
  'CloudflareBrowserRenderingCrawler',
  '*',
] as const;

// Repeated in every group: naming the agents must open the content without
// opening the admin, API, and purchase surfaces.
const DISALLOW = ['/admin', '/api', '/order', '/dashboard', '/pack'] as const;

const HEADER = [
  '# Citation-first crawl policy.',
  '# Search engines and AI answer engines are explicitly welcome on this site.',
  '# The per-agent Allow groups below are deliberate: they override any',
  '# prepended blanket Disallow (e.g. Cloudflare managed robots.txt) for the',
  '# same agent, because merged same-name groups resolve equal-length',
  '# Allow/Disallow conflicts in favour of Allow.',
].join('\n');

// Not exported: a Next.js route module may only export the HTTP handlers and
// the route segment config, and `tsc` fails the build on any other named export.
function robotsBody(canonical: string): string {
  const groups = CRAWLERS.map(
    (agent) => `User-agent: ${agent}\nAllow: /\n${DISALLOW.map((path) => `Disallow: ${path}`).join('\n')}`,
  );
  return `${HEADER}\n\n${groups.join('\n\n')}\n\nSitemap: https://${canonical}/sitemap.xml\n`;
}

export async function GET(request: Request) {
  const host = apexHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  const canonical = isCanonicalHost(host) ? host : PARENT_HOST;
  return new Response(robotsBody(canonical), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
