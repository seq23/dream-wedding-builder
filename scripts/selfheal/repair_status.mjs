#!/usr/bin/env node
/**
 * The status contract for a self-heal repair attempt.
 *
 * Written against a reproduced defect. On 2026-09-03 the scheduled "Full Safe
 * Autonomy" lane printed this, three times:
 *
 *     repair FAILED for internal-link-graph (exit 2)
 *     ...
 *     attempt 1: REPAIRED_RETRYING failed=[internal-link-graph]
 *     attempt 2: REPAIRED_RETRYING failed=[internal-link-graph]
 *     attempt 3: REPAIRED_RETRYING failed=[internal-link-graph]
 *
 * The loop knew the repair had failed - it said so on the line above - and then
 * recorded REPAIRED_RETRYING anyway, because `result` was a string literal
 * written unconditionally after the repair loop and never derived from what the
 * repairs did. So a repair that failed claimed it had repaired something, the
 * loop retried an unchanged tree until it ran out of attempts, and the report a
 * human reads named the wrong failure mode. PR #10 removed the prose that made
 * that particular repair unrunnable; it did not touch the mismapping, which
 * applies identically to any of the six real repair commands.
 *
 * Two defect classes are covered here, and they are the same class twice:
 *
 *   - a repair that exits non-zero must never be reported as a repair
 *   - a repair that exits zero having changed nothing must never be reported as
 *     a repair either. That is Rule 0 at the granularity of a single command:
 *     exit 0 having done nothing is not work done. Progress is measured against
 *     the tree, not against an exit code, because retrying a byte-identical tree
 *     can only produce a byte-identical failure.
 *
 * These functions are pure so that validate_selfheal_status_contract.mjs can
 * assert the mapping directly rather than asserting prose about it, and so that
 * there is exactly one place the mapping lives. heal_until_clean.mjs imports
 * them; the guard checks that it does, because a contract nothing calls is the
 * other recurring defect in this repo.
 */

/** Outcome of one repair command. */
export const REPAIRED = 'REPAIRED';
export const FAILED = 'FAILED';
export const NO_OP = 'NO_OP';
export const DRY_RUN_SKIPPED = 'DRY_RUN_SKIPPED';

/** Result of one attempt of the validate -> repair -> revalidate loop. */
export const REPAIRED_RETRYING = 'REPAIRED_RETRYING';
export const REPAIR_FAILED = 'REPAIR_FAILED';
export const REPAIR_INEFFECTIVE = 'REPAIR_INEFFECTIVE';
export const DRY_RUN = 'DRY_RUN';

/** Every outcome that is honestly "something in the tree is now different". */
const PROGRESS = new Set([REPAIRED]);

/**
 * Classify a single repair command.
 *
 * `changed` must be a boolean whenever the command actually ran: it is the
 * before/after tree fingerprint comparison. Passing undefined throws rather than
 * defaulting, so a caller cannot reintroduce the original defect by simply not
 * measuring - an unmeasured repair is indistinguishable from a lying one, and
 * this contract refuses to guess in the direction of "it worked".
 */
export function classifyRepair({ code, changed, dry = false } = {}) {
  if (dry) return DRY_RUN_SKIPPED;
  if (!Number.isInteger(code)) {
    throw new TypeError('classifyRepair: `code` must be the integer exit status of the repair command');
  }
  if (code !== 0) return FAILED;
  if (typeof changed !== 'boolean') {
    throw new TypeError('classifyRepair: `changed` must be a boolean - a repair that exits 0 is only a repair if the tree it was supposed to fix is now different');
  }
  return changed ? REPAIRED : NO_OP;
}

/**
 * Classify the attempt from its repairs' outcomes.
 *
 * Retrying is only warranted when the tree changed, so REPAIRED_RETRYING is
 * reachable only when at least one repair genuinely repaired. Everything else
 * names why the attempt made no progress, and `shouldRetry` says to stop - which
 * is what turns the observed "three identical attempts" into one honest report.
 */
export function classifyAttempt(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    throw new TypeError('classifyAttempt: an attempt that ran zero repairs has no repair result - the caller must report NO_REPAIR_AVAILABLE instead of classifying an empty attempt');
  }
  if (outcomes.every((o) => o === DRY_RUN_SKIPPED)) return DRY_RUN;
  if (outcomes.some((o) => PROGRESS.has(o))) return REPAIRED_RETRYING;
  if (outcomes.some((o) => o === FAILED)) return REPAIR_FAILED;
  return REPAIR_INEFFECTIVE;
}

/** Only a tree that actually changed can produce a different validation result. */
export function shouldRetry(attemptResult) {
  return attemptResult === REPAIRED_RETRYING;
}

/** Human-readable reason, used in the log and carried into the JSON report. */
export function explain(attemptResult, failedIds = []) {
  const names = failedIds.join(', ') || 'nothing';
  switch (attemptResult) {
    case REPAIRED_RETRYING:
      return `at least one repair changed the tree; revalidating ${names}`;
    case REPAIR_FAILED:
      return `every repair for ${names} exited non-zero, so the tree is unchanged - retrying it would fail identically`;
    case REPAIR_INEFFECTIVE:
      return `every repair for ${names} exited 0 without changing a single file, so the failure it was registered against cannot have been fixed - this is a repair that reports success having done nothing`;
    case DRY_RUN:
      return `dry run: repairs for ${names} were listed, not executed`;
    default:
      return `unclassified attempt result ${attemptResult}`;
  }
}
