import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const scenario of ['success', 'no-url', 'refused', 'missing-token']) {
  test(`hosted preview: ${scenario}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'phone-preview-'));
    try {
      mkdirSync(join(dir, 'dist')); mkdirSync(join(dir, 'bin'));
      writeFileSync(join(dir, 'bin/npx'), `#!/bin/sh
if [ "$4" = "create" ]; then exit 1; fi
if [ "$SCENARIO" = "refused" ]; then exit 1; fi
if [ "$SCENARIO" = "success" ]; then echo 'Deployment complete! https://abc123.test-app-preview.pages.dev'; fi
`, { mode: 0o755 });
      const summary = join(dir, 'summary'); const output = join(dir, 'output');
      const result = spawnSync('bash', [resolve('scripts/preview/host.sh')], {
        cwd: dir, encoding: 'utf8', env: { ...process.env,
          PATH: `${join(dir, 'bin')}:${process.env.PATH}`, SCENARIO: scenario,
          CLOUDFLARE_API_TOKEN: scenario === 'missing-token' ? '' : 'fake-fixture',
          CLOUDFLARE_ACCOUNT_ID: 'fixture', PREVIEW_PROJECT: 'test-app-preview',
          PREVIEW_BRANCH: 'task-preview', GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: output,
        },
      });
      if (scenario === 'success') {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(readFileSync(summary, 'utf8').trim(), 'https://abc123.test-app-preview.pages.dev');
        assert.equal(readFileSync(output, 'utf8').trim(), 'url=https://abc123.test-app-preview.pages.dev');
        assert.match(readFileSync(join(dir, 'dist/_headers'), 'utf8'), /X-Robots-Tag: noindex/);
      } else {
        assert.notEqual(result.status, 0);
        assert.match(readFileSync(summary, 'utf8'), /NAMED STOP \[PREVIEW_HOST_FAILED\]/);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
