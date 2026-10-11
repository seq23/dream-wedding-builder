// Guard: a 40-60 word "<Site> is ..." definition paragraph sits directly under each
// homepage H1, and the WebPage SpeakableSpecification selector resolves to it.
import { describe, expect, it } from 'vitest';
import { SPEAKABLE_SELECTOR, siteHome } from '@/lib/site-home';
import { HOSTS, jsonLdNodes, renderHome } from './helpers/site-homes';

describe('homepage definition paragraph + speakable', () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  for (const host of HOSTS) {
    it(host, () => {
      const html = renderHome(host);
      const after = html.slice(html.indexOf('</h1>') + 5);
      const m = after.match(/^<p id="([^"]+)"[^>]*>([^<]+)<\/p>/);
      expect(m, 'the element immediately after </h1> must be the definition paragraph').toBeTruthy();
      const text = m![2].replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
      const words = text.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(40);
      expect(words).toBeLessThanOrEqual(60);
      expect(text.startsWith(`${siteHome(host).name} is `)).toBe(true);
      expect(SPEAKABLE_SELECTOR).toMatch(/^#[A-Za-z][\w-]*$/);
      expect(m![1]).toBe(SPEAKABLE_SELECTOR.slice(1));
      expect(html.split(`id="${SPEAKABLE_SELECTOR.slice(1)}"`).length - 1).toBe(1);
      const page = jsonLdNodes(html).find((n) => n['@type'] === 'WebPage') as { speakable: { '@type': string; cssSelector: string[] } };
      expect(page.speakable['@type']).toBe('SpeakableSpecification');
      expect(page.speakable.cssSelector).toEqual([SPEAKABLE_SELECTOR]);
    });
  }
});
