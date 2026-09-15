#!/usr/bin/env node
/**
 * GUARD: every workflow that commits to a branch from CI pushes through
 * scripts/ci/push_back.sh, and push_back.sh demonstrably survives the two ways a
 * push to main fails after every gate has passed.
 *
 * WHAT WENT WRONG
 * ---------------
 * Full Safe Autonomy run 34957914196 (main, 2026-09-15T10:26Z) was green through
 * every gate - publish HELD_AWAITING_AUTHORING as a named stop, tree hygiene,
 * cadence determinism, seed contract, self-heal contract - and then its final
 * step, `git pull --rebase` followed by a bare `git push`, logged:
 *
 *   [main 7f8bbfd] authority: record distribution receipts
 *   ...
 *   ! [remote rejected] HEAD -> main (cannot lock ref 'refs/heads/main':
 *       is at 7f8bbfd76dde... but expected fd94a6fbe275...)
 *
 * The sha the server said the ref was "at" is the sha the step had just
 * committed. The update had been applied; the response said it had not. Nothing
 * else pushed to main in that window - `git log main` shows fd94a6f then 7f8bbfd,
 * both from this run - and the receipts are on main today. The run went red and
 * paged a human for a push that had succeeded, because a bare `git push` treats
 * "the ref is not where I expected" as final without asking where the ref is.
 *
 * The same bare push is equally blind to the ordinary race, where another lane
 * lands between the rebase and the push. Both are cleared by fetch, rebase,
 * bounded retry, and a check for "the ref already contains HEAD". Only a genuine
 * rebase conflict should be red, and it must be red with a name.
 *
 * WHAT THIS ASSERTS
 * -----------------
 *  1. BEHAVIOUR. push_back.sh is run against throwaway bare repositories under
 *     four scenarios and must produce the named outcome for each:
 *       - apply-then-reject (run 34957914196's shape): the server applies the
 *         update and reports a rejection. Expect exit 0, PUSH_ALREADY_LANDED.
 *       - concurrent push: another commit lands on the ref before the push.
 *         Expect exit 0, PUSHED, and the remote ref must contain both commits.
 *       - genuine conflict: the concurrent commit edits the same line. Expect
 *         exit 1, PUSH_REBASE_CONFLICT, and the remote ref must be unchanged.
 *       - nothing to push: HEAD is already on the ref. Expect exit 0,
 *         NOTHING_TO_PUSH.
 *     The bare `git pull --rebase && git push` the workflows used to run is run
 *     under the first scenario and must FAIL, so this validator can show that the
 *     thing it replaced was actually broken and is not passing on a fixture that
 *     any push would pass.
 *  2. CORPUS. Every workflow file under .github/workflows that contains a
 *     `git commit` must invoke scripts/ci/push_back.sh and must contain no bare
 *     `git push` in a code line (YAML comments are ignored). No workflow may
 *     force-push.
 *
 * Rule 0: it counts scenarios, workflow files and commit-and-push lanes, and
 * hard-fails on zero of any of them. Pointed at a tree with no workflows, or with
 * workflows that never commit, it fails rather than passing on an empty loop.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const WORKFLOW_DIR = '.github/workflows';
const SCRIPT = 'scripts/ci/push_back.sh';
const errors = [];

const scriptPath = path.join(ROOT, SCRIPT);
if (!fs.existsSync(scriptPath)) {
  console.error(`workflow push-back: FAIL - ${SCRIPT} does not exist, so no workflow can be using it.`);
  process.exit(1);
}

// ------------------------------------------------------------------ 1. behaviour
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'push-back-'));
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const git = (cwd, ...args) => {
  const r = sh('git', args, { cwd });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} in ${cwd} failed:\n${r.stderr}`);
  return r.stdout.trim();
};

/** A bare remote plus a clone with one commit on main. Returns paths. */
function fixture(name) {
  const dir = path.join(tmp, name);
  const remote = path.join(dir, 'remote.git');
  const work = path.join(dir, 'work');
  const other = path.join(dir, 'other');
  fs.mkdirSync(dir, { recursive: true });
  // --initial-branch and -b: the fixture must not depend on init.defaultBranch.
  // On a runner where it is unset the `other` clone would start on an unborn
  // `master`, its commit would have no parent, and the race scenarios would fail
  // in the fixture rather than in the script under test.
  git(dir, 'init', '-q', '--bare', '--initial-branch=main', remote);
  git(dir, 'clone', '-q', remote, work);
  for (const c of [work]) { git(c, 'config', 'user.email', 'a@b'); git(c, 'config', 'user.name', 'a'); }
  fs.writeFileSync(path.join(work, 'f'), 'line1\nline2\n');
  git(work, 'add', 'f'); git(work, 'commit', '-qm', 'base'); git(work, 'branch', '-M', 'main'); git(work, 'push', '-q', 'origin', 'main');
  git(dir, 'clone', '-q', '-b', 'main', remote, other);
  git(other, 'config', 'user.email', 'b@b'); git(other, 'config', 'user.name', 'b');
  return { dir, remote, work, other };
}

