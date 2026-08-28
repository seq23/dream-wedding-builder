#!/usr/bin/env node
import fs from 'node:fs';
import {read,assertHonestProviderState} from './lib.mjs';
const errors=[]; const cfg=read('data/search_intelligence/config.json'); const targets=read('data/search_intelligence/targets.json',{targets:[]}); const obs=read('data/search_intelligence/observations.json',{observations:[]}); const diag=read('data/search_intelligence/diagnostics.json',{diagnostics:[]}); const repairs=read('data/search_intelligence/repair_ledger.json',{repairs:[]}); const retest=read('data/search_intelligence/retest_ledger.json',{outcomes:[]}); const ownership=read('data/seo/route_ownership.json');
for(const f of ['scripts/search_intelligence/build_targets.mjs','scripts/search_intelligence/collect_gsc.mjs','scripts/search_intelligence/import_agent_observations.mjs','scripts/search_intelligence/diagnose.mjs','scripts/search_intelligence/apply_repairs.mjs','scripts/search_intelligence/retest.mjs','scripts/search_intelligence/status.mjs','scripts/search_intelligence/llm_citation_probe.mjs'])if(!fs.existsSync(f))errors.push(`missing ${f}`);
if(cfg.publishing_cadence_owned_elsewhere!==true)errors.push('search lane must not own publishing cadence'); if(!cfg.repair_policy?.blocked?.includes('publishing_cadence_change'))errors.push('publishing cadence change must remain blocked');
// Provider honesty. The committed status file is checked against the same
// invariant collect_gsc.mjs writes under, so a hand-edited or stale
// "AVAILABLE with requests=0" cannot reach main either.
const providerStatus=read('data/search_intelligence/provider_status.json',{providers:{}});
for(const [name,entry] of Object.entries(providerStatus.providers||{})){
  try{assertHonestProviderState(name,entry)}catch(e){errors.push(`provider_status: ${e.message}`)}
}
if(!providerStatus.providers?.gsc)errors.push('provider_status: gsc has no recorded state');

// Citation occupancy. A rate may only exist when a provider answered; an error
// is an error, never 0%.
const occ=read('data/search_intelligence/citation_occupancy.json',{runs:[]});
for(const run of occ.runs||[]){
  const observed=(run.observations||[]).filter(o=>o.status==='observed');
  const errored=(run.observations||[]).filter(o=>o.status==='provider_error');
  for(const o of run.observations||[]){
    if(!['observed','provider_error'].includes(o.status))errors.push(`citation observation has unnamed status ${JSON.stringify(o.status)}`);
    if(o.status==='provider_error'&&!o.error)errors.push(`citation provider_error without an error message (${o.query})`);
    if(o.status==='provider_error'&&('cited_domains'in o))errors.push(`errored citation observation must not carry citation data (${o.query})`);
    if(o.status==='observed'&&!Array.isArray(o.cited_domains))errors.push(`observed citation row without cited_domains (${o.query})`);
  }
  const rate=run.summary?.self_cited_rate_pct;
  if(!observed.length&&rate!==null&&rate!==undefined)errors.push(`citation run ${run.run_at} answered nothing (${errored.length} provider error(s)) yet records a rate of ${rate}; an unanswered probe has no rate`);
  if(observed.length&&typeof rate!=='number')errors.push(`citation run ${run.run_at} observed ${observed.length} answer(s) but records no rate`);
  if(run.state&&!['MEASURED','PROVIDER_ERROR','DEGRADED','UNCONFIGURED','HELD_CADENCE'].includes(run.state))errors.push(`citation run ${run.run_at} has unnamed state ${run.state}`);
}
const ids=new Set(); for(const t of targets.targets||[]){if(ids.has(t.target_id))errors.push(`duplicate target ${t.target_id}`);ids.add(t.target_id);if(!ownership.hosts?.[t.host])errors.push(`target unknown host ${t.host}`);if(!t.query||!t.route)errors.push(`incomplete target ${t.target_id}`);}
for(const o of obs.observations||[]){if(!o.observation_id||!o.observed_at||!o.provider||!o.evidence_class)errors.push('malformed observation'); if(o.evidence_class==='SAMPLED_QUERY_SURFACE'&&!String(o.note||'').toLowerCase().includes('not equivalent'))errors.push(`sample observation missing rank boundary ${o.observation_id}`);}
for(const d of diag.diagnostics||[])if(d.kind==='sampled_surface_present'||d.kind==='sampled_surface_absent'){if(!String(d.note||'').toLowerCase().includes('not universal rank'))errors.push(`surface diagnosis overclaims ${d.diagnostic_id}`)}
for(const r of repairs.repairs||[]){if(!['hub_missing_meta_description','hub_meta_description_length','high_impression_low_ctr_hub_meta_description'].includes(r.kind))errors.push(`unauthorized repair kind ${r.kind}`);if(r.status==='APPLIED'&&!r.source_rule)errors.push(`repair lacks source rule ${r.repair_id}`);}
for(const o of retest.outcomes||[])if(!['IMPROVED','UNCHANGED','REGRESSED','INCONCLUSIVE'].includes(o.outcome))errors.push(`invalid outcome ${o.outcome}`);
if(errors.length){console.error('SEARCH INTELLIGENCE VALIDATION FAIL');errors.forEach(e=>console.error(`- ${e}`));process.exit(1)}console.log(`search intelligence validation: PASS (${targets.targets?.length||0} targets, ${(obs.observations||[]).length} observations, ${(repairs.repairs||[]).length} repairs, gsc=${providerStatus.providers?.gsc?.state} requests=${providerStatus.providers?.gsc?.requests??0}, ${(occ.runs||[]).length} citation run(s))`);
