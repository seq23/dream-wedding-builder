// Pure logic for scripts/entity/entity_backlink_watch.mjs: no network, no files, so
// tests/unit/entity-watch.test.ts can drive every branch with fixed fetch results.
//
// One profile, one state:
//   ok              resolves (2xx after redirects) and the page names a host it vouches for
//   missing_linkback resolves, but the server-rendered page never names any of our hosts
//   unverifiable    resolves, but the platform renders client-side (Instagram, Gumroad,
//                   Google Maps...), so the absence of our host proves nothing. Named, not a pass.
//   dead            404 or 410: the profile is gone. Removed from sameAs by the self-heal.
//   unreachable     any other failure (5xx, 403/429 bot walls, network). Not proof the
//                   profile is gone, so it is never removed on one bad fetch; it is reported.

export const JS_RENDERED_HOSTS = ['instagram.com', 'gumroad.com', 'maps.google.com', 'google.com', 'goo.gl', 'tiktok.com', 'threads.net', 'x.com', 'twitter.com', 'linkedin.com'];

export function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

export function isJsRendered(url) {
  const host = hostOf(url);
  return JS_RENDERED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** fetchResult: { status: number|null, body: string, error?: string } */
export function classify(url, fetchResult, linkHosts) {
  const status = fetchResult?.status ?? null;
  if (status === 404 || status === 410) return 'dead';
  if (!(status >= 200 && status < 300)) return 'unreachable';
  if (isJsRendered(url)) return 'unverifiable';
  const body = String(fetchResult.body || '').toLowerCase();
  return linkHosts.some((host) => body.includes(host.toLowerCase())) ? 'ok' : 'missing_linkback';
}

/** Every record in entity.json that carries sameAs: the brand and each site. */
export function entityRecords(entity) {
  return [
    { key: 'brand', record: entity.brand, linkHosts: Object.keys(entity.sites) },
    ...Object.entries(entity.sites).map(([host, record]) => ({ key: `sites.${host}`, record, linkHosts: [host] }))
  ];
}

/** The profile field the owner edits to add a link-back, named per platform. */
export function linkbackField(url) {
  const host = hostOf(url);
  if (host.endsWith('pinterest.com')) return 'Pinterest > Settings > Edit profile > Website (and Claimed accounts > Websites)';
  if (host.endsWith('facebook.com')) return 'Facebook Page > Edit Page info > Website';
  if (host.endsWith('youtube.com')) return 'YouTube Studio > Customisation > Basic info > Links';
  if (host.endsWith('github.com')) return 'GitHub > Settings > Public profile > URL';
  return 'the profile\'s website or links field';
}

/**
 * Applies the self-heal to a copy of entity.json and returns what changed.
 * results: Map<url, state>. Dead profiles leave sameAs; pending profiles that now
 * resolve (ok, missing_linkback or unverifiable) are promoted into sameAs. Nothing
 * else moves: an unreachable profile stays where it is.
 */
export function heal(entity, results) {
  const next = structuredClone(entity);
  const removed = [], promoted = [], stops = [], unverifiable = [], unreachable = [];
  for (const { key, linkHosts } of entityRecords(entity)) {
    const record = key === 'brand' ? next.brand : next.sites[key.slice('sites.'.length)];
    const keep = [];
    for (const url of record.sameAs) {
      const state = results.get(url);
      if (state === 'dead') { removed.push({ key, url }); continue; }
      keep.push(url);
      if (state === 'missing_linkback') stops.push({ key, url, field: linkbackField(url), hosts: linkHosts });
      if (state === 'unverifiable') unverifiable.push({ key, url });
      if (state === 'unreachable') unreachable.push({ key, url });
    }
    const stillPending = [];
    for (const url of record.profiles_pending ?? []) {
      const state = results.get(url);
      if (state === 'ok' || state === 'missing_linkback' || state === 'unverifiable') {
        if (!keep.includes(url)) keep.push(url);
        promoted.push({ key, url, state });
        if (state === 'missing_linkback') stops.push({ key, url, field: linkbackField(url), hosts: linkHosts });
      } else stillPending.push(url);
    }
    record.sameAs = keep;
    record.profiles_pending = stillPending;
  }
  return { entity: next, removed, promoted, stops, unverifiable, unreachable, changed: removed.length + promoted.length > 0 };
}
