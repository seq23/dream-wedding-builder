import { isoDay, parseDay } from '@core/dated-plan';
import { type FullPlanList, datedFullPlan } from '@core/full-plan';
export interface Payment { id: string; payee: string; detail: string; cents: number; date: string; method: string; paidOn?: string }
export function amountCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter an amount with at most two decimal places.');
  const n = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(n) || n > 10000000000) throw new Error('Enter a smaller amount.');
  return n;
}
export function paymentRows(list: FullPlanList | null, date: string, own: Payment[], edits: Record<string, Payment>, unlocked: boolean): Payment[] {
  if (!unlocked || !list) return [];
  const tasks = datedFullPlan(list, date, date).flatMap(s => s.tasks).filter(t => t.kind === 'payment').map(t => ({ id: `task:${t.id}`, payee: t.owner, detail: t.text, cents: 0, date: t.date, method: '' }));
  return [...tasks.map(t => edits[t.id] ? { ...edits[t.id], detail: t.detail, date: t.date } : t), ...own].sort((a,b) => a.date.localeCompare(b.date));
}
export function paymentSummary(rows: Payment[]) {
  const total = rows.reduce((n,r) => n + r.cents, 0);
  const paid = rows.filter(r => r.paidOn).reduce((n,r) => n + r.cents, 0);
  return { total, paid, left: total - paid, count: rows.filter(r => !r.paidOn).length };
}
export function paymentGroup(row: Payment, today: string) {
  if (row.paidOn) return 'Paid';
  if (row.date < today) return 'Past due';
  const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate()+30);
  return row.date <= end.toISOString().slice(0,10) ? 'Due in the next 30 days' : 'Later';
}
export function validatePayment(row: Payment) {
  const date = parseDay(row.date);
  if (!row.payee.trim() || !date || !Number.isSafeInteger(row.cents) || row.cents < 0) throw new Error('Add a payee, valid date and amount.');
  return { ...row, date: isoDay(date) };
}
export interface PaymentState { own: Payment[]; edits: Record<string, Payment> }
export function paymentsStore(storage: { getItem(k: string): Promise<string|null>; setItem(k: string,v:string): Promise<void> }, key: string) {
  return {
    async read(): Promise<PaymentState> { const raw = await storage.getItem(key); return raw ? JSON.parse(raw) : { own: [], edits: {} }; },
    async save(state: PaymentState) { await storage.setItem(key, JSON.stringify(state)); }
  };
}
// Deliberately fictional, never a copy of the delivered paid list.
export const SAMPLE_PAYMENTS: FullPlanList = { windows: [{ id: 'sample', label: 'Sample' }], tasks: [
  { id: 'sample-a', window: 'sample', text: 'Example vendor deposit', owner: 'Sample vendor A', kind: 'payment', daysBefore: 30 },
  { id: 'sample-b', window: 'sample', text: 'Example vendor balance', owner: 'Sample vendor B', kind: 'payment', daysBefore: 7 }
] };
