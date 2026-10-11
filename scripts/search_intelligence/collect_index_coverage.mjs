#!/usr/bin/env node
// Index coverage and sitemap registration, per host, measured by Search Console.
//
// Why (2026-10-11): four hosts, 128 sitemap URLs, and 28-day impressions of
// 57 / 51 / 8 / 2. Whether Google had indexed, crawled, or merely discovered the
// pages was never measured in this repo: the daily job PUT the sitemap and wrote
// "SUBMITTED", which says nothing about what the property holds or what is
// indexed. This step runs in the daily content job (full-safe-autonomy.yml) and
// commits two files:
//   data/search_intelligence/index_coverage.json  URL Inspection per sitemap URL,
//       counts by coverageState per host
//   data/search_intelligence/gsc_sitemaps.json    sitemaps.list per host, with a
//       sitemaps.submit only when the host's sitemap is not listed, and a
//       sitemaps.delete for any http:// or www. variant of it (staleSitemaps)
//
// Stale variants (2026-10-11): sc-domain:weddingbudgetspreadsheet.com carried
// http://www.weddingbudgetspreadsheet.com/sitemap.xml next to the apex one, with
// 2 errors, because www redirects to the apex. A domain property should list one
// sitemap per host: https://<host>/sitemap.xml. Run with --sitemaps-only to do
// the registration part alone (search-intelligence.yml dispatch step).
// validate_demand_repoint.mjs checks both are fresh and consistent with the
// committed sitemaps.
//
// Quota: URL Inspection allows 2,000 calls/day/property. This step caps itself at
// PER_HOST_CAP (150) per host per run and inspects the URLs with the oldest result
// first, so a sitemap larger than the cap rotates through over several days and
// every row carries its own inspected_at. Calls run 8 at a time (one inspect is
// ~6 s; serial runs of ~100 URLs were cancelled at 10 min in p-n-p).
//
// Outcomes, never a silent zero:
//   no credential            NAMED_STOP, exit 0; an existing file is left as is
//   401/403 on a host        that host NAMED_STOP with the owner step; others go on
//   429 on a host            that host HELD_QUOTA; inspected rows are kept
//   nothing inspected at all exit 1
import {read,write,now,gscToken,GSC_HOST_ENV,sitemapUrlsFor} from './lib.mjs';

const OUT='data/search_intelligence/index_coverage.json';
const SITEMAPS_OUT='data/search_intelligence/gsc_sitemaps.json';
export const WORKERS=8;
export const PER_HOST_CAP=150;
const BUCKETS=[['indexed',/^(submitted and indexed|indexed, not submitted in sitemap|indexed)/i],['crawled_not_indexed',/crawled - currently not indexed/i],['discovered_not_indexed',/discovered - currently not indexed/i],['unknown_to_google',/url is unknown to google/i]];
export const bucketOf=s=>s==='NOT_INSPECTED'?'not_inspected':(BUCKETS.find(([,rx])=>rx.test(s||''))?.[0]||'other');
export function summarise(rows){
  const by_coverage_state={},buckets={indexed:0,crawled_not_indexed:0,discovered_not_indexed:0,unknown_to_google:0,other:0,not_inspected:0};
  for(const r of rows){const s=r.coverageState||'UNKNOWN';by_coverage_state[s]=(by_coverage_state[s]||0)+1;buckets[bucketOf(s)]++}
  return {by_coverage_state:Object.fromEntries(Object.entries(by_coverage_state).sort()),buckets};
}
// Listed sitemaps that are the host's own sitemap under the wrong scheme or a
// www. prefix. Anything else (another path, another host) is left alone.
export function staleSitemaps(paths,host){
  const canonical=`https://${host}/sitemap.xml`;
  return paths.filter(p=>{try{const u=new URL(p);return p!==canonical&&u.hostname.replace(/^www\./,'')===host&&u.pathname==='/sitemap.xml'}catch{return false}});
}
const notInspected=(url,why)=>({url,verdict:null,coverageState:'NOT_INSPECTED',lastCrawlTime:null,indexingState:null,googleCanonical:null,userCanonical:null,inspected_at:null,not_inspected_reason:why});

async function pool(items,n,fn){const out=new Array(items.length);let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k])}}));return out}

