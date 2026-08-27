import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import { Card } from '@/components/Card'; import { disclaimers } from '@/data/disclaimers';
export const metadata = seoMetadata({
  title: 'Disclaimer',
  description: 'Verification boundaries for Dream Wedding Builder guides and products. Estimates and templates are organizational aids, not contract, legal, dietary, or safety advice.',
  host: PARENT_HOST,
  path: '/disclaimer'
});
export default function Disclaimer(){return <Card><h1 className="font-serif text-5xl">Disclaimer</h1><div className="mt-6 grid gap-4 leading-7">{Object.values(disclaimers).map(d=><p key={d}>{d}</p>)}</div></Card>}
