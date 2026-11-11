import { parseLedger } from '../billing/eventStore';
import type { EventLedger } from '../billing/events';
import { parseDay } from '@core/dated-plan';
import { parseFullPlan, type FullPlanList } from '@core/full-plan';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { parseTraditionPack, type TraditionPack, type TraditionCustomTask } from '../traditionPacks';
import { ownTaskKey } from '../planTasks';
import { emptyProgress, type PlanProgress } from '@core/plan-progress';
import { taskKey } from '@core/plan-progress';
import type { DateStorage } from '../weddingDate';
import { ShareConflict, ShareMissing, type shareClient } from './client';
import { parseInvite, SHARE_UNAVAILABLE, validateLink, type ShareLink } from './crypto';
import { mergeTicks, stampTick, type SharedTicks } from './ticks';

export const SHARE_SESSION_KEY = 'dw.sharing.session.v1';
export interface SharedEvent { id: string; name: string; date: string }
/** Payment amounts, purchase identities and download credentials never belong here.
 * Completion of payment tasks uses the same stamped ticks as every other task. */
export interface SharedCustom { at: number; actor: string; value: PlanProgress['custom'][number] | null }
export interface SharedPlan { history?: EventLedger; custom?: Record<string, SharedCustom>; packs?: TraditionPack[]; event: SharedEvent; list: FullPlanList; ticks: SharedTicks; joined: boolean }
export interface ShareSession {
  version: 1; role: 'owner' | 'joined'; link: ShareLink; plan: SharedPlan;
  revision: number; syncedAt: number;
}
type Client = ReturnType<typeof shareClient>;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(SHARE_UNAVAILABLE);
  return value as Record<string, unknown>;
};
export function sharedPlan(value: unknown): SharedPlan {
  const raw = record(value), event = record(raw.event);
  const list = parseFullPlan(raw.list);
  if (!list || typeof event.id !== 'string' || !event.id || typeof event.name !== 'string'
    || !event.name.trim() || event.name.length > 140 || typeof event.date !== 'string'
    || !parseDay(event.date) || typeof raw.joined !== 'boolean') throw Error(SHARE_UNAVAILABLE);
  // A strict projection keeps extra fields (including amounts/credentials) out of
  // both the encrypted document and the local shared-access cache.
  const keys = new Set(list.tasks.map(t => taskKey(t.window, t.text)));
  if (keys.size !== list.tasks.length) throw Error(SHARE_UNAVAILABLE);
  const custom: Record<string, SharedCustom> = Object.create(null);
  if (raw.custom !== undefined) for (const [id, entry] of Object.entries(record(raw.custom))) {
    const item = record(entry);
    mergeTicks({}, { [id]: { at: Number(item.at), actor: String(item.actor), done: true } });
    let value: PlanProgress['custom'][number] | null = null;
    if (item.value !== null) {
      const task = record(item.value);
      if (task.id !== id || typeof task.text !== 'string' || !task.text.trim() || task.text.length > 140
        || !PLAN_WINDOWS.some(w => w.id === task.windowId)) throw Error(SHARE_UNAVAILABLE);
      value = { id, text: task.text, windowId: String(task.windowId) };
      if (task.tradition !== undefined) {
        const tradition = record(task.tradition);
        if (typeof tradition.packId !== 'string' || typeof tradition.taskId !== 'string' || typeof tradition.text !== 'string'
          || typeof tradition.windowId !== 'string' || typeof tradition.source !== 'string') throw Error(SHARE_UNAVAILABLE);
        if (!parseTraditionPack({ id: tradition.packId, tasks: [{ id: tradition.taskId, windowId: tradition.windowId, text: tradition.text, source: tradition.source }] })) throw Error(SHARE_UNAVAILABLE);
        value = { ...value, tradition: { packId: tradition.packId, taskId: tradition.taskId, text: tradition.text, windowId: tradition.windowId, source: tradition.source } } as TraditionCustomTask;
      }
      keys.add(ownTaskKey(id));
    } else keys.add(ownTaskKey(id)); // tombstones may retain completion history
    custom[id] = { at: Number(item.at), actor: String(item.actor), value };
  }
  let packs: TraditionPack[] | undefined;
  if (raw.packs !== undefined) {
    if (!Array.isArray(raw.packs)) throw Error(SHARE_UNAVAILABLE);
    packs = raw.packs.map(p => { const pack = parseTraditionPack(p); if (!pack) throw Error(SHARE_UNAVAILABLE); return pack; });
  }
  const ticks = mergeTicks({}, record(raw.ticks) as SharedTicks);
  if (Object.keys(ticks).some(key => !keys.has(key))) throw Error(SHARE_UNAVAILABLE);
  return { event: { id: event.id, name: event.name, date: event.date }, list, ticks, joined: raw.joined, ...(raw.custom !== undefined ? { custom } : {}), ...(packs ? { packs } : {}), ...(raw.history !== undefined ? { history: (() => { const h = parseLedger(JSON.stringify(raw.history)); return { firstEventId: h.firstEventId, extras: h.extras, events: h.events.map(e => ({ id:e.id,name:e.name,date:e.date,dateChanges:e.dateChanges,fullPlan:e.fullPlan })) }; })() } : {}) };
}
export function sharedProgress(plan: SharedPlan): PlanProgress {
  const progress = emptyProgress();
  progress.custom = Object.values(plan.custom ?? {}).flatMap(row => row.value ? [row.value] : []);
  for (const [key, tick] of Object.entries(plan.ticks)) if (tick.done) progress.done[key] = new Date(tick.at).toISOString();
  return progress;
}
function mergeCustom(a: SharedPlan['custom'] = {}, b: SharedPlan['custom'] = {}) {
  const result = { ...a };
  for (const [id, row] of Object.entries(b)) {
    const old = result[id];
    if (!old || row.at > old.at || (row.at === old.at && (row.actor > old.actor || (row.actor === old.actor && JSON.stringify(row.value) > JSON.stringify(old.value))))) result[id] = row;
  }
  return result;
}
function parseSession(raw: string | null): ShareSession | null {
  if (raw === null) return null;
  try {
    const value = record(JSON.parse(raw));
    if (value.version !== 1 || (value.role !== 'owner' && value.role !== 'joined')
      || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
      || !Number.isSafeInteger(value.syncedAt) || Number(value.syncedAt) < 0) throw Error();
    const link = record(value.link);
    return { version: 1, role: value.role, link: validateLink({ id: String(link.id), key: String(link.key) }),
      plan: sharedPlan(value.plan), revision: Number(value.revision), syncedAt: Number(value.syncedAt) };
  } catch { throw Error(SHARE_UNAVAILABLE); }
}