async function main(){
  const sitemapsOnly=process.argv.includes('--sitemaps-only');
  const raw=process.env.GSC_SERVICE_ACCOUNT_JSON||'';
  const previous=read(OUT,{hosts:{}});
  const hosts=Object.keys(GSC_HOST_ENV);
  if(!raw){
    const stop='NAMED STOP index-coverage: GSC_SERVICE_ACCOUNT_JSON is not set in this environment. Owner step: add the repository secret GSC_SERVICE_ACCOUNT_JSON with the gsc-bot service-account JSON (the same one local-guides-citation-velocity uses).';
    console.log(stop); return 0;
  }
  const sa=JSON.parse(raw);
  const access=await gscToken(sa,'https://www.googleapis.com/auth/webmasters');
  const auth={authorization:`Bearer ${access}`};
  const coverage={schema_version:'1.0.0',truth_source:'google_search_console_url_inspection',collected_at:now(),
    truth_boundary:'URL Inspection reports Google\'s index state per URL at inspected_at. It is not a ranking or traffic measure; impressions live in gsc_truth.json.',
    quota:{daily_limit_per_property:2000,per_host_cap:PER_HOST_CAP,workers:WORKERS},hosts:{}};
  const sitemaps={schema_version:'1.0.0',collected_at:now(),hosts:{}};
  let inspectedTotal=0;
  for(const host of hosts){
    const site=process.env[GSC_HOST_ENV[host]]||'';
    const urls=sitemapUrlsFor(host);
    const sitemapUrl=`https://${host}/sitemap.xml`;
    if(!urls.length){console.error(`index-coverage: artifacts/sitemaps/${host}.xml lists 0 URLs; an empty sitemap is a failure, not an empty success`);return 1}
    if(!site){
      const stop=`NAMED STOP index-coverage ${host}: ${GSC_HOST_ENV[host]} is unset, so no property can be addressed. Owner step: add that repository secret (sc-domain:${host}).`;
      console.log(stop);
      coverage.hosts[host]={...(previous.hosts?.[host]||{}),state:'NAMED_STOP',named_stop:stop};
      sitemaps.hosts[host]={state:'NAMED_STOP',named_stop:stop,sitemap_url:sitemapUrl};
      continue;
    }
    // Sitemap registration: list, submit only if absent, list again.
    const smBase=`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`;
    try{
      const list=async()=>{const r=await fetch(smBase,{headers:auth});if(!r.ok)throw Object.assign(new Error(`sitemaps.list HTTP ${r.status}: ${(await r.text()).slice(0,160)}`),{status:r.status});return (await r.json()).sitemap||[]};
      const before=await list();
      const listed=s=>s.some(x=>x.path===sitemapUrl);
      let submitted=false;
      if(!listed(before)){const r=await fetch(`${smBase}/${encodeURIComponent(sitemapUrl)}`,{method:'PUT',headers:auth});if(!r.ok)throw Object.assign(new Error(`sitemaps.submit HTTP ${r.status}`),{status:r.status});submitted=true}
      const stale=staleSitemaps(before.map(x=>x.path),host),pruned=[];
      for(const p of stale){const r=await fetch(`${smBase}/${encodeURIComponent(p)}`,{method:'DELETE',headers:auth});if(!r.ok)throw Object.assign(new Error(`sitemaps.delete ${p} HTTP ${r.status}`),{status:r.status});pruned.push(p);console.log(`gsc-sitemaps ${host}: deleted stale registration ${p}`)}
      const after=submitted||pruned.length?await list():before;
      const row=after.find(x=>x.path===sitemapUrl)||null;
      sitemaps.hosts[host]={state:listed(after)?'LISTED':'NOT_LISTED_AFTER_SUBMIT',site_property:site,sitemap_url:sitemapUrl,listed_before:listed(before),submitted_now:submitted,listed_after:listed(after),
        last_submitted:row?.lastSubmitted||null,last_downloaded:row?.lastDownloaded||null,is_pending:row?.isPending??null,errors:Number(row?.errors||0),warnings:Number(row?.warnings||0),
        submitted_urls:Number((row?.contents||[]).find(c=>c.type==='web')?.submitted||0)||null,pruned_now:pruned,stale_after:staleSitemaps(after.map(x=>x.path),host),all_listed:after.map(x=>x.path)};
    }catch(e){
      const stop=[401,403].includes(e.status)?`NAMED STOP gsc-sitemaps ${host}: Search Console refused (${e.message}). Owner step: Search Console > ${site} > Settings > Users and permissions > give ${sa.client_email} Full permission.`:`gsc-sitemaps ${host}: ${e.message}`;
      console.log(stop);sitemaps.hosts[host]={state:[401,403].includes(e.status)?'NAMED_STOP':'PROVIDER_ERROR',named_stop:stop,sitemap_url:sitemapUrl};
    }
    if(sitemapsOnly)continue;
    // URL Inspection, oldest result first, capped.
    const carried=Object.fromEntries((previous.hosts?.[host]?.urls||[]).filter(r=>r.inspected_at&&urls.includes(r.url)).map(r=>[r.url,r]));
    const batch=[...urls].sort((a,b)=>String(carried[a]?.inspected_at||'').localeCompare(String(carried[b]?.inspected_at||''))).slice(0,PER_HOST_CAP);
    let hold=null;
    const results=await pool(batch,WORKERS,async url=>{
      if(hold)return null;
      try{
        const r=await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({inspectionUrl:url,siteUrl:site,languageCode:'en-US'})});
        if([401,403,429].includes(r.status)){hold=hold||{status:r.status,detail:(await r.text()).slice(0,160),url};return null}
        if(!r.ok)return {url,error:`HTTP ${r.status}`};
        const s=(await r.json()).inspectionResult?.indexStatusResult||{};
        return {url,verdict:s.verdict||null,coverageState:s.coverageState||'UNKNOWN',lastCrawlTime:s.lastCrawlTime||null,indexingState:s.indexingState||null,robotsTxtState:s.robotsTxtState||null,pageFetchState:s.pageFetchState||null,googleCanonical:s.googleCanonical||null,userCanonical:s.userCanonical||null,inspected_at:now()};
      }catch(e){return {url,error:String(e.message||e)}}
    });
    const fresh=results.filter(r=>r&&!r.error);
    const errors=results.filter(r=>r&&r.error);
    const byUrl={...carried,...Object.fromEntries(fresh.map(r=>[r.url,r]))};
    const rows=urls.map(u=>byUrl[u]||notInspected(u,hold?`held: HTTP ${hold.status}`:'not reached this run'));
    inspectedTotal+=fresh.length;
    let state=errors.length?'PARTIAL':'OK',named_stop=null;
    if(hold){
      state=hold.status===429?'HELD_QUOTA':'NAMED_STOP';
      named_stop=hold.status===429?`URL Inspection quota exhausted for ${site} (${hold.detail}); it resets daily. ${fresh.length} URL(s) inspected this run are kept.`:`NAMED STOP index-coverage ${host}: Search Console refused URL Inspection (HTTP ${hold.status}). Owner step: Search Console > ${site} > Settings > Users and permissions > add ${sa.client_email} with Full permission.`;
      console.log(named_stop);
    }
    const summary=summarise(rows);
    coverage.hosts[host]={site_property:site,state,named_stop,sitemap_url_count:urls.length,inspected_this_run:fresh.length,errors_this_run:errors.map(e=>`${e.url}: ${e.error}`).slice(0,10),summary,urls:rows};
    const b=summary.buckets;
    console.log(`index-coverage ${host} ${state}: ${urls.length} URLs - indexed ${b.indexed}, crawled-not-indexed ${b.crawled_not_indexed}, discovered-not-indexed ${b.discovered_not_indexed}, unknown ${b.unknown_to_google}, other ${b.other}, not inspected ${b.not_inspected} (${fresh.length} inspected this run); sitemap ${sitemaps.hosts[host]?.state}`);
  }
  write(SITEMAPS_OUT,sitemaps);
  if(sitemapsOnly)return Object.values(sitemaps.hosts).some(h=>h.state==='PROVIDER_ERROR')?1:0;
  if(!inspectedTotal&&Object.values(coverage.hosts).every(h=>h.state!=='NAMED_STOP'&&h.state!=='HELD_QUOTA')){console.error('index-coverage: nothing could be inspected on any host');write(OUT,coverage);return 1}
  write(OUT,coverage);
  return 0;
}
if(import.meta.url===`file://${process.argv[1]}`) process.exit(await main());
