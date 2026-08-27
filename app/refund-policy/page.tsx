import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
export const metadata = seoMetadata({
  title: 'Refund Policy',
  description: 'Refund terms for digital wedding products. Completed downloads are generally final except where required by law or where the delivered file is materially defective.',
  host: PARENT_HOST,
  path: '/refund-policy'
});
export default function Page(){return <article className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/50">Dream Wedding Builder product family</p><h1 className="mt-4 font-serif text-6xl">Digital Product Refund Policy</h1><p className="mt-6 text-lg leading-8 text-charcoal/70">Because digital products are delivered immediately, completed-download purchases are generally final except where required by law or where the delivered product is materially defective. Contact info@weddingchecklistpdf.com with the order email, product, and issue. Duplicate charges and failed delivery are reviewed promptly.</p><p className="mt-6 text-sm">Support: <a className="underline" href="mailto:info@weddingchecklistpdf.com">info@weddingchecklistpdf.com</a></p></article>}