/** One instance per phone. UI must use read() as a separate shared-plan overlay,
 * never copy it into the personal plan, purchase ledger or verified download cache.
 * `verifiedOwnerPlan` must come from the purchase coordinator's verified event,
 * never an SDK entitlement or an invite. This module creates no purchase grants.
 * A foreground coordinator calls sync() at least once a minute and on reconnect.
 */
export function sharingSession(storage: DateStorage, client: Client, actor: string, verifiedOwnerPlan: () => Promise<SharedPlan | null>, now = Date.now) {
  let queue: Promise<unknown> = Promise.resolve();
  const save = async (value: ShareSession | null) => { await storage.setItem(SHARE_SESSION_KEY, value ? JSON.stringify(value) : 'null'); };
  // Null tombstones use setItem so this store needs only the same atomic write
  // contract as the rest of the app. A deleted key and a null value mean no access.
  const current = async () => {
    const raw = await storage.getItem(SHARE_SESSION_KEY);
    return raw === 'null' ? null : parseSession(raw);
  };
  function serial<T>(job: () => Promise<T>): Promise<T> {
    const result = queue.then(job);
    queue = result.catch(() => {});
    return result;
  }
  async function requireSession() {
    const session = await current();
    if (!session) throw Error(SHARE_UNAVAILABLE);
    return session;
  }
  async function synchronize(): Promise<ShareSession | null> {
    const local = await current();
    if (!local) return null;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const latest = await client.read(local.link);
        const remote = sharedPlan(JSON.parse(latest.plaintext));
        if (remote.event.id !== local.plan.event.id) throw Error(SHARE_UNAVAILABLE);
        // The owner controls event metadata and the delivered list; joining can
        // only acknowledge acceptance and change ticks. A new owner list is a
        // separate verified-event update, never accepted from the joined phone.
        const base = local.role === 'owner' ? local.plan : remote;
        const ticks = mergeTicks(local.plan.ticks, remote.ticks);
        const custom = mergeCustom(local.plan.custom, remote.custom);
        const plan = sharedPlan({ ...base, ticks, ...(Object.keys(custom).length ? { custom } : {}), joined: local.role === 'joined' || local.plan.joined || remote.joined });
        let revision = latest.revision;
        if (JSON.stringify(plan) !== JSON.stringify(remote)) {
          try { revision = await client.write(local.link, JSON.stringify(plan), latest.revision); }
          catch (error) { if (error instanceof ShareConflict) continue; throw error; }
        }
        const next = { ...local, plan, revision, syncedAt: now() };
        await save(next);
        return next;
      }
      throw Error('Your ticks are saved on this phone. Try syncing again.');
    } catch (error) {
      if (error instanceof ShareMissing && local.role === 'joined') { await save(null); return null; }
      // No access is revoked for an outage or timeout; pending ticks stay local.
      throw error;
    }
  }
  return {
    read: current,
    drain: () => serial(current),
    invite: () => serial(async () => {
      if (await current()) throw Error('Leave or stop the current shared plan first.');
      const verified = await verifiedOwnerPlan();
      if (!verified) throw Error('The full plan is needed to invite your partner.');
      const plan = sharedPlan({ ...verified, joined: false });
      const link = await client.create(JSON.stringify(plan));
      const session: ShareSession = { version: 1, role: 'owner', link, plan, revision: 1, syncedAt: now() };
      try { await save(session); }
      catch (error) { await client.stop(link).catch(() => {}); throw error; }
      return session;
    }),
    /** Inspect before the acceptance button, with no local change or join marker. */
    inspect: async (invite: string) => {
      const link = parseInvite(invite);
      return sharedPlan(JSON.parse((await client.read(link)).plaintext)).event;
    },
    join: (invite: string) => serial(async () => {
      if (await current()) throw Error('Leave or stop the current shared plan first.');
      const link = parseInvite(invite), latest = await client.read(link);
      const plan = sharedPlan(JSON.parse(latest.plaintext));
      await save({ version: 1, role: 'joined', link, plan, revision: latest.revision, syncedAt: now() });
      // Join is durable even if the acknowledgement meets a network outage.
      // Let the caller show that syncing is pending and offer a retry.
      return synchronize();
    }),
    tick: (key: string, done: boolean) => serial(async () => {
      const session = await requireSession();
      const plan = sharedPlan({ ...session.plan, ticks: stampTick(session.plan.ticks, key, done, actor, now()) });
      await save({ ...session, plan });
      return plan;
    }),
    updateOwnerEvent: (event: SharedEvent) => serial(async () => {
      const session = await requireSession();
      if (session.role !== 'owner' || event.id !== session.plan.event.id) throw Error(SHARE_UNAVAILABLE);
      await save({ ...session, plan: sharedPlan({ ...session.plan, event }) });
    }),
    updateProgress: (change: (p: PlanProgress) => PlanProgress) => serial(async () => {
      const session = await requireSession(), before = sharedProgress(session.plan), after = change(before);
      const custom = { ...session.plan.custom };
      for (const id of new Set([...before.custom.map(t => t.id), ...after.custom.map(t => t.id)])) {
        const value = after.custom.find(t => t.id === id) ?? null;
        if (JSON.stringify(value) !== JSON.stringify(before.custom.find(t => t.id === id) ?? null))
          custom[id] = { value, actor, at: Math.max(now(), (custom[id]?.at ?? -1) + 1) };
      }
      let ticks = session.plan.ticks;
      for (const key of new Set([...Object.keys(before.done), ...Object.keys(after.done)]))
        if (!!before.done[key] !== !!after.done[key]) ticks = stampTick(ticks, key, !!after.done[key], actor, now());
      const plan = sharedPlan({ ...session.plan, custom, ticks });
      await save({ ...session, plan });
      return sharedProgress(plan);
    }),
    sync: () => serial(synchronize),
    stop: (preserve?: (plan: SharedPlan) => Promise<void>) => serial(async () => {
      const session = await requireSession();
      if (session.role !== 'owner') throw Error('Only the inviting phone can stop sharing.');
      if (preserve) await preserve(session.plan);
      await client.stop(session.link);
      await save(null);
    }),
    leave: () => serial(async () => {
      const session = await requireSession();
      if (session.role !== 'joined') throw Error('Stop sharing before leaving the inviting phone.');
      await save(null);
    }),
  };
}
