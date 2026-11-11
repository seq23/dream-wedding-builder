import { decryptPlan, encryptPlan, newShareKey, SHARE_ORIGIN, SHARE_UNAVAILABLE, validateLink, type ShareLink, type SecureRandom } from './crypto';

const MAX_BYTES = 64 * 1024;
export class ShareConflict extends Error {}
/** A confirmed missing capability, distinct from a temporary server/network failure.
 * Keep the public message identical to wrong-key failures. */
export class ShareMissing extends Error {
  constructor() { super(SHARE_UNAVAILABLE); }
}
export interface SharedRevision { plaintext: string; revision: number }
/** Ciphertext is not proof of purchase. The join coordinator must keep shared
 * access separate from personal purchases, and revoke it on a missing share. */
export function shareClient(rng: SecureRandom, transport: typeof fetch = fetch, timeoutMs = 15000) {
  async function request(method: string, id?: string, payload?: object): Promise<Record<string, unknown>> {
    const body = payload ? JSON.stringify(payload) : undefined;
    if (body && new TextEncoder().encode(body).length > MAX_BYTES) throw Error('Shared plan is too large.');
    // A create must also fit later reads and updates, including the largest
    // supported revision, rather than only the smaller POST envelope.
    if (payload && 'ciphertext' in payload) {
      const envelope = JSON.stringify({ ciphertext: payload.ciphertext, revision: Number.MAX_SAFE_INTEGER });
      if (new TextEncoder().encode(envelope).length > MAX_BYTES) throw Error('Shared plan is too large.');
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      return await Promise.race([
        (async () => {
          // Construct afresh: never pass an invite URL or its fragment to fetch.
          const url = `${SHARE_ORIGIN}/api/plan-share${id ? `?id=${id}` : ''}`;
          const response = await transport(url, { method, body, headers: { 'content-type': 'application/json' }, signal: controller.signal, redirect: 'error', credentials: 'omit' });
          if (response.status === 409) throw new ShareConflict('Read the latest plan and merge before trying again.');
          if (response.status === 404 || response.status === 410) throw new ShareMissing();
          if (!response.ok || !response.body) throw Error(SHARE_UNAVAILABLE);
          reader = response.body.getReader();
          let text = ''; let size = 0;
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BYTES) throw Error(SHARE_UNAVAILABLE);
            text += decoder.decode(value, { stream: true });
          }
          const data = JSON.parse(text + decoder.decode());
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(SHARE_UNAVAILABLE);
          return data;
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('No connection. Try sharing again when you are online.')), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer); controller.abort();
      if (reader) void reader.cancel().catch(() => {});
    }
  }
  const revision = (value: unknown): number => {
    if (!Number.isSafeInteger(value) || Number(value) < 1) throw Error(SHARE_UNAVAILABLE);
    return Number(value);
  };
  return {
    async create(plaintext: string): Promise<ShareLink> {
      const key = newShareKey(rng);
      const data = await request('POST', undefined, { ciphertext: encryptPlan(plaintext, key, rng) });
      revision(data.revision);
      return validateLink({ id: typeof data.id === 'string' ? data.id : '', key });
    },
    async read(link: ShareLink): Promise<SharedRevision> {
      validateLink(link);
      const data = await request('GET', link.id);
      if (typeof data.ciphertext !== 'string') throw Error(SHARE_UNAVAILABLE);
      return { plaintext: decryptPlan(data.ciphertext, link.key), revision: revision(data.revision) };
    },
    async write(link: ShareLink, plaintext: string, baseRevision: number): Promise<number> {
      validateLink(link); revision(baseRevision);
      const data = await request('PUT', link.id, { ciphertext: encryptPlan(plaintext, link.key, rng), revision: baseRevision });
      const next = revision(data.revision);
      if (next !== baseRevision + 1) throw Error(SHARE_UNAVAILABLE);
      return next;
    },
    async stop(link: ShareLink): Promise<void> {
      validateLink(link);
      const data = await request('DELETE', link.id);
      if (data.ok !== true) throw Error(SHARE_UNAVAILABLE);
    },
  };
}
