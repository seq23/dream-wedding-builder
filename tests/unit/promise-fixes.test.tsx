// Promise audit fixes, 27 Nov 2026: each test below holds one sentence a person reads on the
// site to what the code really renders. Every one was proven red by undoing its fix (PR body,
// "Mutation proof").
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'weddingchecklistpdf.com' }) }));
const env: { APP_SHARING_ENABLED?: string } = {};
let envFails = false;
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => { if (envFails) throw new Error('no context'); return env; } }));

import { readinessSummary, READINESS_CHECK_COUNT } from '@/lib/readiness';
import { emptyPlan } from '@/data/planning';
import { shippingPages } from '@/lib/authority-registry';
import Guide from '@/app/guides/[slug]/page';
import About from '@/app/about/page';
import SuitePage from '@/app/products/operations-suite/page';
import TwoPhones from '@/app/two-phones/page';
import { BookKitPage } from '@/components/BookKitPage';
import { AffiliatePicks } from '@/components/AffiliatePicks';
import { bookKits, kitOnSale } from '@/lib/book-kits';
import { products } from '@/lib/products';
import manifest from '@/product-builds/manifests/download_manifest.json';
import partners from '@/data/affiliates/partners.json';

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const esc = (s: string) => text(renderToStaticMarkup(<>{s}</>));

describe('the planner shows the readiness score the readiness page documents', () => {
  it('a new plan reads 11% ready with the count and every open input', () => {
    const r = readinessSummary(emptyPlan);
    expect(r.line).toBe(`11% ready: 1 of ${READINESS_CHECK_COUNT} basics answered.`);
    expect(r.open).toHaveLength(READINESS_CHECK_COUNT - 1);
    for (const check of r.open) expect(check.why.length).toBeGreaterThan(20);
  });
  it('the planner page prints the summary line, not a bare count', () => {
    const src = fs.readFileSync('app/free-wedding-planner/page.tsx', 'utf8');
    expect(src).toMatch(/data-testid="plan-readiness"[^>]*>\{readiness\.line\}/);
    expect(src).toContain('data-testid="readiness-open"');
  });
});

describe('every published guide carries the five things the About page promises', () => {
  it('has guides to check', () => expect(shippingPages.length).toBeGreaterThan(10));
  for (const page of shippingPages) {
    it(`/guides/${page.slug} shows its worked example, its mistakes and its boundary`, async () => {
      const html = renderToStaticMarkup(await Guide({ params: Promise.resolve({ slug: page.slug }) }));
      const visible = text(html);
      expect(visible).toContain('Quick answer');
      expect(html).toContain('data-testid="guide-example"');
      const example = page.examples.find((e) => e.title !== 'Control check')!;
      expect(visible).toContain(esc(example.body));
      expect(html).toContain('data-testid="guide-mistakes"');
      for (const mistake of page.mistakes) expect(visible).toContain(esc(mistake));
      expect(visible).toContain(esc(page.verification_boundary));
    });
  }
});

describe('the pages that had no files, delivery or limits now show them', () => {
  const files = (id: string) => manifest.products.find((p) => p.product_id === id)!.files.map((f) => f.path);
  it('the suite page lists the files the download serves, how they arrive, and the limits', () => {
    const visible = text(renderToStaticMarkup(SuitePage()));
    for (const f of files('operations-suite')) expect(visible).toContain(f);
    expect(visible).toContain('Once Stripe confirms your payment');
    expect(visible).toMatch(/Rules, fees and requirements differ by place/);
  });
  for (const kit of bookKits.filter(kitOnSale)) {
    it(`the ${kit.name} page lists its file, how it arrives, and that rules differ by place`, () => {
      const visible = text(renderToStaticMarkup(<BookKitPage kit={kit} />));
      for (const f of files(kit.id)) expect(visible).toContain(f);
      expect(visible).toContain('The emailed link works for 7 days');
      expect(visible).toMatch(/Rules, fees and requirements differ by place/);
    });
  }
});

