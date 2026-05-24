import { Card, Badge } from './Card';
export function PlannerTip({ type, text }: { type: string; text: string }) {
  return <Card className="bg-white/80 shadow-none"><Badge tone={type.includes('Skimp') || type.includes('Warning') ? 'warning' : 'rose'}>{type}</Badge><p className="mt-3 text-sm leading-6 text-charcoal/80">{text}</p></Card>;
}
