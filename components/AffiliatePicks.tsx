import { linksFor, type Placement } from '@/lib/affiliates';

export function AffiliatePicks({ placement, heading = 'Registry and invitations, when you get there' }: { placement: Placement; heading?: string }) {
  const links = linksFor(placement);
  const anyTracked = links.some((link) => link.tracked);
  return <section data-testid="affiliate-picks" data-placement={placement} className="no-print rounded-[1.75rem] border border-charcoal/10 bg-white p-7 md:p-9">
    <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Outside services couples use</p>
    <h2 className="mt-3 font-serif text-3xl md:text-4xl">{heading}</h2>
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      {links.map((link) => <a key={link.id} data-affiliate={link.id} data-tracked={link.tracked ? 'true' : 'false'} href={link.href} rel={link.rel} target="_blank" className="rounded-2xl border border-charcoal/10 bg-linen/60 p-5 transition hover:border-charcoal/25 hover:bg-linen">
        <span className="block font-bold">{link.label} →</span>
        <span className="mt-2 block text-sm leading-6 text-charcoal/65">{link.blurb}</span>
      </a>)}
    </div>
    {anyTracked ? <p className="mt-4 text-xs text-charcoal/55">Some of these are affiliate links: if you sign up or buy through them we may earn a commission, at no cost to you.</p> : null}
  </section>;
}
