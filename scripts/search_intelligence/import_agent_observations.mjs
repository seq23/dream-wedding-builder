#!/usr/bin/env node
import fs from 'node:fs';
import {read,write,now,idFor,hostOf} from './lib.mjs';
const file=process.env.SEARCH_OBSERVATIONS_FILE||process.argv[2];
if(!file){console.log('agent observation import: no file supplied; existing evidence preserved');process.exit(0)}
const cfg=read('data/search_intelligence/config.json'); const current=read('data/search_intelligence/observations.json',{schema_version:'1.0.0',observations:[]}); const input=JSON.parse(fs.readFileSync(file,'utf8')); const rows=Array.isArray(input)?input:(input.observations||[]); const max=Number(cfg.budgets?.agent_observations_per_import||250); if(rows.length>max)throw new Error(`observation import exceeds per-import ceiling ${max}`);
let added=0;
for(const x of rows){
  if(!x.observed_at||!x.query||!x.provider||!Array.isArray(x.results))throw new Error('each agent observation requires observed_at, query, provider, results[]');
  if(!/^https?:\/\//.test(String(x.evidence_url||'')) && !x.evidence_note)throw new Error(`observation ${x.query} requires evidence_url or evidence_note`);
  const results=x.results.slice(0,20).map((r,i)=>({position:Number.isInteger(r.position)?r.position:i+1,url:r.url,title:r.title||'',snippet:r.snippet||'',host:hostOf(r.url)})).filter(r=>r.url&&r.host);
  if(!results.length)throw new Error(`observation ${x.query} has no valid result URLs`);
  current.observations.push({observation_id:idFor('agent',x.provider,x.query,x.observed_at,JSON.stringify(results)),observed_at:x.observed_at,provider:x.provider,evidence_class:'SAMPLED_QUERY_SURFACE',query:x.query,results,evidence_url:x.evidence_url||null,evidence_note:x.evidence_note||null,note:'Sampled surface observation; not equivalent to Search Console performance or universal rank.'}); added++;
}
const dedup=new Map(current.observations.map(o=>[o.observation_id,o])); current.observations=[...dedup.values()].sort((a,b)=>String(a.observed_at).localeCompare(String(b.observed_at))).slice(-10000); write('data/search_intelligence/observations.json',current); console.log(`agent observation import: ${added}`);
