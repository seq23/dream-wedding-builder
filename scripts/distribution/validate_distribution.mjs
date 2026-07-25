import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('data/distribution/distribution_contract.json','utf8'));
const m=JSON.parse(fs.readFileSync('artifacts/distribution/manifest.json','utf8'));
const e=[];
if(c.domains.length!==4)e.push('domain contract !=4');
for(const d of c.domains){
  if(!m.domains.some(x=>x.host===d.host&&x.url_count>0))e.push(`missing manifest:${d.host}`);
  if(!fs.existsSync(`artifacts/sitemaps/${d.host}.xml`))e.push(`missing sitemap artifact:${d.host}`);
}
const route='app/sitemap.xml/route.ts';
if(!fs.existsSync(route))e.push('missing live /sitemap.xml route');
else {
  const src=fs.readFileSync(route,'utf8');
  for(const token of ['x-forwarded-host','allowedHosts','product_id','application/xml']) if(!src.includes(token)) e.push(`live sitemap route missing:${token}`);
}
if(e.length){console.error('DREAM DISTRIBUTION FAIL',e);process.exit(1)}
console.log(`DREAM DISTRIBUTION PASS: ${m.domains.length} domains, ${m.domains.reduce((a,x)=>a+x.url_count,0)} URLs, live host-aware sitemap route present`);
