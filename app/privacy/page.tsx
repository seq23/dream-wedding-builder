import Link from 'next/link';
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import { supportEmail } from '@/lib/products';

// Every statement below is checked against this repository rather than written
// from a template. The previous version of this page was two sentences long and
// described a build that no longer exists: it said plan data stays in the browser
// and stopped there, while the running site also loads Microsoft Clarity on conversion
// forms, sends buyers to Stripe, stores order email addresses in D1, and mails
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
    'How the wedding tools handle your plan, payments, order records, downloads and Clarity session recording on public signup and checkout forms.',
  host: PARENT_HOST,
  path: '/privacy'
});

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/50">Dream Wedding product family</p>
      <h1 className="mt-4 font-serif text-6xl">Privacy</h1>
      <p className="mt-6 text-lg leading-8 text-charcoal/70">
        This page describes what the four Dream Wedding sites actually store and send. There are no accounts and no
        login for the planning tools. The planner opens without an email, and its AI answers need none; it asks for an email only to print your plan. Where something leaves your browser, it is named below along with the service that
        receives it.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Planning data stays in your browser</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The free wedding planner, the dashboard, and the printable plan keep your plan in your own browser&rsquo;s local storage,
        under the keys <code>dwb-plan</code>, <code>dwb-scope</code>, and <code>dwb-trends</code>. That data is not sent to a
        server, is not attached to a profile, and is visible only in the browser that created it. Clearing your browser
        storage deletes it, and it does not travel with you to another device.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Your email, when you print your plan</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The planner is free and shows your dated plan without an email. We ask for an email address to open the
        printable copy of your plan. We store that address, whether you
        ticked the optional box for planning emails, the site you were on, and the date, in this site&rsquo;s Cloudflare D1
        database. Your plan itself still stays in your browser. If you leave the box unticked we send you no marketing
        email. If you tick it we send one welcome email, through Resend, with a link back to the planner. Every email we
        send includes an unsubscribe link, and you can
        also write to <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>{supportEmail}</a> to have
        the address removed.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        When you ask the planner to describe your wedding, what you wrote and tapped is sent to a free AI model from Google
        Gemini or OpenRouter, which may use it to improve its products. We do not store it; we keep only a one-way hash of
        your connection&rsquo;s address and the day, to count the three free answers a day. The planner page itself loads no session recording.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        The free checklist sample works the same way: the address you type is stored with the wording you agreed to, the
        sample is emailed through Resend, and up to four short emails follow, at most one every three days, stopping when you
        buy or unsubscribe. After a purchase we send one email asking whether the files helped; we only ever show a reply
        with your permission. Opt-outs are stored as a one-way hash of the address so we never email it again.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Inspiration photos are not uploaded</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The inspiration page has no photo upload. The scope breakdown you get back is produced from the
        category and description you type, in your browser.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70" data-testid="privacy-photos">
        In the free planner, a photo you add is read for its colours in your browser, and nothing is sent. When you choose to let the AI planner look at a photo, the photo is sent to an AI provider that may use it to improve its products, and we do not store it.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Analytics</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The free-sample, idea-submission, and checkout forms on all four domains load Microsoft Clarity, a behavioural analytics
        service, through this site&rsquo;s own loader. Reading guides, browsing informational hubs, and choosing an inspiration
        photo do not load session recording. Recording stops when you leave a form page. Each domain reports into its own Clarity project. Clarity records how pages are used — page views, clicks,
        scrolling, and session replay — and that data is processed by Microsoft under Microsoft&rsquo;s terms, not held here.
        It is used to see where visitors get stuck while signing up, submitting an idea, or buying a tool.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        Pages also load Cloudflare Web Analytics, which counts page views and load times without cookies and without
        tracking individual visitors across sites.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        If you arrive from one of our Pinterest pins, a first-party cookie notes which pin (for 30 days) so we can count
        how many purchases and planner signups our pins lead to. It holds only the pin&rsquo;s name, never your email,
        and is not shared with Pinterest or anyone else.
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
