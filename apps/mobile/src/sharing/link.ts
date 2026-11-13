import { parseInvite, SHARE_ORIGIN } from './crypto';
/** Convert only our explicit invite shapes. Never pass the key to a server. */
export function sharingRoute(raw: string): string {
  try {
    const url = new URL(raw, SHARE_ORIGIN);
    const native = url.protocol === 'dreamwedding:' && url.hostname === 'two-phones';
    if (!native && (url.origin !== SHARE_ORIGIN || url.pathname !== '/two-phones')) return raw;
    const invite = `${SHARE_ORIGIN}/two-phones?id=${url.searchParams.get('id')}#${url.hash.slice(1)}`;
    parseInvite(invite);
    return `/more/sharing?invite=${encodeURIComponent(invite)}`;
  } catch { return '/more/sharing?invite=invalid'; }
}
