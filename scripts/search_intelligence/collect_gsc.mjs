#!/usr/bin/env node
import crypto from 'node:crypto';
import {read,write,now,idFor,hostOf} from './lib.mjs';
const cfg=read('data/search_intelligence/config.json');
const targets=read('data/search_intelligence/targets.json',{targets:[]}).targets||[];
const existing=read('data/search_intelligence/observations.json',{schema_version:'1.0.0',observations:[]});
const status=read('data/search_intelligence/provider_status.json',{schema_version:'1.0.0',providers:{}});
const raw=process.env.GSC_SERVICE_ACCOUNT_JSON||'';
const siteEnv={
  'weddingseatingchartmaker.com':process.env.GSC_SITE_URL_SEATING,
  'weddingbudgetspreadsheet.com':process.env.GSC_SITE_URL_BUDGET,
  'weddingtimelinetemplate.com':process.env.GSC_SITE_URL_TIMELINE,
  'weddingchecklistpdf.com':process.env.GSC_SITE_URL_CHECKLIST
};
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
if(!raw){status.updated_at=now();status.providers={...(status.providers||{}),gsc:{state:'UNCONFIGURED',note:'GSC_SERVICE_ACCOUNT_JSON absent; existing evidence preserved'}};write('data/search_intelligence/provider_status.json',status);console.log('GSC: UNCONFIGURED (no fabricated evidence)');process.exit(0);}
let sa; try{sa=JSON.parse(raw)}catch{throw new Error('GSC_SERVICE_ACCOUNT_JSON must be valid JSON')}
const access=await token(sa); let requests=0, added=0; const max=Number(cfg.budgets?.gsc_requests_per_run||8);
for(const [host,siteUrl] of Object.entries(siteEnv)){
  if(!siteUrl||requests>=max) continue; requests++;
  const endpoint=`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const r=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${access}`,'content-type':'application/json'},body:JSON.stringify({startDate:d(start),endDate:d(end),dimensions:['query','page'],type:'web',rowLimit:Number(cfg.providers?.gsc?.row_limit||25000),dataState:'final'})});
  if(!r.ok) throw new Error(`GSC query ${host} ${r.status}: ${await r.text()}`); const body=await r.json();
  for(const row of body.rows||[]){const [query,page]=row.keys||[]; if(!query||!page)continue; const ph=hostOf(page); if(ph!==host)continue; existing.observations.push({observation_id:idFor('gsc',host,query,page,d(end),String(row.impressions)),observed_at:now(),period:{start:d(start),end:d(end)},provider:'google_search_console',evidence_class:'OWN_SITE_PERFORMANCE',query,page,host,clicks:Number(row.clicks||0),impressions:Number(row.impressions||0),ctr:Number(row.ctr||0),average_position:Number(row.position||0),target_match:targets.some(t=>t.host===host&&t.query.toLowerCase()===String(query).toLowerCase())});added++;}
}
const dedup=new Map(existing.observations.map(o=>[o.observation_id,o])); existing.observations=[...dedup.values()].sort((a,b)=>String(a.observed_at).localeCompare(String(b.observed_at))).slice(-10000);write('data/search_intelligence/observations.json',existing);
status.updated_at=now();status.providers={...(status.providers||{}),gsc:{state:'AVAILABLE',requests,rows_added:added,period:{start:d(start),end:d(end)}}};write('data/search_intelligence/provider_status.json',status);console.log(`GSC: AVAILABLE requests=${requests} rows_added=${added}`);
