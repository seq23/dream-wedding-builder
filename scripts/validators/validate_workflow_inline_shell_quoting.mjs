#!/usr/bin/env node
/**
 * GUARD: a script embedded in a workflow must reach its interpreter unmodified.
 *
 * WHAT WENT WRONG
 * ---------------
 * .github/workflows/full-safe-autonomy.yml ran the self-heal reporter as
 * `node -e "..."`. One line of the embedded JavaScript was:
 *
 *     lines.push('  - registry defect - **'+id+'** repair_command is not runnable: `'+cmd+'`');
 *
 * Inside a double-quoted shell word a backtick is command substitution. bash
 * evaluated `'+cmd+'` as a command before node ever saw the script. Scheduled run
 * 33863160216 (Full Safe Autonomy, main, 2026-09-04) logged it verbatim:
 *
 *     /home/runner/work/_temp/e9bde18c-....sh: line 1: +cmd+: command not found
 *
 * The substitution failed, so it expanded to the empty string and the source node
 * executed became `... is not runnable: '+''+''`. The job summary printed the
 * defect without the command:
 *
 *     - registry defect - **internal-link-graph** repair_command is not runnable:
 *
 * The step still exited 0. This is the "runs but inert" class the repo keeps
 * rediscovering: a diagnostic that survives, looks like output, and has quietly
 * dropped the one fact it exists to carry.
 *
 * WHY A REGEX ON THE SOURCE IS THE RIGHT INSTRUMENT HERE
 * -----------------------------------------------------
 * The defect is lexical and total: within a double-quoted shell word, exactly four
 * characters are special - ` $ \ " - and any unescaped occurrence of the first two
 * inside an embedded script body is a corruption of that script, with no exceptions
 * to reason about. The check cannot be made by executing the body, because
 * executing it is precisely the harm being prevented.
 *
 * WHAT THIS ASSERTS
 * -----------------
 *  1. DETECTOR. The scanner is run over a table of known-bad and known-good bodies,
 *     including the exact line from run 33863160216. Every bad case must be flagged
 *     and every good case must not. A scanner that cannot demonstrate a failure is
 *     not evidence that the corpus is clean.
 *  2. CORPUS. Every inline interpreter script in every workflow is scanned.
 *
 * Rule 0: it counts detector cases, workflow files and `run:` blocks, and hard-fails
 * on zero of any of them rather than passing on an empty loop. In particular, a
 * corpus that happens to contain no inline scripts still has to get past the
 * detector table, so this gate can never pass by having found nothing to look at.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOW_DIR = '.github/workflows';
const errors = [];

// Interpreters that take a script as one shell-quoted argument. Each of these turns
// the shell into a preprocessor for a language that is not the shell.
const INLINE_INVOCATION = /\b(?:node\s+(?:-e|--eval)|python3?\s+-c|ruby\s+-e|perl\s+-e|bash\s+-c|sh\s+-c)\s+"/g;

/**
 * Find the shell-active characters in a double-quoted body.
 *
 * Within double quotes bash honours a backslash escape only before ` $ " \ and
 * newline; anywhere else the backslash is literal. So `\`` is a safely escaped
 * backtick, but a bare ` or $ is the interpreter reading the script.
 */
function shellActive(body) {
  const hits = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\') {
      const next = body[i + 1];
      if (next === '`' || next === '$' || next === '"' || next === '\\' || next === '\n') { i++; continue; }
      continue;
    }
    if (ch === '`') hits.push({ ch: '`', i, why: 'command substitution - bash runs what follows it as a command' });
    if (ch === '$') hits.push({ ch: '$', i, why: 'parameter expansion - bash substitutes a variable before the interpreter sees it' });
  }
  return hits;
}

/** Extract every inline interpreter script body from one file's text. */
function inlineScripts(text) {
  const found = [];
  INLINE_INVOCATION.lastIndex = 0;
  let m;
  while ((m = INLINE_INVOCATION.exec(text)) !== null) {
    const bodyStart = m.index + m[0].length;
    // Walk to the closing unescaped double quote.
    let end = -1;
    for (let i = bodyStart; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '"') { end = i; break; }
    }
    if (end === -1) {
      found.push({ invocation: m[0].trim(), body: text.slice(bodyStart), unterminated: true, offset: bodyStart });
      continue;
    }
    found.push({ invocation: m[0].trim(), body: text.slice(bodyStart, end), unterminated: false, offset: bodyStart });
  }
  return found;
}

const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;

