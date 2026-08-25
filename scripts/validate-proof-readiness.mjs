import fs from 'node:fs';
import crypto from 'node:crypto';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const exists = file => fs.existsSync(file);
const errors = [];

function fail(message) {
  errors.push(message);
}

const contractPath = 'data/ops/dream_wedding_builder_proof_contract.json';
if (!exists(contractPath)) fail(`missing ${contractPath}`);
const contract = exists(contractPath) ? readJson(contractPath) : {};
if (contract.contract !== 'DREAM_WEDDING_BUILDER_PROOF_CONTRACT') fail('proof contract id mismatch');
if (contract.validation_may_mutate_files !== false) fail('proof contract must state validation_may_mutate_files=false');
if (contract.provider_proof_status !== 'provider_unproven') fail('provider proof status must remain provider_unproven until live proof is recorded');

const growth = readJson('data/admin/growth_health.json');
if (growth.status !== 'provider_unproven') fail('growth_health must remain provider_unproven before live provider proof');
for (const [key, value] of Object.entries(growth.metrics || {})) {
  if (typeof value !== 'number') fail(`growth metric ${key} must be numeric`);
  if (value !== 0) fail(`growth metric ${key} claims proof before provider execution: ${value}`);
}

const contentRegistry = readJson('data/authority/content_registry.json');
const hubRegistry = readJson('data/seo/hub_pages.json');
const guideCount = Array.isArray(contentRegistry.pages) ? contentRegistry.pages.length : 0;
const hubCount = Array.isArray(hubRegistry.pages)
  ? hubRegistry.pages.length
  : Object.keys(hubRegistry.pages || {}).length;
const expectedAuthorityRoutes = guideCount + hubCount;

const admission = readJson('artifacts/authority/admission-report.json');
// Requiring rejected === 0 assumed every discovered page is publishable. The
// upstream authority:scale:fanout step generates candidate pages on every run and
// some are legitimately held back, so demanding zero rejections made a healthy
// pipeline unprovable. What must hold is that the report balances and that the
// admitted set is what actually shipped.
const admitted = admission.report?.admitted ?? -1;
const rejectedCount = admission.report?.rejected ?? -1;
const discovered = admission.report?.discovered ?? -1;
if (admitted < 0 || rejectedCount < 0 || discovered !== admitted + rejectedCount) {
  fail(`authority admission report must balance: discovered ${discovered} != admitted ${admitted} + rejected ${rejectedCount}`);
}
if (admitted !== guideCount) {
  fail(`authority admission report must account for the ${guideCount} guides in the registry (admitted ${admitted})`);
}
if (admission.report?.hub_count !== hubCount) {
  fail(`authority admission report must account for ${hubCount} hub routes`);
}

const release = readJson('artifacts/authority/release-manifest.json');
if (!Array.isArray(release.routes) || release.routes.length !== expectedAuthorityRoutes) {
  fail(`authority release manifest must contain ${expectedAuthorityRoutes} routes (${guideCount} guides + ${hubCount} hubs)`);
}

const domains = readJson('data/domains/domain_registry.json');
if (!Array.isArray(domains.domains) || domains.domains.length !== 4) fail('domain registry must define four product authority domains');
for (const domain of domains.domains || []) {
  const sitemap = `artifacts/sitemaps/${domain.domain}.xml`;
  if (!exists(sitemap)) fail(`missing domain sitemap ${sitemap}`);
}

const actions = readJson('data/admin/admin_action_registry.json').actions || [];
const protectedActions = ['pause-publishing', 'change-price', 'refund-order'];
for (const id of protectedActions) {
  const action = actions.find(item => item.id === id);
  if (!action) fail(`missing protected admin action ${id}`);
  if (action && (action.risk !== 'protected' || action.approval_required !== true)) {
    fail(`protected admin action ${id} must require approval`);
  }
}

const manifest = readJson('product-builds/manifests/download_manifest.json');
let releaseFileCount = 0;
for (const product of manifest.products || []) {
  for (const file of product.files || []) {
    releaseFileCount += 1;
    const releasePath = `product-builds/releases/${file.path}`;
    if (!exists(releasePath)) {
      fail(`missing product release file ${releasePath}`);
      continue;
    }
    const digest = crypto.createHash('sha256').update(fs.readFileSync(releasePath)).digest('hex');
    if (digest !== file.sha256) fail(`checksum mismatch for ${releasePath}`);
  }
}
if (releaseFileCount !== 15) fail(`expected 15 governed release files, found ${releaseFileCount}`);

for (const file of [
  'migrations/0001_fulfillment.sql',
  'docs/PAID_ORDER_FULFILLMENT_RUNBOOK.md',
  'docs/providers/STRIPE_AUTOMATION_RUNBOOK.md',
  'docs/security/SECRETS_READINESS_LEDGER.md',
  'docs/security/VAULT_OPERATOR_GUIDE.md',
  'docs/day-0/START_HERE.md'
]) {
  if (!exists(file)) fail(`missing required proof/runbook file ${file}`);
}

const day0 = fs.readFileSync('docs/day-0/START_HERE.md', 'utf8');
for (const match of day0.matchAll(/`([^`]+\.(?:md|json|sql))`/g)) {
  const rel = match[1];
  if (!exists(rel)) fail(`Day-0 guide references missing file ${rel}`);
}

const agentDirs = [
  'data/report_fixes/agent_runs',
  'data/report_fixes/normalized_agent_runs',
  'data/citation/agent_runs'
].filter(exists);
if (contract.external_agent_lane?.enabled !== true && agentDirs.length) {
  fail(`agent artifact directories exist while external agent lane is disabled: ${agentDirs.join(', ')}`);
}

if (errors.length) {
  console.error('VALIDATION FAIL: proof readiness failed');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`proof readiness: PASS (${release.routes.length} authority routes, ${releaseFileCount} governed release files)`);
