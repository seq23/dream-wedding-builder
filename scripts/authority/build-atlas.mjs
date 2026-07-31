import fs from 'node:fs';
const content = JSON.parse(fs.readFileSync('data/authority/content_registry.json', 'utf8'));
const products = JSON.parse(fs.readFileSync('data/products/product_catalog.json', 'utf8')).products;
const hubs = JSON.parse(fs.readFileSync('data/seo/hub_pages.json', 'utf8')).pages;
const guides = content.pages.map((page) => {
  const product = products.find((item) => item.id === page.product_id);
  return { query: page.title.toLowerCase(), semantic_key: page.semantic_key, cluster: page.cluster, domain: product?.domain, product_id: page.product_id, route: `/guides/${page.slug}`, entity: page.title, conversion_route: product?.route, hub_route: page.hub_route, status: 'admitted', source_requirement: page.verification_boundary };
});
const hubRecords = Object.entries(hubs).map(([slug, page]) => ({ query: page.title.toLowerCase(), semantic_key: `hub:${slug}`, cluster: 'SEO trunk/product preview', domain: page.host, product_id: page.product_id, route: `/${slug}`, entity: page.h1, conversion_route: products.find((item) => item.id === page.product_id)?.route, hub_route: `/${slug}`, status: 'admitted', source_requirement: 'General planning guidance; external requirements must be verified.' }));
const atlas = [...hubRecords, ...guides];
fs.mkdirSync('data/authority', { recursive: true });
fs.writeFileSync('data/authority/atlas.json', JSON.stringify({ version: '3.0.0', records: atlas }, null, 2) + '\n');
console.log(`Atlas: ${atlas.length} records (${hubRecords.length} hubs, ${guides.length} guides)`);
