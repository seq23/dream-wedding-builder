import { describe, expect, it } from 'vitest';
import { appCorsHeaders } from '@/lib/app-cors';

describe('the free journey endpoint lets in only the phone app preview', () => {
  it('answers the preview and its branch previews', () => {
    expect(appCorsHeaders('https://dream-wedding-app-preview.pages.dev')['access-control-allow-origin']).toBe('https://dream-wedding-app-preview.pages.dev');
    expect(appCorsHeaders('https://app-journey.dream-wedding-app-preview.pages.dev')['access-control-allow-origin']).toBe('https://app-journey.dream-wedding-app-preview.pages.dev');
  });
  it('gives any other origin nothing', () => {
    for (const o of [null, '', 'https://evil.example', 'https://dream-wedding-app-preview.pages.dev.evil.example', 'http://dream-wedding-app-preview.pages.dev', 'https://xdream-wedding-app-preview.pages.dev']) expect(appCorsHeaders(o)).toEqual({});
  });
});
