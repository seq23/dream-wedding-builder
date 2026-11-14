// The scorecard's result that counts (13 Nov 2026): brides who reach a dated plan after
// starting at step 1. One row per visitor per day (salted IP hash, UNIQUE), written
// only when a bride with a step-2 answer enters a date or taps "I don't have a date yet".
// No words, no date, no email: just that it happened.
import { sha256, type D1Like } from '@/lib/ai-draft';
import { isTesterHash } from '@/lib/wedding-read';

export const JOURNEY_REACH_DDL = `CREATE TABLE IF NOT EXISTS journey_plan_reach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  via TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ip_hash, day)
)`;

export async function recordReach(input: { db: D1Like | undefined; via: unknown; ip: string; today: string; salt: string; isTest: boolean; testerHashes?: string; log?: (l: string) => void }): Promise<'recorded' | 'already' | 'skipped'> {
  const log = input.log ?? ((l: string) => console.error(l));
  const via = input.via === 'no_date' ? 'no_date' : input.via === 'date' ? 'date' : '';
  if (!via) return 'skipped';
  if (!input.db || !input.salt) { log('NAMED STOP [JOURNEY_REACH_NOT_COUNTED] D1 or the salt is missing; a dated plan was reached and not counted'); return 'skipped'; }
  await input.db.prepare(JOURNEY_REACH_DDL).run();
  const ipHash = await sha256(`${input.salt}:ip:${input.ip || 'unknown'}`);
  const row = await input.db.prepare('INSERT INTO journey_plan_reach (ip_hash, day, via, is_test) VALUES (?, ?, ?, ?) ON CONFLICT(ip_hash, day) DO NOTHING RETURNING id').bind(ipHash, input.today, via, input.isTest || isTesterHash(ipHash, input.testerHashes) ? 1 : 0).first();
  return row ? 'recorded' : 'already';
}
