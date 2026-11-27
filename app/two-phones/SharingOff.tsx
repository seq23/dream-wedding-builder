import Link from 'next/link';

/** What an invite link shows while partner sharing is switched off on the server. */
export function SharingOff() {
  return <article data-testid="two-phones-off" className="mx-auto max-w-md rounded-[12px] bg-linen p-6 text-center md:p-10">
    <h1 className="font-serif text-4xl">Partner sharing is not on yet</h1>
    <p className="mt-4 leading-7">Sharing a plan between two phones is not switched on in the Dream Wedding app yet, so this link cannot open a shared plan. Your partner can plan on their own phone with the free planner today.</p>
    <Link href="/free-wedding-planner" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue px-6 py-3 font-bold text-white">Open the free planner</Link>
    <a href="/" className="mt-6 inline-flex min-h-12 items-center underline">Back to Dream Wedding</a>
  </article>;
}
