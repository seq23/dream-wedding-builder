#!/usr/bin/env node
// Collect own-site Search Console performance, and never claim to have done so
// when it did not.
//
// The defect this replaces
// -----------------------
// The final line of this script used to be an unconditional
// `status.providers.gsc={state:'AVAILABLE',requests,rows_added:added}`. The host
// loop above it began `if(!siteUrl||requests>=max) continue`, and
// GSC_SITE_URL_SEATING/BUDGET/TIMELINE/CHECKLIST did not exist, so all four
// hosts were skipped and the script exited 0 printing
// "GSC: AVAILABLE requests=0 rows_added=0" - a health report from a run that
// made no Search Console request at all. Four missing secrets looked identical
// to a healthy provider, and did for as long as this ran.
//
// The fix is not "set the secrets" - that was done on 2026-08-28 and the next
// run reported requests=4 rows_added=2. The fix is that AVAILABLE now requires
// requests>0 by construction: assertHonestProviderState in ./lib.mjs refuses to
// write the file otherwise, so the same class of silent green cannot be
// reintroduced by editing this file.
//
// Outcomes
//   AVAILABLE      every addressed property answered                    exit 0
//   DEGRADED       some answered, some failed; failures are named       exit 0
//   PROVIDER_ERROR everything attempted failed                          exit 1
//   MISCONFIGURED  a credential exists but no property could be
//                  addressed, so nothing was asked                      exit 1
//   UNCONFIGURED   no credential; nothing attempted, nothing claimed    exit 0
import crypto from 'node:crypto';
import {read,write,now,idFor,hostOf,writeProviderStatus} from './lib.mjs';
const cfg=read('data/search_intelligence/config.json');
const targets=read('data/search_intelligence/targets.json',{targets:[]}).targets||[];
const existing=read('data/search_intelligence/observations.json',{schema_version:'1.0.0',observations:[]});
const status=read('data/search_intelligence/provider_status.json',{schema_version:'1.0.0',providers:{}});
const raw=process.env.GSC_SERVICE_ACCOUNT_JSON||'';
const SITE_ENV={
  'weddingseatingchartmaker.com':'GSC_SITE_URL_SEATING',
  'weddingbudgetspreadsheet.com':'GSC_SITE_URL_BUDGET',
  'weddingtimelinetemplate.com':'GSC_SITE_URL_TIMELINE',
  'weddingchecklistpdf.com':'GSC_SITE_URL_CHECKLIST'
};
const siteEnv=Object.fromEntries(Object.entries(SITE_ENV).map(([host,name])=>[host,process.env[name]]));
const b64url=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
async function token(sa){
  const issued=Math.floor(Date.now()/1000), header={alg:'RS256',typ:'JWT'}, claim={iss:sa.client_email,scope:'https://www.googleapis.com/auth/webmasters.readonly',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600};
  const unsigned=`${b64url(header)}.${b64url(claim)}`;
  const sig=crypto.sign('RSA-SHA256',Buffer.from(unsigned),sa.private_key).toString('base64url');
  const body=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${sig}`});
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!r.ok) throw new Error(`GSC OAuth ${r.status}: ${await r.text()}`); return (await r.json()).access_token;
}
const days=Number(cfg.providers?.gsc?.lookback_days||28); const end=new Date(); end.setUTCDate(end.getUTCDate()-2); const start=new Date(end); start.setUTCDate(start.getUTCDate()-days+1); const d=x=>x.toISOString().slice(0,10);
const period={start:d(start),end:d(end)};
const finish=(entry,code)=>{writeProviderStatus('gsc',{...entry,checked_at:now()},status);console.log(`GSC: ${entry.state}${entry.reason?` - ${entry.reason}`:''} requests=${entry.requests??0} rows_added=${entry.rows_added??0}`);process.exit(code);};

if(!raw) finish({state:'UNCONFIGURED',requests:0,rows_added:0,reason:'GSC_SERVICE_ACCOUNT_JSON absent; nothing was attempted and existing evidence is preserved'},0);
let sa; try{sa=JSON.parse(raw)}catch{finish({state:'MISCONFIGURED',requests:0,rows_added:0,reason:'GSC_SERVICE_ACCOUNT_JSON is not valid JSON'},1)}

// Addressability is settled before any request is made, so "no property could be
// addressed" is reported as its own state rather than as an empty successful loop.
const missingSiteUrls=Object.entries(SITE_ENV).filter(([host])=>!siteEnv[host]).map(([,name])=>name);
const addressable=Object.entries(siteEnv).filter(([,siteUrl])=>Boolean(siteUrl));
const max=Number(cfg.budgets?.gsc_requests_per_run||8);
if(!addressable.length) finish({state:'MISCONFIGURED',requests:0,rows_added:0,reason:`a service account is configured but no property could be addressed: ${missingSiteUrls.join(', ')} are unset, so no Search Console request was made`,missing_site_url_env:missingSiteUrls},1);
if(max<1) finish({state:'MISCONFIGURED',requests:0,rows_added:0,reason:`budgets.gsc_requests_per_run is ${max}, so no request was permitted`},1);

const access=await token(sa); let requests=0, added=0; const failures=[]; const queried=[];
for(const [host,siteUrl] of addressable){
  if(requests>=max) continue; requests++;
  const endpoint=`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  let body;
  try{
    const r=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${access}`,'content-type':'application/json'},body:JSON.stringify({startDate:period.start,endDate:period.end,dimensions:['query','page'],type:'web',rowLimit:Number(cfg.providers?.gsc?.row_limit||25000),dataState:'final'})});
    if(!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);
    body=await r.json();
  }catch(e){failures.push({host,error:String(e.message||e)});continue}
  queried.push(host);
  for(const row of body.rows||[]){const [query,page]=row.keys||[]; if(!query||!page)continue; const ph=hostOf(page); if(ph!==host)continue; existing.observations.push({observation_id:idFor('gsc',host,query,page,period.end,String(row.impressions)),observed_at:now(),period,provider:'google_search_console',evidence_class:'OWN_SITE_PERFORMANCE',query,page,host,clicks:Number(row.clicks||0),impressions:Number(row.impressions||0),ctr:Number(row.ctr||0),average_position:Number(row.position||0),target_match:targets.some(t=>t.host===host&&t.query.toLowerCase()===String(query).toLowerCase())});added++;}
}
const dedup=new Map(existing.observations.map(o=>[o.observation_id,o])); existing.observations=[...dedup.values()].sort((a,b)=>String(a.observed_at).localeCompare(String(b.observed_at))).slice(-10000);write('data/search_intelligence/observations.json',existing);

// requests counts attempts; queried counts properties that actually answered.
// AVAILABLE is reserved for the case where every attempt answered.
if(!queried.length) finish({state:'PROVIDER_ERROR',requests,rows_added:0,reason:`all ${requests} Search Console request(s) failed: ${failures.map(f=>`${f.host} (${f.error})`).join('; ')}`,failures,period},1);
if(failures.length) finish({state:'DEGRADED',requests,rows_added:added,reason:`${queried.length} of ${requests} properties answered; ${failures.length} failed`,answered:queried,failures,period},0);
finish({state:'AVAILABLE',requests,rows_added:added,answered:queried,period},0);
