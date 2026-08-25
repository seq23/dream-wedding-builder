import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

const allowedRootFiles = new Set([
  '.dev.vars.example',
  '.env.example',
  '.gitignore',
  'AGENTS.md',
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
  'middleware.ts',
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
  'wrangler.jsonc',
  // Validation registry belongs at root, matching the convention in the other
  // repos that carry one.
  '_repo_validation_registry.json',
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

function getRootItems() {
  try {
    execFileSync('git', ['-C', repoRoot, 'rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const trackedAndUnignoredFiles = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-files', '--cached', '--others', '--exclude-standard'],
      { encoding: 'utf8' }
    );

    const fileList = trackedAndUnignoredFiles.split(/\r?\n/).filter(Boolean);
    const rootNames = Array.from(new Set(fileList.map((filePath) => filePath.split('/')[0])));

    return rootNames.map((name) => {
      const statPath = `${repoRoot}/${name}`;
      if (fs.existsSync(statPath)) {
        const stat = fs.statSync(statPath);
        return {
          name,
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile()
        };
      }

      const hasChildren = fileList.some((filePath) => filePath.startsWith(`${name}/`));
      return {
        name,
        isDirectory: hasChildren,
        isFile: !hasChildren
      };
    });
  } catch {
    if (process.env.CI === 'true') {
      throw new Error('CI tree hygiene validation requires a Git work tree');
    }
  }

  return fs.readdirSync(repoRoot, { withFileTypes: true }).map((item) => ({
    name: item.name,
    isDirectory: item.isDirectory(),
    isFile: item.isFile()
  }));
}

const errors = [];
for (const item of getRootItems()) {
  if (item.name === '.git') continue;
  if (forbiddenNames.has(item.name)) {
    errors.push(`forbidden generated/dependency artifact at root: ${item.name}`);
    continue;
  }
  if (item.isDirectory && !allowedRootDirs.has(item.name)) errors.push(`unexpected root directory: ${item.name}`);
  if (item.isFile && !allowedRootFiles.has(item.name)) errors.push(`unexpected root file: ${item.name}`);
}

if (errors.length) {
  console.error('VALIDATION FAIL: tree hygiene failed');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('tree hygiene: PASS');
