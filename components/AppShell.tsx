import Link from 'next/link';
import type { ReactNode } from 'react';

const nav = [
  ['Guide', '/build'], ['Summary', '/dashboard'], ['Ideas', '/trends'], ['Photos', '/photos'], ['Pack', '/pack']
];
export function AppShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen pb-20 md:pb-0">
    <header className="no-print sticky top-0 z-30 border-b border-charcoal/10 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-serif text-2xl tracking-tight">Dream Wedding Builder</Link>
        <nav className="hidden gap-2 md:flex">
          {nav.map(([label, href]) => <Link key={href} className="rounded-full px-4 py-2 text-sm hover:bg-white" href={href}>{label}</Link>)}
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    <nav className="no-print fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-charcoal/10 bg-linen md:hidden">
      {nav.map(([label, href]) => <Link key={href} href={href} className="py-3 text-center text-xs font-semibold">{label}</Link>)}
    </nav>
  </div>;
}
