const ORIGIN = 'https://weddingchecklistpdf.com';
export interface DraftInput { description: string; consent: boolean }
export type DraftReply = { ok: boolean; message: string; draft?: Record<string, unknown> };
type Transport = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** No email: the same free allowance as the journey (three a day per visitor, counted on the
 * server). Consent gates sending. No model endpoint or credential belongs on the phone. */
export function aiDraftClient(_storage?: unknown, send: Transport = fetch) {
  let pending = false;
  return {
    async request(input: DraftInput): Promise<DraftReply> {
      if (!input.consent) return { ok: false, message: 'Tick the permission box before sending your sentence.' };
      if (pending) return { ok: false, message: 'Your draft is still being prepared.' };
      pending = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await send(ORIGIN + '/api/ai-draft', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: input.description, consent: true }),
          signal: controller.signal,
        });
        const body = await response.json() as Record<string, unknown>;
        if (!body || typeof body !== 'object') throw new Error('Invalid reply');
        if (!response.ok || body.ok !== true) return { ok: false, message: typeof body.error === 'string' ? body.error : 'Please try again later. You can still fill in your plan by hand.' };
        if (!body.draft || typeof body.draft !== 'object' || Array.isArray(body.draft) || typeof body.note !== 'string') throw new Error('Invalid draft');
        return { ok: true, message: body.note, draft: body.draft as Record<string, unknown> };
      } catch {
        return { ok: false, message: 'The draft helper could not connect. You can still fill in your plan by hand.' };
      } finally { clearTimeout(timer); pending = false; }
    },
  };
}
