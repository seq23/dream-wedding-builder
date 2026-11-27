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
//   trend submissions        app/api/submit-trend/route.ts, lib/trend-ideas.ts
//                            (trend_ideas, migrations/0016_trend_ideas.sql),
//                            components/AdminIdeas.tsx
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
      <p className="text-xs font-bold uppercase tracking-[.25em] text-midnight-muted">Dream Wedding product family</p>
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
        under keys that begin with <code>dwb-</code> (the plan itself is <code>dwb-plan</code>). The stored plan is never
        uploaded as a whole and is not attached to a profile. The parts that do leave your browser are only the ones named
        below: what you send for an AI answer, and the email you give to print your plan. Clearing your browser
        storage deletes it, and it does not travel with you to another device.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Your email, when you print your plan</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The planner is free and shows your dated plan without an email. We ask for an email address to open the
        printable copy of your plan. We store that address, whether you
        ticked the optional box for planning emails, the site you were on, and the date, in this site&rsquo;s Cloudflare D1
        database. Your plan itself still stays in your browser. If you leave the box unticked we send you no marketing
        email. If you tick it we send one welcome email, through Resend, with a link back to the planner. Every welcome,
        sample, planning and review email includes an unsubscribe link (the email that delivers a purchase does not), and you can
        also write to <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>{supportEmail}</a> to have
        the address removed.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        The free checklist sample works the same way: the address you type is stored, and the sample is emailed through
        Resend. Three short planning emails follow, at most one every three days, only if you ticked the optional box and
        then tapped the download button in the sample email to confirm your address; they stop when you buy or unsubscribe.
        Before anything is sent we look up whether the address&apos;s domain can receive mail (a public DNS lookup of the
        domain only, never the address). After a purchase we send one email asking whether the files helped; nothing on these
        sites shows a buyer&rsquo;s reply, and we would only ever show one with your permission. Opt-outs are stored as a
        one-way hash of the address so we never send it a welcome, planning or review email again; if you buy something
        later, the email with your download link still comes.
      </p>

      <h2 className="mt-12 font-serif text-4xl">What the free AI is sent, and what we keep</h2>
      <p className="mt-4 leading-7 text-charcoal/70" data-testid="privacy-ai">
        When you ask the planner to describe your wedding, what you wrote (up to 400 characters) and what you tapped,
        your town, guest count, budget range, tradition and the colours read from any photo are sent to a free AI model
        from Google Gemini or OpenRouter. Before anything you typed is sent, our server tries to remove email addresses, phone
        numbers, street addresses and web links from it; it works by matching patterns and can miss some, so leave them out. Your email, your connection&rsquo;s address and your photos are
        never sent to it. On these free
        tiers the provider may use what it is sent, and its answer, to improve its products, and Google says people may
        read it to do so. Leave out names and anything private.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        We do not store the words you wrote, and your photos never reach us. For each answer we keep a salted one-way hash of your
        connection&rsquo;s address (for an IPv6 address, of its first half, the /64 block a home or phone owns), the day, which model answered
        and whether the answer was one of our own tests, so we can count the three free answers
        a day. When you only tapped choices, the answer is saved under those choices and your town and reused for 7 days,
        so the next person who taps the same things gets it without a new AI call; it holds no words of yours and no photo. A short
        list of hashed addresses of our own testers, kept as a server secret, gets a larger daily allowance, and every
        answer it makes is marked as a test. When you then reach your dated plan we count it once a day for that hashed
        address, with no words, date or email.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        The AI draft of your plan is in the phone app (&ldquo;Add my guests, place and budget&rdquo;); the website planner no
        longer has one. It works only after you tick its permission box. It sends your sentence, with email addresses, phone
        numbers, street addresses and links removed as far as pattern matching can, and today&rsquo;s date to the same free
        models, never your connection&rsquo;s address. It asks for no email. We keep a salted one-way hash of your
        connection&rsquo;s address and the day, to allow three drafts a day. The planner page itself loads no session recording.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Inspiration photos are not uploaded</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The inspiration page has no photo upload. The scope breakdown you get back is produced from the
        category and description you type, in your browser.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70" data-testid="privacy-photos">
        Photos stay on your phone; only the colours are used. In the free planner and the app, a photo you add is read for its colours on your device and the photo itself is never sent anywhere; only the colour values and what you tapped that you love in it go with your answer.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Analytics</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The free-sample, idea-submission, and checkout forms on all four domains load Microsoft Clarity, a behavioural analytics
        service, through this site&rsquo;s own loader. Reading a guide and choosing an inspiration photo do not load session
        recording; a page that carries one of those forms does (the questions page and some hub pages carry the free-sample or
        checkout form). Recording stops when you leave a form page. Each domain reports into its own Clarity project. Clarity records how pages are used — page views, clicks,
        scrolling, and session replay — and that data is processed by Microsoft under Microsoft&rsquo;s terms, not held here.
        It is used to see where visitors get stuck while signing up, submitting an idea, or buying a tool.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        Pages also load Cloudflare Web Analytics, which counts page views and load times without cookies and without
        tracking individual visitors across sites.
      </p>
      <p className="mt-4 leading-7 text-charcoal/70">
        If you arrive from one of our Pinterest pins, a first-party cookie notes which pin (for 30 days) so we can count
        how many purchases and planner signups our pins lead to. It holds only the pin&rsquo;s name, never your email. When
        you buy, the pin&rsquo;s name is added to your Stripe order so the sale can be counted; it is not sent to Pinterest
        or anyone else.
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
        RevenueCat; we receive the purchase record, not your card. Partner sharing is not switched on in the app yet. When
        it is, a shared plan is encrypted on your phone and only the encrypted copy is kept on our server; the key stays in
        the link you send, so we cannot read it. A shared copy expires after 90 days, and stopping sharing deletes it. A store build sends at
        most one signal, the first time a plan is reached, carrying a random installation number and nothing else.
        &ldquo;Delete my plan from this phone&rdquo; in More removes your plan and everything the app kept about it on that
        phone; it keeps only the record of what you bought, so a purchase can be restored, and that random installation number.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Submitting a trend idea</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The trend submission form is optional. What you type — the idea name, description, category, any source link, and
        the notes fields — is saved in this site&rsquo;s own database with the time you sent it, and only the site owner,
        signed in, can read it. It is not published unless an idea is later written into the standout ideas. Do not put
        anything in it you would not want read by a person. To keep the form from being flooded, ideas are counted per
        connection against a one-way hash of your connection&rsquo;s address, and a one-way hash is saved with each idea;
        the address itself is not stored.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Hosting, sale of data and age</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        The sites run on Cloudflare, which handles your connection&rsquo;s address to deliver pages. The site&rsquo;s own
        request logs on Cloudflare are kept for at most 7 days. Every page loads its typefaces from Google Fonts, so Google
        receives your connection&rsquo;s address when the fonts load, and the free-sample form loads Cloudflare Turnstile to
        check that a person is sending it. We never sell or rent your email address or your plan, and we never give them
        to advertisers. The sites and the app are for adults planning a wedding; they are not meant for children, and we do
        not knowingly collect information from anyone under 13.
      </p>

      <h2 className="mt-12 font-serif text-4xl">Questions and requests</h2>
      <p className="mt-4 leading-7 text-charcoal/70">
        For a copy or deletion of the order data held against your purchase email, or any other question about this page,
        write to <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>{supportEmail}</a> from the
        address used at checkout.
      </p>
      <p className="mt-6 text-sm leading-6 text-midnight-muted">
        This page describes the behaviour of the software in this product family. It is a factual description, not legal
        advice, and it does not describe the separate practices of Stripe, Microsoft, Resend, Google, OpenRouter, Cloudflare, RevenueCat, Apple or Google Play, which publish their own
        privacy terms.
      </p>
    </article>
  );
}
