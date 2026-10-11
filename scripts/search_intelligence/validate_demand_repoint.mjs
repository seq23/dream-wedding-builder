#!/usr/bin/env node
// Demand repoint (2026-10-11): index coverage, sitemap registration, GSC truth,
// the measured target set, consolidation candidates, the publishing freeze and
// the strengthened pages - each checked for being fresh and consistent with the
// data it was derived from, never for prose. Hard-fails on zero items.
import fs from 'node:fs';
import {read,norm,pageKey,sitemapUrlsFor,GSC_HOST_ENV,daysBetween,now} from './lib.mjs';
import {summarise,WORKERS,PER_HOST_CAP} from './collect_index_coverage.mjs';
import {measurementsFor,gscWindows,volumeRows} from './measured_demand.mjs';
import {freezeDecision,freezeConfig} from './publishing_freeze.mjs';

const FRESH_DAYS=4;
const errors=[]; const fail=m=>errors.push(m);
const hosts=Object.keys(GSC_HOST_ENV);
const today=now();
const stale=(ts,what)=>{if(!ts)return fail(`${what}: no timestamp`);const d=daysBetween(ts,today);if(d>FRESH_DAYS)fail(`${what}: last collected ${ts}, ${d} days ago (limit ${FRESH_DAYS}); the daily job that writes it is not landing`)};

// A. Index coverage.
const cov=read('data/search_intelligence/index_coverage.json',{});
stale(cov.collected_at,'index_coverage.json');
if(WORKERS!==8||PER_HOST_CAP>150)fail(`collect_index_coverage: workers ${WORKERS} / per-host cap ${PER_HOST_CAP}; the contract is 8 parallel calls and <=150 URLs per host per run`);
let coverageUrls=0;
for(const h of hosts){
  const e=cov.hosts?.[h]; if(!e){fail(`index_coverage.json: no entry for ${h}`);continue}
  if(!['OK','PARTIAL','NAMED_STOP','HELD_QUOTA'].includes(e.state))fail(`index_coverage ${h}: unnamed state ${e.state}`);
  if(['NAMED_STOP','HELD_QUOTA'].includes(e.state)&&!e.named_stop)fail(`index_coverage ${h}: ${e.state} without the named stop text`);
  if(!e.urls)continue;
  const sm=sitemapUrlsFor(h);
  if(!sm.length)fail(`artifacts/sitemaps/${h}.xml lists 0 URLs`);
  const got=new Set(e.urls.map(r=>r.url));
  const missing=sm.filter(u=>!got.has(u)), extra=[...got].filter(u=>!sm.includes(u));
  if(missing.length)fail(`index_coverage ${h}: ${missing.length} sitemap URL(s) absent, e.g. ${missing[0]}`);
  if(extra.length)fail(`index_coverage ${h}: ${extra.length} URL(s) not in the sitemap, e.g. ${extra[0]}`);
  if(e.sitemap_url_count!==sm.length)fail(`index_coverage ${h}: sitemap_url_count ${e.sitemap_url_count} != ${sm.length} in the sitemap`);
  if(JSON.stringify(summarise(e.urls))!==JSON.stringify(e.summary))fail(`index_coverage ${h}: stored summary does not match its own rows`);
  const inspected=e.urls.filter(r=>r.coverageState!=='NOT_INSPECTED');
  for(const r of inspected)if(!r.inspected_at)fail(`index_coverage ${h}: ${r.url} has a coverageState but no inspected_at`);
  coverageUrls+=inspected.length;
}
if(!coverageUrls)fail('index_coverage.json: zero inspected URLs across all hosts');

// B. Sitemap registration.
const sms=read('data/search_intelligence/gsc_sitemaps.json',{});
stale(sms.collected_at,'gsc_sitemaps.json');
for(const h of hosts){const e=sms.hosts?.[h];if(!e){fail(`gsc_sitemaps.json: no record for ${h}`);continue}
  if(e.sitemap_url!==`https://${h}/sitemap.xml`)fail(`gsc_sitemaps ${h}: records ${e.sitemap_url}`);
  if(e.state==='NAMED_STOP'){if(!e.named_stop)fail(`gsc_sitemaps ${h}: NAMED_STOP without text`);continue}
  if(e.state!=='LISTED'||e.listed_after!==true)fail(`gsc_sitemaps ${h}: sitemap not listed in Search Console (state ${e.state})`);}

