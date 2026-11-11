import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

export const SHARE_UNAVAILABLE = 'Shared plan unavailable. Ask your partner for a new link.';
export const SHARE_ORIGIN = 'https://weddingchecklistpdf.com';
export interface ShareLink { id: string; key: string }
const hex = /^[a-f0-9]{64}$/;
export function validateLink(link: ShareLink) {
  if (!hex.test(link.id) || !hex.test(link.key)) throw Error(SHARE_UNAVAILABLE);
  return link;
}
export function inviteLink(link: ShareLink) {
  validateLink(link);
  return `${SHARE_ORIGIN}/two-phones?id=${link.id}#${link.key}`;
}
export function parseInvite(raw: string): ShareLink {
  try {
    const url = new URL(raw);
    if (url.origin !== SHARE_ORIGIN || url.pathname !== '/two-phones' || url.searchParams.getAll('id').length !== 1) throw Error();
    return validateLink({ id: url.searchParams.get('id') ?? '', key: url.hash.slice(1) });
  } catch { throw Error(SHARE_UNAVAILABLE); }
}
/** The caller supplies the platform's secure RNG (Expo Crypto on native).
 * Never use Math.random, timestamps or identifiers as keys or nonces. */
export type SecureRandom = (length: number) => Uint8Array;
function random(rng: SecureRandom, length: number) {
  const bytes = rng(length);
  if (!(bytes instanceof Uint8Array) || bytes.length !== length) throw Error('Secure randomness unavailable.');
  return bytes;
}
export const newShareKey = (rng: SecureRandom) => bytesToHex(random(rng, 32));
export function encryptPlan(plaintext: string, key: string, rng: SecureRandom) {
  if (!hex.test(key)) throw Error(SHARE_UNAVAILABLE);
  const nonce = random(rng, 24);
  const sealed = xchacha20poly1305(hexToBytes(key), nonce).encrypt(new TextEncoder().encode(plaintext));
  const bytes = new Uint8Array(nonce.length + sealed.length);
  bytes.set(nonce); bytes.set(sealed, nonce.length);
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
}
export function decryptPlan(ciphertext: string, key: string) {
  try {
    if (!hex.test(key) || !/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext)) throw Error();
    const bytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    if (bytes.length < 40) throw Error();
    return new TextDecoder('utf-8', { fatal: true }).decode(xchacha20poly1305(hexToBytes(key), bytes.slice(0, 24)).decrypt(bytes.slice(24)));
  } catch { throw Error(SHARE_UNAVAILABLE); }
}
