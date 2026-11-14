import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import Link from 'next/link';
import { MAILING_ADDRESS } from '@/lib/nurture';

// Prices and contents are never written here: each product page and the app's store
// sheet show them before payment (data/products/product_catalog.json, the store price).
export const metadata = seoMetadata({
  title: 'Terms of Use',
  description: 'Terms for Dream Wedding products: a purchase grants a limited, non-transferable personal-use license, and every output is an aid you must verify.',
  host: PARENT_HOST,
  path: '/terms'
});

const H2 = 'mt-10 font-serif text-3xl';
const P = 'mt-3 leading-7 text-charcoal/70';

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/50">Dream Wedding product family</p>
      <h1 className="mt-4 font-serif text-6xl">Terms of Use</h1>
      <p className="mt-6 text-lg leading-8 text-charcoal/70" data-testid="terms-answer">
        You may use the free planner and guides without an account. A purchase is paid once and gives you a personal-use
        licence to digital files or to features in the app, shown with the price before you pay. Everything here is general
        planning guidance that you check yourself; it is not a human wedding planner and promises no price, vendor, date or
        outcome.
      </p>

      <h2 className={H2}>Who these terms cover</h2>
      <p className={P}>
        These terms govern the Dream Wedding product family (published as Dream Wedding Builder): weddingchecklistpdf.com,
        weddingbudgetspreadsheet.com, weddingtimelinetemplate.com, weddingseatingchartmaker.com, the Dream Wedding app,
        and every paid file and kit sold on them. The sites and the app are for adults, 18 or older.
      </p>

      <h2 className={H2}>What you get when you buy</h2>
      <p className={P}>
        Each product page lists the exact files, the delivery method and the price before checkout:{' '}
        <Link className="underline underline-offset-4" href="/shop">see every wedding planning tool</Link>. Website purchases
        are paid once through Stripe, with no subscription, and the download link is shown and emailed right after payment.
        App purchases are paid once through the App Store or Google Play, for the wedding event named on the purchase
        screen; the screen lists what the purchase adds before you pay.
      </p>

      <h2 className={H2}>Your licence</h2>
      <p className={P}>
        Purchases grant a limited, non-transferable personal-use license. Files may not be resold, redistributed,
        sublicensed, or published as templates. You may print them and share them with the people helping with your
        wedding.
      </p>

      <h2 className={H2}>Refunds</h2>
      <p className={P}>
        Website purchases follow the <a className="underline underline-offset-4" href="https://weddingchecklistpdf.com/refund-policy">digital product refund policy</a>.
        App purchases are refunded by Apple or Google under their own rules; we cannot refund a store purchase ourselves.
      </p>

      <h2 className={H2}>General guidance, AI and your own checks</h2>
      <p className={P}>
        Product outputs are organizational aids and must be verified against actual contracts, provider requirements, local
        rules, safety obligations, dietary information, accessibility needs, and professional advice. AI answers come from
        free AI models, are labelled as AI, and can be wrong. Tradition and marriage-licence content is general information.
        The full list of limits is on the <a className="underline underline-offset-4" href="https://weddingchecklistpdf.com/disclaimer">disclaimer</a> page.
      </p>

      <h2 className={H2}>Fair use of the free tools</h2>
      <p className={P}>
        The free AI answers have daily limits per visitor so they can stay free. Do not try to get around the limits, send
        automated traffic, or put anything into the tools you have no right to share.
      </p>

      <h2 className={H2}>Other companies</h2>
      <p className={P}>
        Links to registries, retailers and vendors go to sites we do not run, under their own terms. Some may be affiliate
        links, labelled where they appear. Names and trademarks belong to their owners.
      </p>

      <h2 className={H2}>No warranty, and the limit of our liability</h2>
      <p className={P}>
        The tools and files are provided as they are. To the extent the law allows, we are not liable for vendor, venue or
        booking decisions you make using them, and our total liability for any purchase is limited to what you paid for it.
        Nothing here removes a right you have under consumer law.
      </p>

      <h2 className={H2}>Changes and contact</h2>
      <p className={P}>
        We may update these terms as the products change; the version on this page is the one that applies to new use and
        new purchases.
      </p>
      <p className="mt-6 text-sm">Support: <a className="underline" href="mailto:info@weddingchecklistpdf.com">info@weddingchecklistpdf.com</a> · Mail: {MAILING_ADDRESS}</p>
    </article>
  );
}
