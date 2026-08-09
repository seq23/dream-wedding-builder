import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync('data/products/product_catalog.json','utf8'));
const prices=Object.fromEntries(catalog.products.map(p=>[p.id,p.price]));
const expected={'seating-chart-maker':19,'budget-spreadsheet':12,'timeline-template':12,'checklist-pdf':9,'operations-suite':39};
const errors=[];
for(const [id,price] of Object.entries(expected)) if(prices[id]!==price) errors.push(`${id} price must be ${price}`);
for(const p of catalog.products){ if(!p.image)errors.push(`${p.id} missing image`); if(!p.cta||!p.cta.includes(`$${p.price}`))errors.push(`${p.id} CTA missing price`); }
for(const file of ['app/admin/page.tsx','app/admin/login/page.tsx','app/api/admin/products/route.ts','app/api/admin/products/[id]/route.ts','data/authority/authority_destination_policy.json','app/shop/compare/page.tsx','app/products/operations-suite/page.tsx']) if(!fs.existsSync(file))errors.push(`missing ${file}`);

const adminStore=fs.readFileSync('lib/admin-store.ts','utf8');
if(!adminStore.includes('https://api.github.com/repos/${repo}')) errors.push('paid binary storage must verify repository metadata from GitHub');
if(!adminStore.includes('metadata?.private!==true')) errors.push('paid binary storage must fail closed unless GitHub reports private=true');
if(adminStore.includes("process.env.GITHUB_REPOSITORY_PRIVATE!=='true'")) errors.push('paid binary storage must not trust self-declared GITHUB_REPOSITORY_PRIVATE as the authority');

const policy=JSON.parse(fs.readFileSync('data/authority/authority_destination_policy.json','utf8')); if(policy.primary_destinations.length!==4)errors.push('authority policy must define four paid destinations');
if(errors.length){console.error(errors.join('\n'));process.exit(1)} console.log('conversion/admin validator passed');
