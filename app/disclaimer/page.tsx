import Link from 'next/link';
import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import { disclaimers } from '@/data/disclaimers';

// One section per legal trip wire for the website, the three tool sites and the app
// (the defense record, 13 Nov 2026). Each line says what the software does today; the
// sources are named beside each section so a change in the code is a change here.
export const metadata = seoMetadata({
  title: 'Disclaimer',
  description: 'What Dream Wedding guides and products can and cannot tell you: estimates and templates organize a plan; they are not legal, dietary, or safety advice.',
  host: PARENT_HOST,
  path: '/disclaimer'
});

const H2 = 'mt-10 font-serif text-3xl';
const P = 'mt-3 leading-7 text-charcoal/70';

export default function Disclaimer() {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-midnight-muted">Dream Wedding product family</p>
      <h1 className="mt-4 font-serif text-6xl">Disclaimer</h1>
      <p className="mt-6 text-lg leading-8 text-charcoal/70" data-testid="disclaimer-answer">
        Dream Wedding gives general wedding planning guidance: checklists, budget lines, schedules, seating records and
        ideas. It is software and printable files, not a human wedding planner, and it never promises a price, a vendor,
        a date, availability or how your day turns out. Check anything that matters with your vendors, your venue, your
        officiant and your local marriage office.
      </p>

      {/* lib/wedding-read.ts, lib/ai-draft.ts: no human reads or writes a plan for you. */}
      <h2 className={H2}>General guidance, not a wedding planner</h2>
      <p className={P}>{disclaimers.professional}</p>
      <p className={P}>
        The plan, the printable packet and the paid files are organisational structure. Nobody at Dream Wedding plans
        your wedding, books anything, calls a vendor or acts for you.
      </p>

      {/* data/planning, the planner disclaimer on /free-wedding-planner and /pack. */}
      <h2 className={H2}>Prices, vendors, dates and availability</h2>
      <p className={P}>{disclaimers.cost}</p>
      <p className={P}>
        Dates in your plan are counted back from the wedding date you enter. They are suggested timings, not deadlines set
        by any vendor or office. Venue types and ideas are examples to ask about; we show no live prices or availability.
      </p>
      <p className={P}>{disclaimers.retailer}</p>

      {/* lib/wedding-read.ts checkRead; components/WeddingJourney.tsx. */}
      <h2 className={H2}>AI answers</h2>
      <p className={P}>
        The free planner can describe your wedding using a free AI model, and the ideas you keep become tasks in your plan; in
        the phone app, the AI draft fills in a first draft of your guests, place and budget. Every AI answer is labelled as
        written by AI, not a person. Before anything you typed goes to the AI, our server tries to remove email addresses,
        phone numbers, street addresses and links; it matches patterns and can miss some, so leave them out. AI can be wrong
        or out of date. Our checks on the planner&rsquo;s answer try to stop it naming businesses, prices or availability,
        and they can miss, so check anything that matters. When no free model
        answers, you get an answer from our fixed lists instead, and it says so.
      </p>

      <h2 className={H2}>Photos you add</h2>
      <p className={P}>{disclaimers.upload}</p>

      {/* apps/mobile/src/traditionPacks.ts (each example links its source). */}
      <h2 className={H2}>Traditions and religious customs</h2>
      <p className={P}>
        Tradition packs and tradition ideas are general information about how a ceremony is often prepared. Customs differ
        by family, faith community, region and officiant. Your officiant, place of worship and families are the authority
        on your ceremony; where we give an example, we link the source it came from.
      </p>

      <h2 className={H2}>Marriage licences and legal steps</h2>
      <p className={P}>
        Marriage licence rules, waiting periods, witnesses and fees are set by each state, county and country, and they
        change. Any mention of them here is general information, not legal advice. Check the current rules with the office
        that issues your licence.
      </p>

      <h2 className={H2}>Vendor names and trademarks</h2>
      <p className={P}>
        Names of businesses, products and services belong to their owners and are used only to describe or link to them.
        Dream Wedding is independent: no registry, retailer, venue or vendor named on these sites owns, endorses or sponsors
        it, and no venue or supplier pays to appear.
      </p>

      {/* lib/affiliates.ts affiliateDisclosure: the line beside every tracked link. */}
      <h2 className={H2}>Affiliate links</h2>
      <p className={P}>
        Some outside links may be affiliate links. Wherever one appears, the line next to it says we may earn a commission,
        at no cost to you; Amazon links also say that as an Amazon Associate we earn from qualifying purchases. A commission
        never decides what we suggest, and affiliate links are marked as sponsored for search engines.
      </p>

      <h2 className={H2}>What we do and never do</h2>
      <ul className="mt-3 grid list-disc gap-2 pl-6 leading-7 text-charcoal/70">
        <li>We do give a dated, general plan and printable files you can check, with an editable workbook in each of the four planning tools.</li>
        <li>We never promise a price, a vendor, a date, availability or an outcome.</li>
        <li>We never present an AI answer as a person&rsquo;s advice.</li>
        <li>We never give legal, financial, dietary, medical or safety advice.</li>
        <li>We never take payment from a venue or vendor to be named.</li>
      </ul>

      <p className="mt-10 leading-7 text-charcoal/70">These boundaries apply to the free planning tools and to every paid product and the app alike. The paid files are organisational structure — checklists, budget lines, schedules, guest records and kits — not quotes, contracts, or professional advice: <Link className="underline underline-offset-4" href="/shop">see what each wedding tool contains</Link>.</p>
      <p className="mt-6 text-sm leading-6 text-midnight-muted">
        See also the <a className="underline underline-offset-4" href="https://weddingchecklistpdf.com/terms">terms of use</a>, the{' '}
        <a className="underline underline-offset-4" href="https://weddingchecklistpdf.com/privacy">privacy policy</a> and the{' '}
        <a className="underline underline-offset-4" href="https://weddingchecklistpdf.com/refund-policy">refund policy</a>.
      </p>
    </article>
  );
}
