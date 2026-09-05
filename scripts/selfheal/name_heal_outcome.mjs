#!/usr/bin/env node
/**
 * Name the self-heal outcome, to the log and to the job summary.
 *
 * WHY THIS IS A FILE AND NOT `node -e` IN THE WORKFLOW
 * ---------------------------------------------------
 * It used to be a here-doc'd script inside a double-quoted `node -e "..."` in
 * .github/workflows/full-safe-autonomy.yml. One line of it read:
 *
 *     lines.push('  - registry defect - **'+id+'** repair_command is not runnable: `'+cmd+'`');
 *
 * Inside a double-quoted shell word, a backtick is command substitution. bash
 * therefore ran `'+cmd+'` as a command before node ever saw the script. Scheduled
 * run 33863160216 (Full Safe Autonomy, main, 2026-09-04) logged exactly that:
 *
 *     /home/runner/work/_temp/e9bde18c-....sh: line 1: +cmd+: command not found
 *
 * The failed substitution expanded to the empty string, so the line node actually
 * executed was `... is not runnable: '+''+''`. The command was deleted from the
 * message. The job summary the owner reads the next morning said:
 *
 *     - registry defect - **internal-link-graph** repair_command is not runnable:
 *
 * naming the defect but not the command, which is the one fact the line exists to
 * carry. This is the repo's recurring "runs but inert" class wearing a new hat: the
 * step exited 0, printed something that looked like a diagnostic, and had silently
 * dropped its payload.
 *
 * Escaping the backtick would have fixed this instance. Moving the script into a
 * file removes the shell from the path entirely, so no future edit to this logic can
 * reintroduce a quoting defect - and, unlike YAML-embedded JS, it can be executed
 * against fixtures. scripts/validators/validate_workflow_inline_shell_quoting.mjs
 * guards the class across every workflow.
 *
 * Rule 0: this step must never exit 0 having said nothing. A missing report is a
 * NAMED STOP, printed and summarised, not silence.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT = 'reports/validation/self-heal-loop.json';

const out = [];
const say = (line) => { console.log(line); out.push(line); };

const reportPath = path.join(ROOT, REPORT);

if (!fs.existsSync(reportPath)) {
  // A named stop, not silence: the reader learns that the loop produced no
  // artifact, which is itself the finding.
  say(`## self-heal: NO REPORT`);
  say(`self-heal produced no report at ${REPORT} - the loop did not run, or exited before writing one.`);
  writeSummary();
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const attempts = report.attempts ?? [];

say(`## self-heal: ${report.status} (safe_to_push=${report.safe_to_push})`);

if (attempts.length === 0) {
  say('- no attempts were recorded, so nothing about the tree was proved by this loop.');
}

for (const a of attempts) {
  const failed = a.failed ?? [];
  say(`- attempt ${a.attempt}: **${a.result}**${failed.length ? ` failed: ${failed.join(', ')}` : ''}`);

  for (const [id, text] of Object.entries(a.manual ?? {})) {
    say(`  - fix by hand - **${id}**: ${text}`);
  }

  // The line that lost its payload. `cmd` is interpolated by node now, so a
  // backtick, a dollar sign or a quote inside a repair_command reaches the reader
  // intact instead of being eaten by bash.
  for (const [id, cmd] of Object.entries(a.unrunnable_repairs ?? {})) {
    const line = `  - registry defect - **${id}** repair_command is not runnable: \`${cmd}\``;
    console.error(`  registry defect: ${id} repair_command is not runnable: ${cmd}`);
    out.push(line);
  }

  if (a.result === 'NO_REPAIR_AVAILABLE') {
    const msg = `  - no automated repair for: ${failed.join(', ')} - add a repair_command in _repo_validation_registry.json, or a manual_repair if no script can fix it`;
    console.error(msg.trim());
    out.push(msg);
  }
}

writeSummary();

function writeSummary() {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || '/dev/stdout', out.join('\n') + '\n');
}
