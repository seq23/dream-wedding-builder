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
//   AI read, caps, cache     lib/wedding-read.ts (wedding_reads, wedding_read_cache,
//                            DW_TESTER_IP_HASHES), lib/journey-reach.ts
//   AI draft                 lib/ai-draft.ts (ai_drafts: email and IP hashes only)
//   app                      apps/mobile/src (AsyncStorage, planReach, sharing/,
//                            billing/), lib/plan-share.ts, lib/app-unlock.ts
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
        This page describes what the four Dream Wedding sites and the Dream Wedding app actually store and send. In
        short: your plan stays on your device; what you ask the free AI is sent to a free AI provider that may use it to
        improve its products; we keep your email only if you give it; and we never sell your email or your plan. There
        are no accounts and no login for the planning tools. The planner opens without an email, and its AI answers need none; it asks for an email only to print your plan. Where something leaves your browser, it is named below along with the service that
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
        The free checklist sample works the same way: the address you type is stored with the wording you agreed to, the
        sample is emailed through Resend, and up to four short emails follow, at most one every three days, stopping when you
        buy or unsubscribe. After a purchase we send one email asking whether the files helped; we only ever show a reply
        with your permission. Opt-outs are stored as a one-way hash of the address so we never email it again.
      </p>

      <h2 className="mt-12 font-serif text-4xl">What the free AI is sent, and what we keep</h2>
      <p className="mt-4 leading-7 text-charcoal/70" data-testid="privacy-ai">
        When you ask the planner to describe your wedding, what you wrote (up to 400 characters) and what you tapped,
        your town, guest count, budget range, tradition and the colours read from any photo are sent to a free AI model
        from Google Gemini or OpenRouter. Your email and your connection&rsquo;s address are never sent to it. On these free
        tiers the provider may use what it is sent, and its answer, to improve its products, and Google says people may
        read it to do so. Leave out names and anything private.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        We do not store what you wrote or your photos. For each answer we keep a salted one-way hash of your
        connection&rsquo;s address (for a phone network, of its shared address block), the day, which model answered,
        how many photos the AI saw and whether the answer was one of our own tests, so we can count the three free answers
        a day. When you only tapped choices, the answer is kept for 7 days under those choices and your town, so the next
        person who taps the same things gets it without a new AI call; it holds no words of yours and no photo. A short
        list of hashed addresses of our own testers, kept as a server secret, gets a larger daily allowance, and every
        answer it makes is marked as a test. When you then reach your dated plan we count it once a day for that hashed
        address, with no words, date or email.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        The AI draft of your plan works only after you tick its permission box. It sends your sentence and today&rsquo;s
        date to the same free models, never your email or address; we keep your email and connection&rsquo;s address only
        as salted one-way hashes, to allow one free draft per email. The planner page itself loads no session recording.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Inspiration photos are not uploaded</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The inspiration page has no photo upload. The scope breakdown you get back is produced from the
        category and description you type, in your browser.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70" data-testid="privacy-photos">
        In the free planner, a photo you add is read for its colours in your browser, and nothing is sent. When you tick the box to let the AI planner look at a photo, a smaller copy (about 640 pixels) made on your device is sent to Google Gemini, which may use it to improve its products, and we do not store it.
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
        Checkout for the <Link className="underline underline-offset-4" href="/shop">paid wedding tools and kits</Link> is handled
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

      <h2 className="mt-12 font-serif text-4xl">The Dream Wedding app</h2>
      <p className="mt-4 leading-7 text-charcoal/70" data-testid="privacy-app">
        The app has no account. Your date, tasks, ticks, payments you note, planning details and reminders are kept on your
        phone, and reminders are made on your phone. &ldquo;Describe my wedding&rdquo; and the AI draft send what is
        described above, in the same way. Purchases are made through the App Store or Google Play and checked through
        RevenueCat; we receive the purchase record, not your card. If you share your plan with your partner, it is
        encrypted on your phone and only the encrypted copy is kept on our server; the key stays in the link you send, so
        we cannot read it. A shared copy expires after 90 days, and stopping sharing deletes it. Store builds send one
        signal the first time a plan is reached, carrying a random installation number and nothing else. &ldquo;Delete my
        plan from this phone&rdquo; in More removes what the app kept on that phone.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Submitting a trend idea</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The trend submission form is optional. When a review endpoint is configured, what you type — the idea name,
        description, category, any source link, and the notes fields — is forwarded to that endpoint for review. Do not put
        anything in it you would not want read by a person.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Hosting, sale of data and age</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The sites run on Cloudflare, which handles your connection&rsquo;s address to deliver pages and keeps short
        technical logs for a few days. We never sell or rent your email address or your plan, and we do not use them for
        advertising. The sites and the app are for adults planning a wedding; they are not meant for children, and we do
        not knowingly collect information from anyone under 13.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Questions and requests</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        For a copy or deletion of the order data held against your purchase email, or any other question about this page,
        write to <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>{supportEmail}</a> from the
        address used at checkout.
      </p>
      <p className="mt-6 text-sm leading-6 text-charcoal/55">
        This page describes the behaviour of the software in this product family. It is a factual description, not legal
        advice, and it does not describe the separate practices of Stripe, Microsoft, Resend, Google, OpenRouter, Cloudflare, RevenueCat, Apple or Google Play, which publish their own
        privacy terms.
      </p>
    </article>
  );
}
