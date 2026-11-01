import { boards, buildPinfeed, PINFEED_HOST } from '@/lib/pinfeed';
import { apexHost, isCanonicalHost } from '@/lib/site-config';

// One RSS feed per Pinterest topic board after the first (data/pinterest/boards.json):
// /pinfeed/<board slug>.xml. Pinterest maps one feed to one board, so each is connected
// to its own board in Pinterest's auto-publish settings. Unknown slugs and the sibling
// hosts answer 404, as /pinfeed.xml does.
export const dynamic = 'force-dynamic';
const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
export async function GET(request: Request, { params }: { params: Promise<{ board: string }> }): Promise<Response> {
  const host = apexHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  if (isCanonicalHost(host) && host !== PINFEED_HOST) return notFound();
  const { board: segment } = await params;
  const board = boards.boardByFeedPath(`/pinfeed/${segment}`);
  if (!board || board.slug === boards.MAIN_BOARD.slug) return notFound();
  return new Response(buildPinfeed(new Date(), board), { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
