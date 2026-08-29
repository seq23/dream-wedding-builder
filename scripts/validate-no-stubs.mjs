import fs from 'node:fs'; import path from 'node:path';
// Scanned is counted, not assumed. Run from a tree with none of these roots this
// printed "No stub markers found" and exited 0 having read zero files - a pass
// indistinguishable from "nothing was checked". Confirmed 2026-08-29.
const roots=['app','components','scripts','data','docs']; const bad=[]; let scanned=0; const patterns=[/\bTODO\b/i,/\bFIXME\b/i,/coming soon/i,/lorem ipsum/i,/not implemented/i,/stub only/i];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx|js|mjs|json|md)$/.test(e.name)&&p!=='scripts/validate-no-stubs.mjs'){const t=fs.readFileSync(p,'utf8');scanned+=1;for(const rx of patterns)if(rx.test(t))bad.push(`${p}: ${rx}`);}}}
const present=roots.filter((r)=>fs.existsSync(r));
for(const r of present)walk(r);
if(bad.length){console.error(bad.join('\n'));process.exit(1)}
if(scanned===0){console.error('VALIDATION FAIL: stub scan examined 0 files.');console.error(`- roots: ${roots.join(', ')} (present: ${present.join(', ')||'none'})`);console.error('- a pass here would mean "nothing was checked", not "no stubs exist"');process.exit(1)}
console.log(`No stub markers found (${scanned} files across ${present.length} root(s))`);
