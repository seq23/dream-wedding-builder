import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts || {};
const errors = [];

const forbiddenValidationCommands = [
  /\bauthority:/,
  /\bbuild\b/,
  /\bnext build\b/,
  /\bdeploy\b/,
  /\bupload\b/,
  /\bpreview\b/,
  /\bwrangler\b/,
  /\bstripe:/,
  /\bcloudflare:/,
  /\bd1:migrate\b/,
  /\bsecrets:generate\b/,
  /\bvault:init\b/,
  /\bnpm\s+(install|ci|update)\b/,
  /\bpython\s+scripts\/generate_product_downloads\.py\b/
];

for (const [name, command] of Object.entries(scripts)) {
  if (!name.startsWith('validate:')) continue;
  for (const pattern of forbiddenValidationCommands) {
    if (pattern.test(command)) {
      errors.push(`${name} contains execution/setup command: ${command}`);
      break;
    }
  }
}

for (const file of fs.readdirSync('scripts').filter(name => /^validate-.*\.mjs$/.test(name))) {
  const rel = path.join('scripts', file);
  const text = fs.readFileSync(rel, 'utf8');
  if (/fs\.(writeFileSync|appendFileSync|rmSync|unlinkSync|renameSync|cpSync|mkdirSync|chmodSync)/.test(text)) {
    errors.push(`${rel} mutates files; validators must inspect only`);
  }
}

if (errors.length) {
  console.error('VALIDATION FAIL: validation profile purity failed');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('validation profile purity: PASS');
