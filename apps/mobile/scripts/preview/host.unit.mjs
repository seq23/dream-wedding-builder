import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publish } from './host.mjs';

function fixture(t, responses, envOverride = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'app-preview-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'index.html'), '<html></html>');
  const calls = [];
  const env = { CLOUDFLARE_API_TOKEN: 'fake', CLOUDFLARE_ACCOUNT_ID: 'fake', ...envOverride };
  return { directory, calls, options: { project: 'sample-preview', branch: 'work/test', directory, env,
    run: (command, args) => { calls.push([command, ...args]); return responses.shift(); } } };
}
const ok = (stdout = '') => ({ status: 0, stdout });
test('creates missing project, publishes the branch and blocks indexing', t => {
  const f = fixture(t, [ok('[]'), ok(), ok('Deployment complete! Take a peek over at https://abc.sample-preview.pages.dev')]);
  assert.equal(publish(f.options), 'https://abc.sample-preview.pages.dev');
  assert.ok(f.calls[1].includes('create'));
  assert.equal(f.calls[2].at(-1), 'work/test');
  assert.match(readFileSync(join(f.directory, '_headers'), 'utf8'), /X-Robots-Tag: noindex/);
});
test('reuses an existing project', t => {
  const f = fixture(t, [ok('[{"name":"sample-preview"}]'), ok('Deployment complete! Take a peek over at https://abc.sample-preview.pages.dev')]);
  publish(f.options);
  assert.equal(f.calls.length, 2);
});
for (const [label, responses] of [
  ['unconfirmed deployment', [ok('[]'), ok(), ok("Deployment complete! However, we couldn't ascertain the final status of your deployment. https://abc.sample-preview.pages.dev")]],
  ['no URL', [ok('[{"name":"sample-preview"}]'), ok('Uploaded')]],
  ['wrong project URL', [ok('[]'), ok(), ok('Deployment complete! Take a peek over at https://abc.somewhere-else.pages.dev')]],
  ['refused deploy', [ok('[]'), ok(), {status: 1}]],
  ['refused project list', [{status: 1}]],
  ['invalid project list', [ok('invalid')]],
  ['refused creation', [ok('[]'), {status: 1}]],
]) test(label + ' fails closed', t => {
  assert.throws(() => publish(fixture(t, responses).options), /PREVIEW_HOST_FAILED/);
});
test('missing credential stops before any provider call', t => {
  const f = fixture(t, [], { CLOUDFLARE_API_TOKEN: '' });
  assert.throws(() => publish(f.options), /PREVIEW_HOST_FAILED/);
  assert.equal(f.calls.length, 0);
});
