import { taskKey } from '@core/plan-progress';
import { eventStore } from './eventStore';
import { downloadStore } from './downloadStore';
import { progressStore } from '../planTasks';
import { sharedPlan, type SharedPlan } from '../sharing/session';
import type { DateStorage } from '../weddingDate';

/** An owner needs both a paid event and content delivered through the verified
 * door. Opening the plan never needs an invite, SDK restore or connection. */
export async function downloadedOwnerPlan(storage: DateStorage): Promise<SharedPlan | null> {
  const events = eventStore(storage);
  const event = await events.active();
  if (!event?.fullPlan) return null;
  const content = await downloadStore(storage).saved();
  if (!content) return null;
  const progress = await progressStore(storage).read();
  const actor = '0'.repeat(32);
  const keys = new Set([...content.list.tasks.map(t => taskKey(t.window, t.text)), ...progress.custom.map(t => `own::${t.id}`)]);
  const ticks = Object.fromEntries(Object.entries(progress.done).filter(([key]) => keys.has(key)).map(([key, at]) => [key, { at: new Date(at).getTime(), actor, done: true }]));
  const custom = Object.fromEntries(progress.custom.map(t => [t.id, { value: t, at: 0, actor }]));
  return sharedPlan({ event, ...content, ticks, custom, history: await events.read(), joined: false });
}
