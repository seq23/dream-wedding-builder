import type { DateStorage } from '../weddingDate';
import { sharedPlan, sharedProgress, type SharedPlan, type sharingSession } from './session';
import type { PlanProgress } from '@core/plan-progress';
export const OWNER_PLAN_KEY = 'dw.sharing.owner-plan.v1';
export const SHARED_PAYMENTS_KEY = 'dw.sharing.payments.v1';
export const SHARED_WEEK_KEY = 'dw.sharing.week.v1';
/** Shared access is an overlay. Stopping/Leaving never writes personal purchase history. */
export function activeSharing(storage: DateStorage, session: ReturnType<typeof sharingSession>, activeEvent: () => Promise<{id: string; date?: string; name?: string} | null>, ownerPlan: () => Promise<SharedPlan | null> = async () => null) {
  async function plan(): Promise<SharedPlan | null> {
    const current = await session.read();
    if (current) return current.plan;
    const raw = await storage.getItem(OWNER_PLAN_KEY);
    if (!raw) return ownerPlan();
    const owner = sharedPlan(JSON.parse(raw));
    const active = await activeEvent();
    return active?.id === owner.event.id ? { ...owner, event: { ...owner.event, date: active.date ?? owner.event.date, name: active.name ?? owner.event.name } } : ownerPlan();
  }
  return {
    plan,
    async progress(fallback: () => Promise<PlanProgress>) { const value = await plan(); return value ? sharedProgress(value) : fallback(); },
    async update(change: (p: PlanProgress) => PlanProgress, fallback: () => Promise<PlanProgress>) {
      if (await session.read()) return session.updateProgress(change);
      const owner = await plan();
      if (!owner) return fallback();
      // After stopping, the owner keeps the full plan and ordinary local edits.
      const next = change(sharedProgress(owner));
      const custom = Object.fromEntries(next.custom.map(t => [t.id, { value: t, at: Date.now(), actor: '0'.repeat(32) }]));
      const ticks = Object.fromEntries(Object.entries(next.done).map(([key, at]) => [key, { at: new Date(at).getTime(), actor: '0'.repeat(32), done: true }]));
      await storage.setItem(OWNER_PLAN_KEY, JSON.stringify(sharedPlan({ ...owner, custom, ticks })));
      return next;
    },
    async stop() {
      await session.stop(plan => storage.setItem(OWNER_PLAN_KEY, JSON.stringify(plan)));
    },
  };
}
