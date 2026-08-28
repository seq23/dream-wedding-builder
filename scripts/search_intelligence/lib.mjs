import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const root=process.cwd();
export const read=(p,fallback=null)=>{const f=path.join(root,p);if(!fs.existsSync(f)){if(fallback!==null)return fallback;throw new Error(`missing ${p}`)}return JSON.parse(fs.readFileSync(f,'utf8'));};
export const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');};
export const now=()=>new Date().toISOString();
export const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export const idFor=(...parts)=>crypto.createHash('sha256').update(parts.map(norm).join('|')).digest('hex').slice(0,20);
export const daysBetween=(a,b)=>Math.floor((new Date(b)-new Date(a))/86400000);
export const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return ''}};

// ---------------------------------------------------------------------------
// Provider states, and the one combination that is never allowed.
//
// collect_gsc.mjs used to write state:'AVAILABLE' unconditionally at the end of
// its run. Its host loop skipped every host whose site URL was unset, so on
// 2026-08-28T15:40 the daily cron printed "GSC: AVAILABLE requests=0
// rows_added=0" having made zero API calls after the OAuth token exchange, and
// wrote that string into provider_status.json where every downstream reader
// treats AVAILABLE as "this provider is reporting". Four missing secrets read as
// health for as long as nobody looked at the requests number next to it.
//
// AVAILABLE therefore means one thing only: the provider was asked and answered.
// Every other outcome has its own name. A run that asked nothing has a reason,
// and the reason is the state.
export const PROVIDER_STATES={
  AVAILABLE:'the provider was queried and answered; requests>0 is part of the definition',
  UNCONFIGURED:'no credential supplied; nothing was attempted and no evidence was fabricated',
  MISCONFIGURED:'a credential was supplied but the run could not address any property, so nothing was asked',
  PROVIDER_ERROR:'every attempted request failed',
  DEGRADED:'some properties answered and some failed',
  READY:'configured and awaiting input from its own lane',
};

// The invariant, enforced at the single point where status is written rather
// than trusted to each call site. Throwing here is deliberate: a status file
// that claims health it did not measure is worse than a failed job.
export function assertHonestProviderState(name,entry){
  const state=entry?.state;
  if(!state||!Object.prototype.hasOwnProperty.call(PROVIDER_STATES,state)) throw new Error(`provider ${name}: unnamed state ${JSON.stringify(state)}; every outcome must be one of ${Object.keys(PROVIDER_STATES).join(', ')}`);
  if(state==='AVAILABLE'&&!(Number(entry.requests)>0)) throw new Error(`provider ${name}: AVAILABLE with requests=${entry.requests ?? 'absent'}. A provider that was never asked cannot report health - use MISCONFIGURED, UNCONFIGURED or PROVIDER_ERROR with a reason.`);
  if(state!=='AVAILABLE'&&state!=='READY'&&!entry.reason) throw new Error(`provider ${name}: state ${state} must carry a reason`);
  return entry;
}

// Single writer for data/search_intelligence/provider_status.json, so the
// invariant cannot be bypassed by writing the file directly.
export function writeProviderStatus(name,entry,statusDoc){
  const status=statusDoc||read('data/search_intelligence/provider_status.json',{schema_version:'1.0.0',providers:{}});
  assertHonestProviderState(name,entry);
  status.updated_at=now();
  status.providers={...(status.providers||{}),[name]:entry};
  write('data/search_intelligence/provider_status.json',status);
  return status;
}
