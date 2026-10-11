import { SITE_DEFINITION_ID, siteHome } from '@/lib/site-home';

/** The 40-60 word "<Site> is ..." paragraph rendered directly under a homepage H1.
 *  Its id is the SpeakableSpecification cssSelector in homeSchemaNodes(). */
export function SiteDefinition({ host, className }: { host: string; className?: string }) {
  return <p id={SITE_DEFINITION_ID} data-site-definition="" className={className ?? 'mt-6 max-w-4xl text-lg leading-8 text-charcoal/80'}>{siteHome(host).definition}</p>;
}
