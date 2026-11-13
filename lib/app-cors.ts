// The phone app's free web preview (dream-wedding-app-preview.pages.dev and its branch
// previews) calls the free journey's endpoint from another origin, so the browser needs
// these headers. The native app sends no Origin and needs none. Only the preview origin
// is let in; every other origin gets no header, and the endpoint's own per-visitor and
// daily limits apply to everyone the same.
const PREVIEW_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?dream-wedding-app-preview\.pages\.dev$/;

export function appCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !PREVIEW_ORIGIN.test(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-dw-test',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}
