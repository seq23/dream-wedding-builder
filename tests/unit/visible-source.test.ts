import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs module without types
import { visibleSource } from '../../scripts/seo/visible-source.mjs';

// R-ADV-12: lastmod moves only when what a reader sees changes.
describe('visibleSource (lastmod fingerprint of a route file)', () => {
  const before = `export default function About() {\n  return <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12"><h1>About Dream Wedding</h1><p style={{ color: 'red' }}>We build planning tools.</p></header>;\n}`;

  it('ignores a styling-only change (the #93 redesign, 6 Nov 2026)', () => {
    const restyled = before.replace('rounded-[2rem]', 'rounded-[12px]').replace("color: 'red'", "color: 'blue'");
    expect(restyled).not.toBe(before);
    expect(visibleSource(restyled)).toBe(visibleSource(before));
  });

  it('ignores a reformat', () => {
    expect(visibleSource(before.replace(/\n {2}/g, '\n      '))).toBe(visibleSource(before));
  });

  it('still sees a change to the words', () => {
    expect(visibleSource(before.replace('We build planning tools.', 'We build planning tools and checklists.'))).not.toBe(visibleSource(before));
  });

  it('still sees a new component', () => {
    expect(visibleSource(before.replace('<h1>', '<BinderTabs /><h1>'))).not.toBe(visibleSource(before));
  });
});
