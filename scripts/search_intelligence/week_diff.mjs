#!/usr/bin/env node
// Week-over-week Search Console diff for one host, by day, page and query.
//
// Why (2026-10-11): the weekly search-outcome report in
// local-guides-citation-velocity (issue #187) rated weddingbudgetspreadsheet.com
// RED on 24 -> 1 impressions, and this repo only kept a 28-day aggregate
// (gsc_truth.json), so a burst query, a lost page and a split www/apex property
// could not be told apart. This pulls 90 days of date x page and date x query
// (plus date totals, which include the anonymised queries the query rows omit)
// and writes the two weeks side by side:
//   data/search_intelligence/<host>/red_week_<label>.json
// Run: node scripts/search_intelligence/week_diff.mjs --host <h> --current-start YYYY-MM-DD --label <n>
// Dispatch-only step in search-intelligence.yml (input week_diff_host).
// No credential -> NAMED STOP, exit 0, nothing written. An empty 90-day pull exits 1.
import {write,now,gscToken,GSC_HOST_ENV,pageKey} from './lib.mjs';

const arg=k=>{const i=process.argv.indexOf(`--${k}`);return i>0?process.argv[i+1]:''};
const day=(s,n)=>{const d=new Date(`${s}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export function weekSplit(rows,currentStart){
  const cur=[currentStart,day(currentStart,6)],pri=[day(currentStart,-7),day(currentStart,-1)];
  const inR=(d,[a,b])=>d>=a&&d<=b;
  return {current:{start:cur[0],end:cur[1],rows:rows.filter(r=>inR(r.date,cur))},prior:{start:pri[0],end:pri[1],rows:rows.filter(r=>inR(r.date,pri))}};
}
export function diffBy(rows,currentStart,key){
  const {current,prior}=weekSplit(rows,currentStart);const m={};
  for(const [w,set] of [['prior',prior.rows],['current',current.rows]])for(const r of set){const k=r[key];m[k]=m[k]||{[key]:k,prior:0,current:0};m[k][w]+=r.impressions}
  return Object.values(m).map(x=>({...x,delta:x.current-x.prior})).sort((a,b)=>a.delta-b.delta||b.prior-a.prior);
}
async function main(){
  const host=arg('host'),label=arg('label')||'adhoc';
  if(!GSC_HOST_ENV[host]){console.error(`week-diff: unknown host "${host}"`);return 1}
  const raw=process.env.GSC_SERVICE_ACCOUNT_JSON||'',site=process.env[GSC_HOST_ENV[host]]||'';
  if(!raw||!site){console.log(`NAMED STOP week-diff ${host}: GSC_SERVICE_ACCOUNT_JSON or ${GSC_HOST_ENV[host]} is not set here; nothing was asked and nothing written.`);return 0}
  const access=await gscToken(JSON.parse(raw));
  const end=day(new Date().toISOString().slice(0,10),-1),start=day(end,-89);
  const currentStart=arg('current-start')||day(end,-9);
  const q=async dims=>{const r=await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,{method:'POST',headers:{authorization:`Bearer ${access}`,'content-type':'application/json'},body:JSON.stringify({startDate:start,endDate:end,dimensions:dims,type:'web',rowLimit:25000,dataState:'all'})});if(!r.ok)throw new Error(`searchAnalytics ${dims} HTTP ${r.status}: ${(await r.text()).slice(0,160)}`);return ((await r.json()).rows||[]).map(x=>({...Object.fromEntries(dims.map((d,i)=>[d,x.keys[i]])),clicks:x.clicks,impressions:x.impressions,position:Math.round(x.position*10)/10}))};
  const [byDate,byDatePage,byDateQuery]=[await q(['date']),await q(['date','page']),await q(['date','query'])];
  if(!byDate.length){console.error(`week-diff ${host}: 90-day pull returned zero rows`);return 1}
  const w=weekSplit(byDate,currentStart),sum=a=>a.reduce((s,r)=>s+r.impressions,0);
  const pq=weekSplit(byDateQuery,currentStart);
  const page=diffBy(byDatePage.map(r=>({...r,page_raw:r.page,page:r.page})),currentStart,'page');
  const pageCanon=diffBy(byDatePage.map(r=>({...r,page:pageKey(r.page)})),currentStart,'page');
  const query=diffBy(byDateQuery,currentStart,'query');
  const out={schema_version:'1.0.0',host,site_property:site,collected_at:now(),truth_source:'google_search_console_search_analytics',data_state:'all',window:{start,end},
    weeks:{prior:{start:w.prior.start,end:w.prior.end,impressions:sum(w.prior.rows),clicks:w.prior.rows.reduce((s,r)=>s+r.clicks,0),by_day:w.prior.rows,impressions_in_query_rows:sum(pq.prior.rows)},
           current:{start:w.current.start,end:w.current.end,impressions:sum(w.current.rows),clicks:w.current.rows.reduce((s,r)=>s+r.clicks,0),by_day:w.current.rows,impressions_in_query_rows:sum(pq.current.rows)}},
    by_page:page,by_page_canonical:pageCanon,by_query:query.slice(0,60),
    www_or_http_page_rows:byDatePage.filter(r=>/^http:|\/\/www\./.test(r.page)),
    daily_90d:byDate};
  write(`data/search_intelligence/${host}/red_week_${label}.json`,out);
  console.log(`week-diff ${host}: prior ${out.weeks.prior.start}..${out.weeks.prior.end} ${out.weeks.prior.impressions} imp, current ${out.weeks.current.start}..${out.weeks.current.end} ${out.weeks.current.impressions} imp; ${page.length} pages, ${query.length} queries`);
  return 0;
}
if(import.meta.url===`file://${process.argv[1]}`) process.exit(await main());
