import type { PlanProgress } from '@core/plan-progress';

/** A stalled device read must leave a way back to the plan. The caller ignores
 * late results after this promise settles or its screen loses focus. */
export async function loadTraditions(read: () => Promise<PlanProgress>, timeoutMs = 10000): Promise<PlanProgress> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('TRADITIONS_LOAD_TIMEOUT')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
