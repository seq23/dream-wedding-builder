// The rendered half of validate:entity-graph: the JSON-LD nodes lib/site-home.ts
// emits must say exactly what data/seo/entity.json says, on every host.
import { describe, expect, it } from 'vitest';
import entity from '@/data/seo/entity.json';
import ownership from '@/data/seo/route_ownership.json';
import { canonicalUrl, type SiteHost } from '@/lib/site-config';
import { homeSchemaNodes, organizationNode, pageFrameNodes, siteOrganizationNode, webPageNode } from '@/lib/site-home';

const HOSTS = Object.keys(ownership.hosts) as SiteHost[];
const sites = entity.sites as Record<string, { '@id': string; name: string; logo: string; description: string; sameAs: string[] }>;
const sameAsOf = (node: Record<string, unknown>) => (node.sameAs as string[] | undefined) ?? [];
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

describe('entity graph', () => {
  it('has hosts to check', () => { expect(HOSTS.length).toBe(4); });

  it('the brand node is entity.json brand, parented to Spry Labs, with every site as a subOrganization', () => {
    const brand = organizationNode();
    expect(brand['@id']).toBe(entity.brand['@id']);
    expect(brand.name).toBe(entity.brand.name);
    expect(brand.logo).toBe(entity.brand.logo);
    expect(brand.description).toBe(entity.brand.description);
    expect(sameAsOf(brand)).toEqual(entity.brand.sameAs);
    expect((brand.parentOrganization as Record<string, string>)['@id']).toBe('https://billionairehighperformancecoach.com/spry-labs#organization');
    expect((brand.subOrganization as Array<Record<string, string>>).map((item) => item['@id']).sort()).toEqual(HOSTS.map((host) => sites[host]['@id']).sort());
  });

  for (const host of HOSTS) {
    it(`${host}: its own Organization matches entity.json, claims no borrowed or self profile, and sits under the brand`, () => {
      const node = siteOrganizationNode(host);
      const site = sites[host];
      expect(node['@id']).toBe(site['@id']);
      expect(node.name).toBe(site.name);
      expect(node.logo).toBe(site.logo);
      expect(node.description).toBe(site.description);
      expect(sameAsOf(node)).toEqual(site.sameAs);
      for (const url of sameAsOf(node)) {
        expect(HOSTS).not.toContain(hostOf(url));
        expect(entity.brand.sameAs).not.toContain(url);
      }
      expect((node.parentOrganization as Record<string, string>)['@id']).toBe(entity.brand['@id']);
    });

    it(`${host}: every page frame and the homepage carry the brand first, then the site`, () => {
      const frame = pageFrameNodes({ host, path: '/guides', name: 'Guides', description: 'x'.repeat(130), breadcrumbs: [] });
      expect(frame.slice(0, 2).map((node) => node['@id'])).toEqual([entity.brand['@id'], sites[host]['@id']]);
      const home = homeSchemaNodes({ host, path: '/', headline: 'h', description: 'd', faqs: [], steps: [], breadcrumbs: [] });
      const orgs = home.filter((node) => node['@type'] === 'Organization');
      expect(orgs.map((node) => node['@id'])).toEqual([entity.brand['@id'], sites[host]['@id']]);
      const website = home.find((node) => node['@type'] === 'WebSite')!;
      expect((website.publisher as Record<string, string>)['@id']).toBe(sites[host]['@id']);
      expect((webPageNode({ host, path: '/guides', name: 'G', description: 'd' }).publisher as Record<string, string>)['@id']).toBe(sites[host]['@id']);
      expect(canonicalUrl(host, '/')).toBe(`https://${host}/`);
    });
  }
});