/** Pre-receive hook that applies the update out-of-band and then declines, once. */
function installApplyThenReject(remote, work) {
  const hook = path.join(remote, 'hooks', 'pre-receive');
  fs.writeFileSync(hook, `#!/bin/sh
read old new ref
if [ ! -f "$GIT_DIR/fired" ]; then
  touch "$GIT_DIR/fired"
  env -i PATH="$PATH" HOME="$HOME" git -C "${work}" push -q origin HEAD:refs/heads/main
  exit 1
fi
exit 0
`);
  fs.chmodSync(hook, 0o755);
}

const runPushBack = (cwd) => sh('bash', [scriptPath, 'main'], { cwd, env: { ...process.env, PUSH_BACK_BACKOFF_SECONDS: '0', PUSH_BACK_ATTEMPTS: '3' } });
const outcomeOf = (r) => ((r.stdout || '').match(/^push_back: ([A-Z_]+)/m) || [])[1] || '(none)';

let scenarios = 0;
function scenario(name, fn) {
  scenarios += 1;
  try { fn(); } catch (e) { errors.push(`scenario "${name}": ${e.message}`); }
}

scenario('apply-then-reject: the bare push the workflows used to run fails', () => {
  const f = fixture('prefix');
  installApplyThenReject(f.remote, f.work);
  fs.writeFileSync(path.join(f.work, 'r'), 'receipts\n'); git(f.work, 'add', 'r'); git(f.work, 'commit', '-qm', 'record receipts');
  const r = sh('bash', ['-c', 'git pull -q --rebase --autostash origin main && git push origin HEAD:main'], { cwd: f.work });
  const remoteMain = git(f.remote, 'rev-parse', 'main');
  const head = git(f.work, 'rev-parse', 'HEAD');
  if (r.status === 0) throw new Error('the pre-fix bare push exited 0 against an apply-then-reject server, so this fixture does not reproduce run 34957914196 and the scenarios below prove nothing');
  if (remoteMain !== head) throw new Error(`fixture is wrong: after apply-then-reject the remote should hold the pushed commit ${head} but is at ${remoteMain}`);
});

scenario('apply-then-reject: push_back.sh recovers as PUSH_ALREADY_LANDED', () => {
  const f = fixture('landed');
  installApplyThenReject(f.remote, f.work);
  fs.writeFileSync(path.join(f.work, 'r'), 'receipts\n'); git(f.work, 'add', 'r'); git(f.work, 'commit', '-qm', 'record receipts');
  const r = runPushBack(f.work);
  const code = outcomeOf(r);
  if (r.status !== 0 || code !== 'PUSH_ALREADY_LANDED') throw new Error(`expected exit 0 / PUSH_ALREADY_LANDED, got exit ${r.status} / ${code}\n${r.stdout}${r.stderr}`);
  if (git(f.remote, 'rev-parse', 'main') !== git(f.work, 'rev-parse', 'HEAD')) throw new Error('remote main does not hold HEAD after PUSH_ALREADY_LANDED');
});

scenario('concurrent push: push_back.sh rebases and lands as PUSHED', () => {
  const f = fixture('race');
  fs.writeFileSync(path.join(f.other, 'g'), 'other lane\n'); git(f.other, 'add', 'g'); git(f.other, 'commit', '-qm', 'other lane'); git(f.other, 'push', '-q', 'origin', 'HEAD:main');
  const otherSha = git(f.other, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(f.work, 'r'), 'receipts\n'); git(f.work, 'add', 'r'); git(f.work, 'commit', '-qm', 'record receipts');
  const r = runPushBack(f.work);
  const code = outcomeOf(r);
  if (r.status !== 0 || code !== 'PUSHED') throw new Error(`expected exit 0 / PUSHED, got exit ${r.status} / ${code}\n${r.stdout}${r.stderr}`);
  const remoteMain = git(f.remote, 'rev-parse', 'main');
  if (remoteMain !== git(f.work, 'rev-parse', 'HEAD')) throw new Error('remote main is not the pushed HEAD');
  if (sh('git', ['merge-base', '--is-ancestor', otherSha, remoteMain], { cwd: f.work }).status !== 0) throw new Error('the concurrent commit was lost from main - the push rewrote history');
  if (!fs.existsSync(path.join(f.work, 'g'))) throw new Error('the concurrent commit is not in the working tree after rebase');
});