describe('the About page counts everything on sale', () => {
  it('names one purchase per tool, the suite and every kit on sale', () => {
    const n = products.length + 1 + bookKits.filter(kitOnSale).length;
    const visible = text(renderToStaticMarkup(About()));
    expect(visible).toContain(`${n} one-time purchases, no subscription, no account.`);
    for (const kit of bookKits.filter(kitOnSale)) expect(visible).toContain(kit.name);
  });
});

describe('the partner invite page tells the truth about the sharing switch', () => {
  it('switch unset (production today): says sharing is not on, offers no App Store join', async () => {
    delete env.APP_SHARING_ENABLED; envFails = false;
    const html = renderToStaticMarkup(await TwoPhones());
    expect(html).toContain('data-testid="two-phones-off"');
    expect(html).not.toContain('apps.apple.com');
    expect(text(html)).not.toContain('see your partner’s plan');
  });
  it('an unreadable env counts as off, never as on', async () => {
    env.APP_SHARING_ENABLED = 'true'; envFails = true;
    expect(renderToStaticMarkup(await TwoPhones())).toContain('data-testid="two-phones-off"');
    envFails = false;
  });
  it('switch on: the join screen', async () => {
    env.APP_SHARING_ENABLED = 'true';
    const html = renderToStaticMarkup(await TwoPhones());
    expect(html).toContain('data-testid="two-phones-page"');
    delete env.APP_SHARING_ENABLED;
  });
});

describe('an affiliate link can only reach a page with its disclosure beside it', () => {
  it('a tracked Amazon link renders rel=sponsored and both disclosure sentences next to it', () => {
    const html = renderToStaticMarkup(<AffiliatePicks placement="planner" />);
    // partners.json carries a tracked Amazon URL today, so the planner placement has one.
    expect(html).toMatch(/data-tracked="true"[^>]*rel="sponsored noopener noreferrer"|rel="sponsored noopener noreferrer"[^>]*data-tracked="true"/);
    expect(html).toContain('data-testid="affiliate-disclosure"');
    expect(text(html)).toContain('we may earn a commission');
    expect(text(html)).toContain('As an Amazon Associate we earn from qualifying purchases.');
  });
  it('no page source carries a tracked affiliate URL outside the one component that discloses it', () => {
    const tracked = partners.partners.map((p) => p.affiliate_url).filter((u): u is string => typeof u === 'string');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) { if (name !== '__tests__') walk(p); continue; }
        if (!/\.(tsx?|mjs|json|html|md)$/.test(name) || p === path.join('data', 'affiliates', 'partners.json')) continue;
        const src = fs.readFileSync(p, 'utf8');
        if (tracked.some((u) => src.includes(u)) || /amazon\.com\/[^"'\s]*[?&]tag=/.test(src)) offenders.push(p);
      }
    };
    for (const dir of ['app', 'components', 'lib', 'data', 'public']) walk(dir);
    expect(offenders).toEqual([]);
    // And the only renderer of affiliate links is AffiliatePicks, which always prints the disclosure.
    const users = ['app', 'components'].flatMap((d) => fs.readdirSync(d, { recursive: true }).map(String).map((f) => path.join(d, f)))
      .filter((f) => /\.tsx?$/.test(f) && /\b(linksFor|affiliateLink)\(/.test(fs.readFileSync(f, 'utf8')));
    expect(users).toEqual(['components/AffiliatePicks.tsx']);
  });
});

describe('the journey labels AI text wherever it reuses it', () => {
  it('step 3 (keep what you love) carries the AI label when its picks come from the AI answer', () => {
    const src = fs.readFileSync('components/WeddingJourney.tsx', 'utf8');
    const step3 = src.slice(src.indexOf("data-testid=\"journey-step-3\""), src.indexOf("data-testid=\"journey-step-4\""));
    expect(step3).toContain("read.by === 'ai' && <p data-testid=\"keep-ai-label\"");
    expect(step3).toContain('written by AI, not a person');
  });
});
