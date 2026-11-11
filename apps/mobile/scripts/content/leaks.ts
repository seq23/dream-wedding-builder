import { createHash } from 'node:crypto';
export const words = (text: string) => text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const hash = (tokens: string[]) => createHash('sha256').update(tokens.join(' ')).digest('hex');
export interface Fingerprint { prefix: string; length: number; digest: string }
export function fingerprint(text: string): Fingerprint {
  const tokens = words(text);
  if (tokens.length < 4) throw Error('Private content must contain at least four words');
  return { prefix: hash(tokens.slice(0, 4)), length: tokens.length, digest: hash(tokens) };
}
export function leaks(text: string, entries: Fingerprint[]): boolean {
  if (!entries.length) throw Error('No private content fingerprints supplied');
  const prefixes = new Map<string, Fingerprint[]>();
  for (const entry of entries) prefixes.set(entry.prefix, [...(prefixes.get(entry.prefix) ?? []), entry]);
  // Decode source string escapes before normalizing so wrapping with escaped
  // newlines or punctuation does not hide copied task text.
  const tokens = words(text.replace(/\\[nrt]/g, ' '));
  for (let i = 0; i <= tokens.length - 4; i++) {
    const candidates = prefixes.get(hash(tokens.slice(i, i + 4)));
    if (candidates?.some(e => hash(tokens.slice(i, i + e.length)) === e.digest)) return true;
  }
  return false;
}
