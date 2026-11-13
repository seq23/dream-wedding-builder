// Guard for a Search Readiness Checklist failure found on 26 Oct 2026.
//
// b3 (one H1): /free-wedding-planner shipped two <h1> elements, because
// BuilderEmailGate drew its own <h1> over a page that keeps rendering its own.
// aria-hidden and inert hide the covered page from assistive tech but not from a
// crawler, so both headings were in the markup.
//
// The f6/b10 brand checks (every title names its site) moved to the rendered
// check that already reads every sitemap URL: validate:rendered-seo.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ownership from '@/data/seo/route_ownership.json';
import PlannerPage from '@/app/free-wedding-planner/page';
import { hubBySlug } from '@/lib/seo';
import { HOSTS } from './helpers/site-homes';

describe('one H1 per page (checklist b3)', () => {
  const countH1 = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

  // 10 Nov 2026: the email wall is gone. The planner renders for everyone, so the
  // server HTML is the planner itself, with its one h1 and the date field, and no
  // email form in front of it.
  it('the planner renders its one h1 and the date field with no email wall', () => {
    const html = renderToStaticMarkup(<PlannerPage />);
    expect(html).toContain('What should your wedding feel like?');
    expect(countH1(html)).toBe(1);
    expect(html).toContain('data-testid="wedding-date"');
    expect(html).not.toContain('data-testid="builder-email-gate"');
    expect(html).not.toContain('type="email"');
  });

  for (const host of HOSTS) {
    const cfg = (ownership.hosts as Record<string, { root_action: string; root_target: string }>)[host];
    if (cfg.root_action === 'render') continue;
    it(`${host} hub page declares exactly one h1 in its data`, () => {
      expect(hubBySlug(cfg.root_target.replace(/^\//, '')).h1.trim().length).toBeGreaterThan(0);
    });
  }
});
