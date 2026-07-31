import Link from 'next/link';
export function RelatedLinks({ links }: { links: string[] }) {
  return <section className="no-print rounded-[1.75rem] border border-charcoal/10 bg-white p-7"><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Keep planning</p><div className="mt-4 grid gap-3 md:grid-cols-2">{links.map((href) => <Link key={href} href={href} className="rounded-2xl bg-ivory p-4 font-bold capitalize transition hover:bg-linen">{href.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ')} →</Link>)}</div></section>;
}
