// Guard: the Clarity map holds every canonical host with its owner-supplied project id,
// the loader carries the same map, and only public conversion forms load it.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import clarity from '@/data/clarity_projects.json';
import { CheckoutButton } from '@/components/CheckoutButton';
import { BuilderEmailGate } from '@/components/BuilderEmailGate';
import TrendSubmitForm from '@/app/trends/trend-submit-form';
import { HOSTS, renderHome } from './helpers/site-homes';

const EXPECTED: Record<string, string> = {
  'weddingchecklistpdf.com': 'y7kxxtr48q',
  'weddingbudgetspreadsheet.com': 'y7kzpu45jb',
  'weddingseatingchartmaker.com': 'y7kyy3fwc0',
  'weddingtimelinetemplate.com': 'y7l01t5b04'
};

/*
 * The Search Readiness auditor's own rule (boss-os
 * src/shared/boss/searchReadiness/audit.mjs, `loadsClarity`): a page loads
 * Clarity only when an ENABLED <script> element carries it. A
 * <link rel="preload"> does not execute, and neither does markup inside a
 * comment, <template> or <noscript>. Asserting the bare string
 * '/assets/clarity-loader.js' passed for five weeks while every form and buy
 * page served nothing but a preload (e6/i8, 31 Oct 2026), so these tests
 * assert the executable tag and the string is never enough again.
 */
function loadsClarity(html: string): boolean {
  const active = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  return [...active.matchAll(/<script\b([^>]*)>/gi)].some((m) => {
    const src = /\bsrc\s*=\s*"([^"]*)"/i.exec(m[1])?.[1] ?? '';
    const type = /\btype\s*=\s*"([^"]*)"/i.exec(m[1])?.[1] ?? '';
    if (type && !/^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(type.trim())) return false;
    return /clarity\.ms|clarity\.js|\/clarity[-.]/i.test(src);
  });
}

const hasConversionForm = (html: string) => /<form\b[^>]*data-session-recording/.test(html);

describe('Clarity project map', () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  it('maps exactly the canonical hosts to the expected ids', () => {
    expect(Object.keys(clarity.projects).sort()).toEqual([...HOSTS].sort());
    expect(clarity.projects).toEqual(EXPECTED);
  });
  it('the committed loader resolves every host to its id', () => {
    const loader = readFileSync('public/assets/clarity-loader.js', 'utf8');
    for (const [host, id] of Object.entries(EXPECTED)) expect(loader).toContain(`"${host}":"${id}"`);
    expect(loader).toContain('location.hostname');
  });
  it('the root layout does not load it and the build regenerates it', () => {
    expect(readFileSync('app/layout.tsx', 'utf8')).not.toContain('/assets/clarity-loader.js');
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.build).toContain('scripts/install_clarity.mjs');
  });
});

describe('conversion-only session recording (e9)', () => {
  const loader = readFileSync('public/assets/clarity-loader.js', 'utf8');
  function browser(hostname: string, hasForm: boolean) {
    const scripts: Array<{ src?: string; onload?: () => void }> = [];
    const window = { location: { hostname } } as { location: { hostname: string }; clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] } };
    const document = {
      querySelector: () => hasForm ? {} : null,
      createElement: () => ({}),
      getElementsByTagName: () => [{ parentNode: { insertBefore: (script: typeof scripts[number]) => scripts.push(script) } }]
    };
    return { window, document, scripts, run: () => runInNewContext(loader, { window, document }) };
  }

  for (const [host, id] of Object.entries(EXPECTED)) {
    it(`${host}: an informational page never requests the SDK`, () => {
      const b = browser(host, false);
      b.run();
      expect(b.scripts).toHaveLength(0);
      expect(b.window.clarity).toBeUndefined();
    });
    it(`${host}: a conversion form loads its own project exactly once`, () => {
      const b = browser(host, true);
      b.run(); b.run();
      expect(b.scripts.map((s) => s.src)).toEqual([`https://www.clarity.ms/tag/${id}`]);
    });
  }

  it('does not record previews or unknown hosts', () => {
    const b = browser('localhost', true);
    b.run();
    expect(b.scripts).toHaveLength(0);
  });

  it('stops a delayed SDK when navigation has removed the form', () => {
    const b = browser(HOSTS[0], true);
    b.run();
    b.document.querySelector = () => null;
    b.scripts[0].onload?.();
    expect(b.window.clarity?.q?.map((args) => Array.from(args))).toEqual([['stop']]);
  });

  it('keeps recording on a form when the SDK finishes loading', () => {
    const b = browser(HOSTS[0], true);
    b.run();
    b.scripts[0].onload?.();
    expect(b.window.clarity?.q).toBeUndefined();
  });

  for (const [name, element] of [
    ['checkout', createElement(CheckoutButton, { sku: 'test-sku', price: 9 })],
    ['builder signup', createElement(BuilderEmailGate, { children: 'Planner' })],
    ['idea submission', createElement(TrendSubmitForm)]
  ] as const) {
    it(`${name} renders a marked form and an EXECUTABLE loader script`, () => {
      const html = renderToStaticMarkup(element);
      expect(html).toMatch(/<form\b[^>]*data-session-recording/);
      // The served HTML must carry the loader as a script the browser runs, so
      // recording starts on first paint rather than after hydration.
      expect(loadsClarity(html)).toBe(true);
      expect(html).toMatch(/<script\b[^>]*\bdefer\b[^>]*src="\/assets\/clarity-loader\.js"|<script\b[^>]*src="\/assets\/clarity-loader\.js"[^>]*\bdefer\b/);
      // A preload alone is what shipped the defect; it must not be the only reference.
      expect(html.replace(/<link\b[^>]*>/gi, '')).toContain('/assets/clarity-loader.js');
    });
  }

  for (const host of HOSTS) {
    it(`${host} homepage runs the loader exactly when it renders a conversion form`, () => {
      const html = renderHome(host);
      // e6 and e9 together: a conversion page must execute the loader, and a
      // page without one must not reference it at all.
      expect(loadsClarity(html)).toBe(hasConversionForm(html));
      expect(html.includes('/assets/clarity-loader.js')).toBe(html.includes('<form'));
    });
  }
});
