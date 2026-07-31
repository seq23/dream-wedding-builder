import Link from 'next/link';
import { JsonLd } from './JsonLd';

type Item = { name: string; href: string; canonical: string };
export function Breadcrumbs({ items }: { items: Item[] }) {
  return <>
    <nav aria-label="Breadcrumb" className="no-print text-sm text-charcoal/55">
      <ol className="flex flex-wrap items-center gap-2">{items.map((item, index) => <li key={item.canonical} className="flex items-center gap-2">{index > 0 && <span aria-hidden="true">/</span>}<Link className="underline decoration-charcoal/20 underline-offset-4 hover:decoration-charcoal" href={item.href}>{item.name}</Link></li>)}</ol>
    </nav>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.canonical })) }} />
  </>;
}
