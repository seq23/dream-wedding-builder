import Link from 'next/link';
import { hrefFrom } from '@/lib/site-config';
// fromHost is the host the page renders on: a related path owned by a sibling host
// is linked at its final URL there rather than through a cross-host 308.
export function RelatedLinks({ links, fromHost }: { links: string[]; fromHost: string }) {
  return <section className="no-print rounded-[1.75rem] border border-charcoal/10 bg-white p-7"><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Keep planning</p><div className="mt-4 grid gap-3 md:grid-cols-2">{links.map((href) => <Link key={href} href={hrefFrom(fromHost, href)} className="rounded-2xl bg-ivory p-4 font-bold capitalize transition hover:bg-linen">{href.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ')} →</Link>)}</div></section>;
}