// ------------------------------------------------------------------ 1. detector
//
// The regression case is first and is quoted from the run that produced it.
const DETECTOR_CASES = [
  {
    name: 'run 33863160216: backtick around an interpolated command',
    body: "\nlines.push('  - registry defect - **'+id+'** repair_command is not runnable: `'+cmd+'`');\n",
    shouldFlag: true,
  },
  { name: 'JS template literal', body: "\nconsole.log(`value is ${x}`);\n", shouldFlag: true },
  { name: 'bare dollar expansion', body: "\nconst v = process.env.HOME + '$USER';\n", shouldFlag: true },
  { name: 'markdown code span in a message', body: "\nconsole.log('run `npm ci` first');\n", shouldFlag: true },
  { name: 'clean string concatenation', body: "\nconsole.log('publish outcome: '+o.outcome);\n", shouldFlag: false },
  { name: 'escaped newline only', body: "\nfs.appendFileSync(p, lines.join('\\\\n'));\n", shouldFlag: false },
  // One backslash before the backtick: bash consumes the escape and passes a
  // literal backtick through. Two backslashes would escape the backslash and leave
  // the backtick live again, which is why this case is spelled out rather than
  // eyeballed.
  { name: 'explicitly escaped backtick', body: "\nconsole.log('a \\`b\\` c');\n", shouldFlag: false },
  { name: 'two backslashes leave the backtick live', body: "\nconsole.log('a \\\\`b');\n", shouldFlag: true },
];

let casesExamined = 0;
for (const c of DETECTOR_CASES) {
  const flagged = shellActive(c.body).length > 0;
  if (flagged !== c.shouldFlag) {
    errors.push(`detector case "${c.name}" ${c.shouldFlag ? 'should have been flagged and was not' : 'was flagged and should not have been'}. The scanner does not implement double-quote semantics, so its verdict on the workflows means nothing.`);
  }
  casesExamined += 1;
}

if (casesExamined === 0) {
  console.error('workflow inline shell quoting: FAIL - zero detector cases were run, so the scanner was never shown to work.');
  process.exit(1);
}

// -------------------------------------------------------------------- 2. corpus
const dir = path.join(ROOT, WORKFLOW_DIR);
if (!fs.existsSync(dir)) {
  console.error(`workflow inline shell quoting: FAIL - ${WORKFLOW_DIR} does not exist, so there is nothing to scan. A validator with no subject has not passed.`);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
if (files.length === 0) {
  console.error(`workflow inline shell quoting: FAIL - no workflow files in ${WORKFLOW_DIR}.`);
  process.exit(1);
}

let runBlocks = 0;
let scriptsExamined = 0;

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');

  // Drop whole-line YAML comments. Several of these workflows quote the defect in
  // their own comments - including the line above - and a gate that flagged its own
  // documentation would be untrue.
  const text = raw.split('\n').map((l) => (/^\s*#/.test(l) ? '' : l)).join('\n');

  runBlocks += (text.match(/^\s*(?:-\s*)?run:/gm) || []).length;

  for (const s of inlineScripts(text)) {
    scriptsExamined += 1;
    const where = `${WORKFLOW_DIR}/${file}:${lineOf(text, s.offset)}`;
    if (s.unterminated) {
      errors.push(`${where}: \`${s.invocation}\` opens a double-quoted script that is never closed. The shell will consume the rest of the step.`);
      continue;
    }
    for (const hit of shellActive(s.body)) {
      const line = lineOf(text, s.offset + hit.i);
      const snippet = text.split('\n')[line - 1].trim();
      errors.push(`${WORKFLOW_DIR}/${file}:${line}: unescaped \`${hit.ch}\` inside an inline \`${s.invocation}\` script - ${hit.why}. The interpreter receives something other than what is written here.\n      ${snippet}\n      Fix: move the script into a file under scripts/ and call it, or escape it as \\${hit.ch}.`);
    }
  }
}

// Rule 0.
if (runBlocks === 0) {
  console.error(`workflow inline shell quoting: FAIL - ${files.length} workflow file(s) but zero \`run:\` blocks were found. The scanner is not reading these files.`);
  process.exit(1);
}

if (errors.length) {
  console.error('WORKFLOW INLINE SHELL QUOTING FAILED - a script embedded in a workflow is being rewritten by the shell before its interpreter sees it:');
  for (const e of errors) console.error(`  - ${e}`);
  console.error('\n  A script that the shell edits is not the script that was reviewed. Prefer a file under scripts/ over an inline body.');
  process.exit(1);
}

console.log(`workflow inline shell quoting: PASS (${casesExamined} detector cases, ${files.length} workflow files, ${runBlocks} run blocks, ${scriptsExamined} inline script(s) scanned)`);