// C. GSC truth.
const truth=read('data/search_intelligence/gsc_truth.json',{});
stale(truth.updated_at,'gsc_truth.json');
for(const h of hosts){const t=truth.hosts?.[h];if(!t){fail(`gsc_truth.json: no window for ${h}`);continue}
  if(!t.period?.start||!t.period?.end||daysBetween(t.period.start,t.period.end)!==27)fail(`gsc_truth ${h}: period ${JSON.stringify(t.period)} is not a 28-day window`);
  if(!Array.isArray(t.queries)||!Array.isArray(t.pages))fail(`gsc_truth ${h}: queries and pages must both be recorded`);
  const pageImp=(t.pages||[]).reduce((s,p)=>s+p.impressions,0);
  if(t.totals&&t.totals.impressions>0&&pageImp===0)fail(`gsc_truth ${h}: property shows ${t.totals.impressions} impressions but no page rows`);}

// D. Target set.
const ctx={gsc:gscWindows(),volumes:volumeRows()};
const ts=read('data/search_intelligence/target_query_set.json',{});
let targetCount=0;
for(const h of hosts){const e=ts.hosts?.[h];if(!e){fail(`target_query_set.json: no entry for ${h}`);continue}
  for(const t of e.targets||[]){targetCount++;
    if(!t.source||!t.metric||!(Number(t.number)>0))fail(`target ${h} "${t.query}": every target carries source + metric + number > 0`);
    const m=measurementsFor(h,t.query,ctx); const same=m.find(x=>x.source===t.source&&x.number===t.number);
    if(!same)fail(`target ${h} "${t.query}": ${t.number} ${t.metric} (${t.source}) is not what the measured sources hold now; rebuild with npm run search:target-set`);}
  for(const d of e.dropped||[]){if(!d.reason)fail(`dropped ${h} "${d.query}" without a reason`);if(measurementsFor(h,d.query,ctx).length)fail(`dropped ${h} "${d.query}" has a measured number; it belongs in targets`)}
  if(e.target_count!==(e.targets||[]).length)fail(`target_query_set ${h}: target_count disagrees with its list`);}
if(!targetCount)fail('target_query_set.json: zero measured targets across all hosts');

// E. Consolidation candidates (listed, never redirected).
const cons=read('data/search_intelligence/consolidation_candidates.json',{});
for(const h of hosts){const e=cons.hosts?.[h];if(!e){fail(`consolidation_candidates.json: no entry for ${h}`);continue}
  const t=truth.hosts?.[h];
  if(t?.pages&&e.state!=='MEASURED')fail(`consolidation ${h}: page truth exists but state is ${e.state}; run npm run search:consolidation`);
  const imp=Object.fromEntries((t?.pages||[]).map(p=>[pageKey(p.page),p.impressions]));
  for(const c of e.candidates||[]){
    if((imp[pageKey(c.url)]||0)!==0)fail(`consolidation ${h}: ${c.url} has ${imp[pageKey(c.url)]} impressions in gsc_truth.json; it is not a 0-impression page`);
    if(!(c.words<c.thin_threshold))fail(`consolidation ${h}: ${c.url} is not below its thin threshold`);
    if(Object.keys(c).some(k=>/redirect/i.test(k))||c.action!=='REVIEW_FOR_CONSOLIDATION')fail(`consolidation ${h}: ${c.url} carries a redirect/action beyond review; this PR makes no redirects`);
  }}
const redirectsSrc=['next.config.ts','middleware.ts'].map(f=>fs.existsSync(f)?fs.readFileSync(f,'utf8'):'').join('\n');
for(const h of hosts)for(const c of cons.hosts?.[h]?.candidates||[]){const p=new URL(c.url).pathname;if(redirectsSrc.includes(`'${p}'`)||redirectsSrc.includes(`"${p}"`))fail(`consolidation candidate ${p} is redirected in next.config/middleware; candidates are review-only`)}

