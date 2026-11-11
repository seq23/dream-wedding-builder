import type { DateStorage } from './weddingDate';

const ORIGIN = 'https://weddingchecklistpdf.com';
const KEY = 'dw.ai-signups.v1';
const MARKETING_KEY = 'dw.ai-marketing.v1';
export interface DraftInput { email: string; description: string; consent: boolean; marketing: boolean }
export type DraftReply = { ok: boolean; message: string; draft?: Record<string, unknown> };
type Transport = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** Consent gates even signup. No model endpoint or credential belongs on the phone. */
export function aiDraftClient(storage: DateStorage, send: Transport = fetch) {
  let pending = false;
  return {
    async request(input: DraftInput): Promise<DraftReply> {
      if (!input.consent) return { ok: false, message: 'Tick the permission box before sending your sentence.' };
      if (pending) return { ok: false, message: 'Your draft is still being prepared.' };
      const email = input.email.trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, message: 'Enter a valid email address.' };
      pending = true;
      const post = async (path: string, body: unknown) => {
        const response = await send(ORIGIN + path, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        });
        const value: unknown = await response.json();
        if (!value || typeof value !== 'object') throw new Error('Invalid reply');
        return { response, body: value as Record<string, unknown> };
      };
      const failure = (body: Record<string, unknown>): DraftReply => ({ ok: false, message: typeof body.error === 'string' ? body.error : 'Please try again later. You can still fill in your plan by hand.' });
      try {
        const raw: unknown = JSON.parse(await storage.getItem(KEY) ?? '[]');
        const known = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
        const remembered: unknown = JSON.parse(await storage.getItem(MARKETING_KEY) ?? '[]');
        const optedIn = Array.isArray(remembered) ? remembered.filter((v): v is string => typeof v === 'string') : [];
        if (!known.includes(email) || (input.marketing && !optedIn.includes(email))) {
          // Legacy signup consent means marketing; never send the AI consent field here.
          const signup = await post('/api/builder-signup', { email, marketing: input.marketing === true, source: 'phone-ai-draft' });
          if (!signup.response.ok || signup.body.ok !== true) return failure(signup.body);
          await storage.setItem(KEY, JSON.stringify([...new Set([...known, email])]));
          if (input.marketing) await storage.setItem(MARKETING_KEY, JSON.stringify([...new Set([...optedIn, email])]));
        }
        const result = await post('/api/ai-draft', { email, description: input.description, consent: true });
        if (!result.response.ok || result.body.ok !== true) return failure(result.body);
        if (!result.body.draft || typeof result.body.draft !== 'object' || Array.isArray(result.body.draft) || typeof result.body.note !== 'string') throw new Error('Invalid draft');
        return { ok: true, message: result.body.note, draft: result.body.draft as Record<string, unknown> };
      } catch {
        return { ok: false, message: 'The draft helper could not connect. You can still fill in your plan by hand.' };
      } finally { pending = false; }
    },
  };
}
