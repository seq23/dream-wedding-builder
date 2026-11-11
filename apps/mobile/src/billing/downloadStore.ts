import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import { parseFullPlan, type FullPlanList } from '@core/full-plan';
import { parseTraditionPack, TRADITION_PREVIEWS, type TraditionPack } from '../traditionPacks';
import type { DateStorage } from '../weddingDate';

export const DOWNLOAD_CACHE_KEY = 'dw.billing.downloads.v1';
const ORIGIN = 'https://weddingchecklistpdf.com';
const DOOR = '/api/app-unlock';
const LIMIT = 2 * 1024 * 1024;
const MESSAGE = 'Could not download your full plan. Your saved plan has not changed. Restore your purchase and try again.';
export type ArchiveId = 'printables' | 'day-of-kit';
// Archives are hex-encoded opaque ZIP bytes, retained per person, never shared.
export interface DownloadedPlan { list: FullPlanList; packs: TraditionPack[]; archives?: Partial<Record<ArchiveId, string>> }
interface Cache extends DownloadedPlan { version: 1; userId: string }
const validId = (id: string) => /^\$RCAnonymousID:[a-f0-9]{32}$/.test(id);
const object = (raw: unknown): Record<string, unknown> => raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};

function parseContent(raw: unknown): DownloadedPlan {
  const value = object(raw);
  const list = parseFullPlan(value.list);
  if (!list || !Array.isArray(value.packs) || value.packs.length !== TRADITION_PREVIEWS.length) throw Error(MESSAGE);
  const packs = value.packs.map(parseTraditionPack);
  if (packs.some(p => !p) || new Set(packs.map(p => p?.id)).size !== TRADITION_PREVIEWS.length) throw Error(MESSAGE);
  const archives: Partial<Record<ArchiveId, string>> = {};
  for (const id of ['printables', 'day-of-kit'] as const) {
    const hex = object(value.archives)[id];
    if (hex === undefined) continue;
    if (typeof hex !== 'string' || hex.length > LIMIT * 2 || !/^[a-f0-9]+$/.test(hex) || hex.length % 2) throw Error(MESSAGE);
    const bytes = hexToBytes(hex);
    if (!isZip(bytes)) throw Error(MESSAGE);
    archives[id] = hex;
  }
  return { list, packs: packs as TraditionPack[], ...(Object.keys(archives).length ? { archives } : {}) };
}

// ZIP signatures only: archives are kept opaque and never extracted by the app.
const isZip = (bytes: Uint8Array) => bytes.length >= 22 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
  ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6));

/** Bound the entire response, including stalled bodies and transports ignoring abort.
 * No SDK entitlement or local receipt can substitute for this server request. */
async function assetRequest(transport: typeof fetch, path: string, init: RequestInit, timeoutMs: number, binary = false): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await transport(`${ORIGIN}${path}`, { ...init, signal: controller.signal, redirect: 'error' });
        if (!response.ok) throw Error(MESSAGE);
        // React Native fetch exposes text() without a response stream. Keep the
        // same UTF-8 byte cap and overall deadline on that transport as well.
        if (!response.body) {
          if (binary) {
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length > LIMIT) throw Error(MESSAGE);
            return bytes;
          }
          const text = await response.text();
          if (new TextEncoder().encode(text).length > LIMIT) throw Error(MESSAGE);
          return JSON.parse(text);
        }
        reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > LIMIT) throw Error(MESSAGE);
          chunks.push(value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return binary ? bytes : JSON.parse(new TextDecoder().decode(bytes));
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error(MESSAGE)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
  }
}

/** Content cache only, never an event entitlement. The purchase coordinator must
 * authorize the active event before displaying this list. No paid text is bundled.
 * refresh() is shared by purchase and Restore; read() keeps verified downloads
 * usable offline without retaining bearer IDs in URLs or expiring download links. */
export function downloadStore(storage: DateStorage, transport: typeof fetch = fetch, timeoutMs = 15000) {
  let queue: Promise<unknown> = Promise.resolve();
  async function read(userId: string): Promise<DownloadedPlan | null> {
    if (!validId(userId)) throw Error(MESSAGE);
    const raw = await storage.getItem(DOWNLOAD_CACHE_KEY);
    if (raw === null) return null;
    try {
      const cache = object(JSON.parse(raw));
      if (cache.version !== 1 || cache.userId !== userId) return null;
      return parseContent(cache);
    } catch { throw Error(MESSAGE); }
  }
  function refresh(userId: string): Promise<DownloadedPlan> {
    const job = queue.then(async () => {
      if (!validId(userId)) throw Error(MESSAGE);
      const manifest = object(await assetRequest(transport, DOOR, { method: 'POST', headers: { Authorization: `Bearer ${userId}` } }, timeoutMs));
      if (!Array.isArray(manifest.active) || !manifest.active.includes('full_plan') || !Array.isArray(manifest.downloads)
        || typeof manifest.expiresAt !== 'number' || !Number.isFinite(manifest.expiresAt) || manifest.expiresAt <= Date.now()) throw Error(MESSAGE);
      const active = manifest.active;
      const assets = ['full-plan', ...TRADITION_PREVIEWS.map(p => `tradition-${p.id}`)];
      const archiveIds = (['printables', 'day-of-kit'] as const).filter(id => active.includes(id === 'day-of-kit' ? 'day_of_kit' : id));
      const payloads: unknown[] = [];
      const archives: Partial<Record<ArchiveId, string>> = {};
      for (const id of [...assets, ...archiveIds]) {
        const matches = manifest.downloads.filter(d => object(d).id === id);
        if (matches.length !== 1 || Date.now() >= manifest.expiresAt) throw Error(MESSAGE);
        const path = object(matches[0]).path;
        // Only our relative, signed door is followed. Never send the identity to
        // a download URL, follow redirects, or accept protocol-relative URLs.
        if (typeof path !== 'string' || !/^\/api\/app-unlock\?token=[A-Za-z0-9%_.~-]+$/.test(path)) throw Error(MESSAGE);
        const binary = id === 'printables' || id === 'day-of-kit';
        const payload = await assetRequest(transport, path, { method: 'GET' }, timeoutMs, binary);
        if (binary) {
          if (!(payload instanceof Uint8Array) || !isZip(payload)) throw Error(MESSAGE);
          archives[id] = bytesToHex(payload);
        } else payloads.push(payload);
      }
      const content = parseContent({ list: payloads[0], packs: payloads.slice(1), archives });
      for (let i = 0; i < content.packs.length; i++) if (content.packs[i].id !== TRADITION_PREVIEWS[i].id) throw Error(MESSAGE);
      const cache: Cache = { version: 1, userId, ...content };
      // One write only after every asset passes: a failed download keeps the old cache.
      const serialized = JSON.stringify(cache);
      // Keep the single atomic entry small enough for native storage reads too.
      if (new TextEncoder().encode(serialized).length > LIMIT) throw Error(MESSAGE);
      await storage.setItem(DOWNLOAD_CACHE_KEY, serialized);
      return content;
    });
    queue = job.catch(() => {});
    return job;
  }
  // The identity was recorded only after the server door verified the download.
  // This reads content offline; callers must separately authorize the active event.
  async function saved(): Promise<DownloadedPlan | null> {
    const raw = await storage.getItem(DOWNLOAD_CACHE_KEY);
    if (raw === null) return null;
    try {
      const cache = object(JSON.parse(raw));
      if (cache.version !== 1 || typeof cache.userId !== 'string' || !validId(cache.userId)) throw Error(MESSAGE);
      return parseContent(cache);
    } catch { throw Error(MESSAGE); }
  }
  return { read, refresh, saved };
}
