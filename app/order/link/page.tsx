import type { Metadata } from 'next';
import { FreshLinkForm } from '@/components/FreshLinkForm';

export const metadata: Metadata = { title: 'Get your link again', description: 'Already bought? Type the email you bought with and we email your plan and download links again.' };

// Where a buyer gets back to what she paid for: from the footer ("Already bought? Get
// your link again."), from her order email, and from any link of hers that has timed out.
export default async function OrderLink({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return <article className="mx-auto max-w-3xl rounded-[12px] bg-linen p-6 md:p-10" data-testid="order-link-page">
    <h1 className="font-serif text-4xl md:text-5xl">{expired ? 'This link has timed out' : 'Get your link again'}</h1>
    <p className="mt-4 max-w-2xl text-lg leading-8 text-charcoal/70">{expired ? 'Your purchase is safe. Links in the order email work for 7 days. Type the email you bought with and we will send you a fresh one.' : 'Already bought? Type the email you bought with and we will send your plan and downloads to it again. No account and no password.'}</p>
    <FreshLinkForm />
  </article>;
}
