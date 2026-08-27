#!/usr/bin/env node
/**
 * Generate the Microsoft Clarity loader served by this Worker.
 *
 * Purpose:
 * - The four domains served from this repo (weddingchecklistpdf.com,
 *   weddingbudgetspreadsheet.com, weddingtimelinetemplate.com,
 *   weddingseatingchartmaker.com) each have a Clarity project, but no tag was
 *   ever installed, so all four projects sat on "Almost there!" with zero
 *   recorded sessions and kept generating "finish your setup" email.
 *
 * Inputs:
 * - data/clarity_projects.json: hostname -> Clarity project id.
 * - data/seo/route_ownership.json: the canonical hosts this app serves.
 *
 * Outputs:
 * - public/assets/clarity-loader.js, referenced from app/layout.tsx as
 *   <script data-clarity-loader src="/assets/clarity-loader.js" defer>.
 *
 * Notes:
 * - This mirrors scripts/install_clarity.js in local-guides-generator, which is
 *   the portfolio's established pattern. Two rules carry over from it:
 *   1. The loader resolves its project id from location.hostname rather than
 *      being hardcoded. One Worker serves all four hosts from a single build,
 *      so a hardcoded id would file every domain's sessions under one project.
 *   2. It is a SAME-ORIGIN file, not an inline script. An inline loader is
 *      refused by a strict CSP (script-src 'self'), which leaves the tag on
 *      every page while the project stays empty - indistinguishable from
 *      having no tag at all. This app serves no CSP today, but the
 *      same-origin form costs nothing and survives one being added later.
 * - The generated file is committed. The generator keeps it honest on every
 *   build; the committed copy is what guarantees the asset exists even for a
 *   build path that does not run this script.
 *
 * Use this when:
 * - Building the site. It is wired into `npm run build`, so it does not need
 *   to be run by hand.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const cfg = JSON.parse(readFileSync(resolve(ROOT, 'data/clarity_projects.json'), 'utf8'));
const projects = cfg.projects ?? {};

if (!Object.keys(projects).length) {
  console.error('clarity: no projects configured');
  process.exit(1);
}

// A fabricated id collects nothing and a reused one files this domain's
// sessions under another domain's project, so refuse anything implausible and
// refuse any id used twice.
const seen = new Map();
for (const [host, id] of Object.entries(projects)) {
  if (!/^[a-z0-9]{8,16}$/.test(String(id))) {
    console.error(`clarity: implausible project id for ${host}: ${id}`);
    process.exit(1);
  }
  if (seen.has(id)) {
    console.error(`clarity: project id ${id} is shared by ${seen.get(id)} and ${host}`);
    process.exit(1);
  }
  seen.set(id, host);
}

// The host list is the thing that silently rots: add a domain to the app and
// its Clarity project never receives a hit, which is the exact failure this
// script exists to close. Fail the build instead.
const ownership = JSON.parse(readFileSync(resolve(ROOT, 'data/seo/route_ownership.json'), 'utf8'));
const canonicalHosts = Object.keys(ownership.hosts ?? {});
const missing = canonicalHosts.filter((host) => !(host in projects));
const extra = Object.keys(projects).filter((host) => !canonicalHosts.includes(host));
if (missing.length || extra.length) {
  if (missing.length) console.error(`clarity: canonical hosts with no project id: ${missing.join(', ')}`);
  if (extra.length) console.error(`clarity: project ids for non-canonical hosts: ${extra.join(', ')}`);
  process.exit(1);
}

const loaderJs = `(function(w,d,m){var h=(w.location.hostname||"").toLowerCase().replace(/^www\\./,"");var id=m[h];if(!id)return;w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};var s=d.createElement("script");s.async=1;s.src="https://www.clarity.ms/tag/"+id;var f=d.getElementsByTagName("script")[0];f.parentNode.insertBefore(s,f)})(window,document,${JSON.stringify(projects)})\n`;

const out = resolve(ROOT, cfg.public_root ?? 'public', 'assets/clarity-loader.js');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, loaderJs);

console.log(`clarity: wrote loader for ${canonicalHosts.length} host(s) to ${out.slice(ROOT.length + 1)}`);
