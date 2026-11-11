/** False is an explicit untick tombstone: deleting it would resurrect old ticks.
 * actor is a stable random phone id, used only to resolve equal timestamps. */
export interface SharedTick { at: number; actor: string; done: boolean }
export type SharedTicks = Record<string, SharedTick>;
function valid(tick: SharedTick) {
  if (!tick || !Number.isSafeInteger(tick.at) || tick.at < 0 || !/^[a-f0-9]{32}$/.test(tick.actor) || typeof tick.done !== 'boolean') throw Error('Invalid shared tick.');
}
export function stampTick(ticks: SharedTicks, id: string, done: boolean, actor: string, now: number): SharedTicks {
  if (!id) throw Error('Invalid task.');
  const tick = { done, actor, at: Math.max(now, (ticks[id]?.at ?? -1) + 1) };
  valid(tick);
  return { ...ticks, [id]: tick };
}
export function mergeTicks(left: SharedTicks, right: SharedTicks): SharedTicks {
  const merged: SharedTicks = Object.create(null);
  for (const ticks of [left, right]) for (const [id, tick] of Object.entries(ticks)) {
    if (!id) throw Error('Invalid task.');
    valid(tick);
    const old = merged[id];
    if (!old || tick.at > old.at || (tick.at === old.at && (tick.actor > old.actor || (tick.actor === old.actor && Number(tick.done) > Number(old.done))))) merged[id] = { ...tick };
  }
  return merged;
}