// F. Publishing freeze.
const fz=freezeConfig();
if(!fz||typeof fz.enabled!=='boolean'||!fz.effective_from)fail('config.json publishing_freeze must carry enabled (boolean) and effective_from');
const pub=fs.readFileSync('scripts/authority_scale/publish_authority_batch.mjs','utf8');
if(!/import \{ freezeDecision \} from '\.\.\/search_intelligence\/publishing_freeze\.mjs'/.test(pub)||!/freezeDecision\(seed,/.test(pub))fail('publish_authority_batch.mjs does not call freezeDecision; the freeze would govern nothing');
if(fz?.enabled){
  const unmeasured=freezeDecision({slug:'x',title:'zz unmeasured validator probe qq'},'weddingchecklistpdf.com',ctx);
  if(!unmeasured.frozen)fail('freeze self-test: a seed with no measured target was not frozen');
  const anyTarget=hosts.map(h=>[h,ts.hosts?.[h]?.targets?.[0]]).find(([,t])=>t);
  if(anyTarget){const ok=freezeDecision({slug:'x',target_query:anyTarget[1].query},anyTarget[0],ctx);if(ok.frozen)fail(`freeze self-test: measured target "${anyTarget[1].query}" was frozen; frozen pages must auto-publish once measured`)}
  const ledger=read('data/authority_scale/publication_ledger.json',{runs:[]});
  for(const run of ledger.runs||[])if(String(run.date)>=fz.effective_from)for(const slug of run.slugs||[]){const m=run.target_measurements?.[slug];if(!(Number(m?.number)>0))fail(`publication_ledger ${run.date}: ${slug} was published during the freeze with no measured target number`)}
}

// G. Strengthened pages.
const st=read('data/seo/guide_strengthening.json');
const reg=read('data/authority/content_registry.json');
const hubs=read('data/seo/hub_pages.json');
const own=read('data/seo/route_ownership.json');
const hostFor=pid=>Object.entries(own.hosts).find(([,c])=>c.product_id===pid)?.[0];
const entries=Object.entries(st.guides||{});
if(entries.length<3)fail(`guide_strengthening.json: ${entries.length} guides; the niche checklist guides that rank are the point of this pass`);
const home=fs.readFileSync('app/page.tsx','utf8');
const guideSrc=fs.readFileSync('app/guides/[slug]/page.tsx','utf8');
for(const id of ['guide-definition','guide-product-path','guide-pdf-link','guide-bundle-link','guide-money-link'])if(!guideSrc.includes(`data-testid="${id}"`))fail(`app/guides/[slug]/page.tsx no longer renders ${id}`);
for(const [slug,g] of entries){
  const p=reg.pages.find(x=>x.slug===slug); if(!p){fail(`strengthened guide ${slug} is not in the registry`);continue}
  const host=hostFor(p.product_id);
  if(!g.title.toLowerCase().startsWith(g.h1.toLowerCase()))fail(`${slug}: title "${g.title}" does not lead with its H1`);
  if(g.title.length>60)fail(`${slug}: title ${g.title.length} chars (>60 is cut in results)`);
  if(!norm(g.target_query).startsWith(norm(g.h1)))fail(`${slug}: H1 "${g.h1}" is not aligned to target query "${g.target_query}"`);
  if(!/^an? /i.test(g.definition)||!norm(g.definition).includes(norm(g.h1)))fail(`${slug}: definition must open by defining "${g.h1}"`);
  if((g.faqs||[]).length<3)fail(`${slug}: needs at least 3 FAQs`);
  const pageImp=(truth.hosts?.[host]?.pages||[]).find(x=>pageKey(x.page)===`${host}/guides/${slug}`)?.impressions||0;
  if(!measurementsFor(host,g.target_query,ctx).length&&!pageImp)fail(`${slug}: neither its target query nor the page has a measured Search Console number on ${host}`);
  if(host===st.money_page.host&&!home.includes(`'/guides/${slug}'`))fail(`homepage does not link ${slug}`);
}
const hub=hubs.pages[st.money_page.path.slice(1)];
if(!hub)fail(`money page ${st.money_page.path} is not a hub`);
else{const q=norm(st.money_page.target_query);
  if(!norm(hub.title).startsWith(q))fail(`money page title "${hub.title}" does not lead with "${st.money_page.target_query}"`);
  if(norm(hub.h1)!==q)fail(`money page H1 "${hub.h1}" is not "${st.money_page.target_query}"`);
  if(!norm(hub.intro).startsWith(`a ${q}`))fail('money page intro does not open by defining the query');}

if(errors.length){console.error('DEMAND REPOINT VALIDATION FAIL');for(const e of errors)console.error(`- ${e}`);process.exit(1)}
const b=hosts.map(h=>`${h.replace(/^wedding|\.com$/g,'')} ${cov.hosts[h].summary?.buckets?.indexed??'?'}/${cov.hosts[h].sitemap_url_count??'?'} indexed`).join(', ');
console.log(`demand repoint validation: PASS (${coverageUrls} URLs inspected - ${b}; ${targetCount} measured targets; ${hosts.reduce((s,h)=>s+(cons.hosts[h].candidate_count||0),0)} consolidation candidates; freeze ${fz.enabled?'ON':'off'}; ${entries.length} strengthened guides)`);
