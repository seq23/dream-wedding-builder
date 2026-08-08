#!/usr/bin/env node
import {read} from './lib.mjs';
const p=read('data/search_intelligence/provider_status.json',{providers:{}}); const t=read('data/search_intelligence/targets.json',{targets:[]}); const d=read('data/search_intelligence/diagnostics.json',{diagnostics:[]}); const r=read('data/search_intelligence/repair_ledger.json',{repairs:[]}); const o=read('data/search_intelligence/retest_ledger.json',{outcomes:[]});
console.log(`SEARCH INTELLIGENCE STATUS\ntargets=${t.targets?.length||0}\ngsc=${p.providers?.gsc?.state||'UNKNOWN'}\ndiagnostics=${d.diagnostics?.length||0}\napplied_repairs=${(r.repairs||[]).filter(x=>x.status==='APPLIED').length}\noutcomes=${o.outcomes?.length||0}\ntruth=provider evidence remains classed; no fabricated rank/citation claims`);
