import { Card } from '@/components/Card'; import { disclaimers } from '@/data/disclaimers';
export default function Disclaimer(){return <Card><h1 className="font-serif text-5xl">Disclaimer</h1><div className="mt-6 grid gap-4 leading-7">{Object.values(disclaimers).map(d=><p key={d}>{d}</p>)}</div></Card>}
