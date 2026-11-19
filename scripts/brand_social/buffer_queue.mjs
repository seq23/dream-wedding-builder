// Hands this week's brand social posts to the brands Buffer (api.buffer.com GraphQL), within
// the free plan: the organisation holds at most `limits.scheduledPosts` (10) scheduled posts
// in all, and this job keeps at most plan.per_channel_queue_max (3) waiting per channel, so
// three channels never pass 9. Posts join each channel's Buffer queue (mode addToQueue) and
// go out on that channel's own posting times.
//
// Brand-agnostic: the same file runs in dream-wedding-builder and approvalprep; each repo's
// scripts/brand_social/queue_posts.mjs passes its plan, its posts and its site.
//
// Named stops (each prints `NAMED STOP: <CODE> - why` and exits 1, so the run is red and the
// Boss OS run watcher shows it): BUFFER_TOKEN_MISSING, BUFFER_TOKEN_REFUSED (401/403),
// BUFFER_READ_FAILED, BUFFER_CHANNEL_MISSING, BUFFER_QUEUE_FULL (no room on any channel
// at the weekly run: last week's posts did not go out), BRAND_SOCIAL_MEDIA_NOT_LIVE,
// BUFFER_POST_REFUSED, BRAND_SOCIAL_EXHAUSTED (no unposted carousel left).
// plan.enabled = false is not a stop: the job prints OUTPUT ... OFF and queues nothing.

export const API = 'https://api.buffer.com';
export const TOKEN_ENV = 'BUFFER_BRANDS_ACCESS_TOKEN';

export class NamedStop extends Error {
  constructor(code, why) { super(`${code} - ${why}`); this.code = code; }
}

export function bufferClient(token, fetchImpl = fetch) {
  return async function call(query, variables = {}) {
    let res;
    try {
      res = await fetchImpl(API, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ query, variables }) });
    } catch (e) {
      throw new NamedStop('BUFFER_READ_FAILED', `api.buffer.com unreachable: ${e.message}`);
    }
    if (res.status === 401 || res.status === 403) throw new NamedStop('BUFFER_TOKEN_REFUSED', `api.buffer.com answered ${res.status}: mint a new token in Buffer and save it as ${TOKEN_ENV}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.errors?.length) throw new NamedStop('BUFFER_READ_FAILED', `api.buffer.com ${res.status}: ${JSON.stringify(body?.errors ?? body).slice(0, 300)}`);
    return body.data;
  };
}

/** The organisation, its scheduled-post limit, the plan's channels and what each has queued. */
export const PENDING_STATUSES = ['scheduled', 'sending', 'needs_approval'];

export async function readState(call, plan) {
  const acct = await call('{ account { organizations { id limits { scheduledPosts } } } }');
  const org = acct?.account?.organizations?.[0];
  if (!org) throw new NamedStop('BUFFER_READ_FAILED', 'the token sees no Buffer organisation');
  const { channels } = await call('query($o:OrganizationId!){ channels(input:{organizationId:$o}){ id service name isQueuePaused } }', { o: org.id });
  // One status per query: Buffer answers a multi-status filter with nothing (18 Nov 2026: [scheduled,sending] -> 0, [scheduled] -> 6).
  const scheduled = [];
  for (const status of PENDING_STATUSES) {
    const { posts } = await call(`query($o:OrganizationId!){ posts(first:100, input:{organizationId:$o, filter:{status:[${status}]}}){ edges { node { id channelId } } } }`, { o: org.id });
    scheduled.push(...(posts?.edges ?? []).map((e) => e.node));
  }
  const out = {};
  for (const [platform, want] of Object.entries(plan.channels)) {
    const ch = channels.find((c) => c.service === want.service && c.name === want.name);
    if (!ch) throw new NamedStop('BUFFER_CHANNEL_MISSING', `no ${want.service} channel named ${want.name} in the brands Buffer`);
    out[platform] = { ...ch, scheduled: scheduled.filter((p) => p.channelId === ch.id).length };
  }
  return { orgId: org.id, orgLimit: Number(org.limits?.scheduledPosts ?? 10), orgScheduled: scheduled.length, channels: out };
}

/** The createPost input for one post on one platform. */
export function postInput(post, platform, channelId, mediaUrl, text = post.caption) {
  const assets = post.type === 'video'
    ? [{ video: { url: mediaUrl(post, 'video.mp4') } }]  // Buffer refuses thumbnailUrl (18 Nov 2026); the first frame is the title card
    : post.slides.map((s, i) => ({ image: { url: mediaUrl(post, `${i + 1}.jpg`), metadata: { altText: [s.eyebrow, s.headline, s.label, s.subline, s.re, s.greeting, ...(s.items ?? []), ...(s.body ?? [])].filter(Boolean).join('. ').slice(0, 1000) } } }));
  // Instagram takes 'post' for a multi-image carousel; Buffer refuses 'carousel' (18 Nov 2026 live run).
  const metadata = platform === 'tiktok'
    ? { tiktok: { title: post.title.slice(0, 90), isAiGenerated: false } }
    : { instagram: { type: post.type === 'video' ? 'reel' : 'post', shouldShareToFeed: true, isAiGenerated: false } };
  return { channelId, text, assets, metadata, mode: 'addToQueue', schedulingType: 'automatic', needsApproval: false, source: 'brand-social' };
}

export async function createPost(call, input) {
  const data = await call(`mutation($i:CreatePostInput!){ createPost(input:$i){ __typename ... on PostActionSuccess { post { id dueAt } } ... on MutationError { message } } }`, { i: input });
  const r = data?.createPost;
  if (!r || r.__typename !== 'PostActionSuccess') throw new NamedStop('BUFFER_POST_REFUSED', `${input.channelId}: ${r?.message ?? JSON.stringify(r).slice(0, 200)}`);
  return r.post;
}

/** Every media URL of a post answers 200, waiting at most `waitMs` for a deploy to land. */
export async function waitLive(urls, { waitMs = 12 * 60_000, everyMs = 30_000, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const until = Date.now() + waitMs;
  for (;;) {
    const codes = await Promise.all(urls.map((u) => fetchImpl(u, { method: 'HEAD' }).then((r) => r.status, () => 0)));
    const dead = urls.filter((_, i) => codes[i] !== 200);
    if (!dead.length) return;
    if (Date.now() >= until) throw new NamedStop('BRAND_SOCIAL_MEDIA_NOT_LIVE', `${dead.length} file(s) not served yet, e.g. ${dead[0]}`);
    await sleep(everyMs);
  }
}

/** Which posts each platform gets now: at most `room`, never one it already had, never past the week's count. */
export function planWeek({ plan, carousels, video, ledger, week, state, roomInQueue }) {
  const picks = {};
  for (const platform of Object.keys(plan.channels)) {
    const had = new Set(Object.entries(ledger.posts ?? {}).filter(([, v]) => v[platform]).map(([id]) => id));
    const thisWeek = Object.values(ledger.posts ?? {}).filter((v) => v[platform]?.week === week).length;
    const ch = state.channels[platform];
    const room = Math.min(
      roomInQueue({ channelScheduled: ch.scheduled, orgScheduled: state.orgScheduled + Object.values(picks).flat().length, perChannelMax: plan.per_channel_queue_max, orgLimit: state.orgLimit }),
      Math.max(0, plan.posts_per_week - thisWeek)
    );
    const list = [];
    if (room > 0 && video && !had.has(video.id)) list.push(video);
    for (const c of carousels) if (list.length < room && !had.has(c.id)) list.push(c);
    picks[platform] = list;
  }
  return picks;
}
