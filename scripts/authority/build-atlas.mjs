import fs from 'node:fs';
const content=JSON.parse(fs.readFileSync('data/authority/content_registry.json','utf8'));const products=JSON.parse(fs.readFileSync('data/products/product_catalog.json','utf8')).products;
const atlas=content.pages.map(p=>{const product=products.find(x=>x.id===p.product_id);return {query:p.title.toLowerCase(),cluster:p.cluster,domain:product?.domain||'dream-wedding-builder',product_id:p.product_id,route:`/guides/${p.slug}`,entity:p.title,conversion_route:product?.route,status:'admitted',source_requirement:'general planning guidance; verify local/vendor-specific facts'};});
fs.mkdirSync('data/authority',{recursive:true});fs.writeFileSync('data/authority/atlas.json',JSON.stringify({version:'2.0.0',records:atlas},null,2));console.log(`Atlas: ${atlas.length} records`);
