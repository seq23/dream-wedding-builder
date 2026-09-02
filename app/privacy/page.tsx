import Link from 'next/link';
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import { supportEmail } from '@/lib/products';

// Every statement below is checked against this repository rather than written
// from a template. The previous version of this page was two sentences long and
// described a build that no longer exists: it said plan data stays in the browser
// and stopped there, while the running site also loads Microsoft Clarity on every
// page, sends buyers to Stripe, stores order email addresses in D1, and mails
// download links through Resend. None of that was disclosed. Sources, in order of
// the sections below:
//   localStorage keys        app/free-wedding-planner/page.tsx, app/pack/page.tsx,
//                            app/dashboard/page.tsx, components/TrendCard.tsx,
//                            components/TrendCatalogue.tsx
//   photo handling           app/photos/page.tsx (reads files[0].name only; the
//                            file itself is never put on the network)
//   analytics                app/layout.tsx, scripts/install_clarity.mjs,
//                            data/clarity_projects.json
//   payment                  app/api/checkout/route.ts, lib/checkout-contract.ts
//   stored order data        migrations/0001_fulfillment.sql
//   delivery email           app/api/stripe-webhook/route.ts
//   trend submissions        app/api/submit-trend/route.ts
export const metadata = seoMetadata({
  title: 'Privacy',
  description:
    'What this site stores and sends: plan data stays in your browser, Stripe handles payment, order emails and downloads are recorded, and Clarity runs on every page.',
  host: PARENT_HOST,
  path: '/privacy'
});

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/50">Dream Wedding Builder product family</p>
      <h1 className="mt-4 font-serif text-6xl">Privacy</h1>
      <p className="mt-6 text-lg leading-8 text-charcoal/70">
        This page describes what the four Dream Wedding Builder sites actually store and send. There are no accounts and no
        login for the planning tools. Where something leaves your browser, it is named below along with the service that
        receives it.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Planning data stays in your browser</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The planning builder, the dashboard, and the starter pack keep your plan in your own browser&rsquo;s local storage,
        under the keys <code>dwb-plan</code>, <code>dwb-scope</code>, and <code>dwb-trends</code>. That data is not sent to a
        server, is not attached to a profile, and is visible only in the browser that created it. Clearing your browser
        storage deletes it, and it does not travel with you to another device.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Inspiration photos are not uploaded</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        When you choose a photo on the inspiration page, the page reads the file name so it can show you what you selected.
        The image itself is not placed on the network by this site. The scope breakdown you get back is produced from the
        category and description you type, in your browser.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Analytics</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        Every page on all four domains loads Microsoft Clarity, a behavioural analytics service, from this site&rsquo;s own
        origin. Each domain reports into its own Clarity project. Clarity records how pages are used — page views, clicks,
        scrolling, and session replay — and that data is processed by Microsoft under Microsoft&rsquo;s terms, not held here.
        It is used to see which pages work and which do not.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Buying a product</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        Checkout for the <Link className="underline underline-offset-4" href="/shop">four paid wedding tools</Link> is handled
        by Stripe on Stripe&rsquo;s own hosted checkout page. Card numbers are entered on Stripe and are never received or
        stored by this site.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        When Stripe confirms a payment, this site records the order so it can deliver the files and let you recover them
        later. What is recorded is: the email address Stripe reports for the purchase, the product and SKU bought, the amount
        and currency, the payment status, the Stripe session and event identifiers, and the download activity for that order,
        including how many times a file has been downloaded and when it was last downloaded. Delivery attempts are recorded
        with their outcome.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        The email carrying your download link is sent through Resend, an email delivery provider. Resend receives the
        recipient address and the message; its message identifier is stored with the delivery record.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Submitting a trend idea</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The trend submission form is optional. When a review endpoint is configured, what you type — the idea name,
        description, category, any source link, and the notes fields — is forwarded to that endpoint for review. Do not put
        anything in it you would not want read by a person.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Questions and requests</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        For a copy or deletion of the order data held against your purchase email, or any other question about this page,
        write to <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>{supportEmail}</a> from the
        address used at checkout.
      </p>
      <p className="mt-6 text-sm leading-6 text-charcoal/55">
        This page describes the behaviour of the software in this product family. It is a factual description, not legal
        advice, and it does not describe the separate practices of Stripe, Microsoft, or Resend, which publish their own
        privacy terms.
      </p>
    </article>
  );
}
