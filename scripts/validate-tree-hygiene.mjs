import fs from 'node:fs';

const allowedRootFiles = new Set([
  '.dev.vars.example',
  '.env.example',
  '.gitignore',
  'ARTIFACT_MANIFEST.md',
  'DESIGN_SYSTEM.md',
  'ENVIRONMENT_VARIABLES.md',
  'HOSTILE_REVIEW_2026-07-10.md',
  'IMPLEMENTATION_STATUS.md',
  'README.md',
  'REPO_IDENTITY.md',
  'REPO_VALIDATION_MATRIX.md',
  'REPO_VISUAL_STYLE_GUIDE.md',
  'SCOPE_RECEIPT.md',
  'UI_QUALITY_GATES.md',
  'next-env.d.ts',
  'next.config.ts',
  'open-next.config.ts',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'postcss.config.js',
  'tailwind.config.ts',
  'tsconfig.json',
  'vitest.config.ts',
  'wrangler.jsonc'
]);

const allowedRootDirs = new Set([
  '.github',
  '.ops',
  'app',
  'artifacts',
  'components',
  'data',
  'docs',
  'lib',
  'migrations',
  'product-builds',
  'product-source',
  'public',
  'reports',
  'scripts',
  'tests'
]);

const forbiddenNames = new Set([
  'node_modules',
  '.next',
  '.open-next',
  '.wrangler',
  '.turbo',
  '.cache',
  'dist',
  'coverage',
  'test-results',
  'playwright-report'
]);

const errors = [];
for (const item of fs.readdirSync('.', { withFileTypes: true })) {
  if (item.name === '.git') continue;
  if (forbiddenNames.has(item.name)) {
    errors.push(`forbidden generated/dependency artifact at root: ${item.name}`);
    continue;
  }
  if (item.isDirectory() && !allowedRootDirs.has(item.name)) errors.push(`unexpected root directory: ${item.name}`);
  if (item.isFile() && !allowedRootFiles.has(item.name)) errors.push(`unexpected root file: ${item.name}`);
}

if (errors.length) {
  console.error('VALIDATION FAIL: tree hygiene failed');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('tree hygiene: PASS');
