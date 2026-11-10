// The verdict for /api/health/email (rule 0, 7 Nov 2026).
export const STALE_HOURS = 3;
export function judge(last: { ran_at: string; sent: number; failed: number; stop: string | null } | null, now = Date.now()) {
  if (!last) return { status: 'NAMED STOP [NURTURE_NOT_RUNNING] no nurture run recorded yet', ok: false };
  const age = now - Date.parse(`${String(last.ran_at).replace(' ', 'T')}Z`);
  if (!(age <= STALE_HOURS * 3_600_000)) return { status: `NAMED STOP [NURTURE_NOT_RUNNING] last run ${last.ran_at} UTC, over ${STALE_HOURS} hours ago`, ok: false };
  if (last.stop) return { status: last.stop, ok: false };
  return { status: 'OK', ok: true };
}

