// Cloudflare Turnstile on the free sample form (security sweep row 8, 3 Nov 2026): the form
// emails whatever address is typed, so a person-check stands in front of it, next to the per-IP
// limit (lib/abuse-limits.ts) and the daily send ceiling (lib/nurture.ts).
// The site key is public by design. The secret is the Worker secret TURNSTILE_SECRET_KEY
// (vault: DWB_TURNSTILE_SECRET_KEY; site key also in the vault as DWB_TURNSTILE_SITE_KEY).
// Widget "dream-wedding-builder-sample" covers the five wedding domains.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFx6-W3YH0yLYpja';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = 'PASS' | 'FAIL' | 'NO_SECRET';

/** Asks Cloudflare whether the token is a solved challenge. No secret = NO_SECRET (callers fail closed). */
export async function verifyTurnstile(secret: string | undefined, token: unknown, ip: string | null, fetchImpl: typeof fetch = fetch): Promise<TurnstileResult> {
  if (!secret) return 'NO_SECRET';
  if (typeof token !== 'string' || !token || token.length > 2048) return 'FAIL';
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const res = await fetchImpl(VERIFY_URL, { method: 'POST', body: form });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean };
    return body.success === true ? 'PASS' : 'FAIL';
  } catch {
    return 'FAIL';
  }
}