scenario('genuine conflict: push_back.sh stops as PUSH_REBASE_CONFLICT and forces nothing', () => {
  const f = fixture('conflict');
  const before = git(f.remote, 'rev-parse', 'main');
  fs.writeFileSync(path.join(f.other, 'f'), 'theirs\nline2\n'); git(f.other, 'add', 'f'); git(f.other, 'commit', '-qm', 'other edit'); git(f.other, 'push', '-q', 'origin', 'HEAD:main');
  const otherSha = git(f.other, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(f.work, 'f'), 'ours\nline2\n'); git(f.work, 'add', 'f'); git(f.work, 'commit', '-qm', 'our edit');
  const r = runPushBack(f.work);
  const code = outcomeOf(r);
  if (r.status === 0 || code !== 'PUSH_REBASE_CONFLICT') throw new Error(`expected exit 1 / PUSH_REBASE_CONFLICT, got exit ${r.status} / ${code}\n${r.stdout}${r.stderr}`);
  const after = git(f.remote, 'rev-parse', 'main');
  if (after !== otherSha) throw new Error(`remote main moved from ${otherSha} to ${after} on a conflict (was ${before} before the other lane) - a conflict must push nothing`);
  if (fs.existsSync(path.join(f.work, '.git', 'rebase-merge'))) throw new Error('rebase left in progress after PUSH_REBASE_CONFLICT');
});

scenario('nothing to push: push_back.sh names it and exits 0', () => {
  const f = fixture('noop');
  const r = runPushBack(f.work);
  const code = outcomeOf(r);
  if (r.status !== 0 || code !== 'NOTHING_TO_PUSH') throw new Error(`expected exit 0 / NOTHING_TO_PUSH, got exit ${r.status} / ${code}\n${r.stdout}${r.stderr}`);
});

fs.rmSync(tmp, { recursive: true, force: true });

if (scenarios === 0) {
  console.error('workflow push-back: FAIL - zero behaviour scenarios ran, so push_back.sh was never shown to work.');
  process.exit(1);
}

// -------------------------------------------------------------------- 2. corpus
const dir = path.join(ROOT, WORKFLOW_DIR);
if (!fs.existsSync(dir)) {
  console.error(`workflow push-back: FAIL - ${WORKFLOW_DIR} does not exist, so there is nothing to check. A validator with no subject has not passed.`);
  process.exit(1);
}
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
if (files.length === 0) {
  console.error(`workflow push-back: FAIL - no workflow files in ${WORKFLOW_DIR}.`);
  process.exit(1);
}

let lanes = 0;
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  // Code lines only: these workflows quote the defect in their own comments.
  const lines = raw.split('\n').map((l) => (/^\s*#/.test(l) ? '' : l));
  const commits = lines.some((l) => /\bgit commit\b/.test(l));
  if (!commits) continue;
  lanes += 1;
  const where = `${WORKFLOW_DIR}/${file}`;
  lines.forEach((l, i) => {
    if (/\bgit push\b/.test(l)) errors.push(`${where}:${i + 1}: bare \`git push\` in a lane that commits from CI. A rejected push here turns a green run red even when the push landed (run 34957914196). Push through ${SCRIPT} instead:\n      ${l.trim()}`);
    if (/--force(-with-lease)?\b/.test(l) && /\bgit\b/.test(l)) errors.push(`${where}:${i + 1}: a scheduled lane must never force-push:\n      ${l.trim()}`);
  });
  if (!lines.some((l) => l.includes(SCRIPT))) errors.push(`${where}: commits from CI but never invokes ${SCRIPT}, so whatever it pushes with is unguarded.`);
}

if (lanes === 0) {
  console.error(`workflow push-back: FAIL - ${files.length} workflow file(s) but none of them commits from CI, so the corpus check examined zero lanes. Either every commit-and-push lane was removed or the scanner is not reading these files.`);
  process.exit(1);
}

if (errors.length) {
  console.error('WORKFLOW PUSH-BACK FAILED:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`workflow push-back: PASS (${scenarios} behaviour scenarios, ${files.length} workflow files, ${lanes} commit-and-push lanes all routed through ${SCRIPT})`);
