import type { HTMLAttributes, ReactNode } from 'react';
export function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`rounded-3xl border border-charcoal/10 bg-linen p-5 shadow-soft ${className}`}>{children}</section>;
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral'|'warning'|'success'|'rose' }) {
  const tones = { neutral: 'bg-charcoal/5 text-charcoal', warning: 'bg-amber-100 text-amber-900', success: 'bg-green-100 text-green-900', rose: 'bg-rose/20 text-charcoal' };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
