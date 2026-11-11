import { PLAN_WINDOWS, buildDatedPlan, isoDay, monthsBefore, parseDay, plainDate } from '@core/dated-plan';
import { datedFullPlan, taskDate, type FullPlanList } from '@core/full-plan';
import { taskKey, type PlanProgress } from '@core/plan-progress';
import { ownTaskKey } from './planTasks';
import { paymentRows, type PaymentState } from './payments';

export type Paper = 'Letter' | 'A4';
export const paperSize = { Letter: { width: 612, height: 792 }, A4: { width: 595.28, height: 841.89 } };
// This is the local record written by the wedding-week sheet (task 8b).
export interface PacketWeek { who: Record<string, string>; contacts: { id: string; name: string; phone: string; arrival: string; caller: string }[] }
export interface PacketInput {
  names: string; date: string; progress: PlanProgress; unlocked: boolean; list: FullPlanList | null;
  payments: PaymentState; week: PacketWeek;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
export function packetModel(input: PacketInput) {
  const { date, progress } = input;
  const paid = input.unlocked && !!input.list;
  // An early reference date keeps past windows and their original dates in the packet.
  const day = parseDay(date);
  const windows = buildDatedPlan(date, day ? isoDay(monthsBefore(day, 24)) : '1900-01-01').windows;
  const sections = paid ? datedFullPlan(input.list!, date, date).map(s => ({ ...s, tasks: s.tasks.map(t => ({
    text: t.text, date: t.date, owner: t.owner, key: taskKey(t.window, t.text), done: !!progress.done[taskKey(t.window, t.text)], week: t.daysBefore >= 0 && t.daysBefore <= 7,
  })) })) : PLAN_WINDOWS.map(w => ({ id: w.id, label: w.label, tasks: w.tasks.map(text => ({
    text, date: windows.find(d => d.id === w.id)?.endsOn ?? '', owner: '', key: taskKey(w.id, text), done: !!progress.done[taskKey(w.id, text)], week: false,
  })) }));
  for (const own of progress.custom) {
    let section = sections.find(s => s.id === own.windowId);
    if (!section) { const w = PLAN_WINDOWS.find(w => w.id === own.windowId); if (!w) continue; section = { id: w.id, label: w.label, tasks: [] }; sections.push(section); }
    section.tasks.push({ text: own.text, date: windows.find(w => w.id === own.windowId)?.endsOn ?? '', owner: '', key: ownTaskKey(own.id), done: !!progress.done[ownTaskKey(own.id)], week: false });
  }
  const tasks = sections.flatMap(s => s.tasks);
  const payments = paymentRows(paid ? input.list : null, date, input.payments.own, input.payments.edits, paid);
  return { paid, sections, total: tasks.length, payments, week: tasks.filter(t => t.week).sort((a,b) => a.date.localeCompare(b.date)), contacts: paid ? input.week.contacts : [] };
}
export function packetHtml(input: PacketInput, paper: Paper) {
  const model = packetModel(input);
  const task = (t: ReturnType<typeof packetModel>['week'][number]) => `<li><span class="box">${t.done ? 'X' : '&nbsp;'}</span><div>${escape(t.text)}<p>${escape(t.date ? plainDate(t.date) : 'Date not set')} · Owner: ${escape(t.owner || '________')} · Who: ${escape(model.paid ? input.week.who[t.key] || '________' : '________')}</p></div></li>`;
  const payments = model.payments.map(p => `<tr><td>${escape(p.payee)}<br>${escape(p.detail)}</td><td>${escape(plainDate(p.date))}</td><td>${money(p.cents)}</td><td>${escape(p.method || '________')}</td><td>${escape(p.paidOn ? plainDate(p.paidOn) : 'Not paid')}</td></tr>`).join('');
  const weekDays = [...new Set(model.week.map(t => t.date))].map(date => `<h3>${escape(plainDate(date))}</h3><ul>${model.week.filter(t => t.date === date).map(task).join('')}</ul>`).join('');
  const start = taskDate(input.date, 7);
  const envelopes = model.payments.filter(p => start && p.date >= start && p.date <= input.date).map(p => `<li><div>${escape(p.payee)} · ${money(p.cents)} · ${escape(plainDate(p.date))}<p>${escape(p.method || 'Payment method not set')} · ${escape(p.paidOn ? 'Paid' : 'Not paid')}</p></div></li>`).join('');
  const contacts = model.contacts.map(c => `<tr><td>${escape(c.name)}</td><td>${escape(c.phone)}</td><td>${escape(c.arrival)}</td><td>${escape(c.caller)}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Wedding plan</title><style>
    @page { size: ${paper}; margin: 36pt; } * { box-sizing: border-box; } body { color: #000; background: #fff; font: 11pt Arial, sans-serif; margin: 0; line-height: 1.4; }
    h1 { font: 26pt Georgia, serif; margin: 0 0 8pt; } h2 { font: 18pt Georgia, serif; margin: 20pt 0 10pt; break-after: avoid; }
    p { margin: 4pt 0; } .meta { font-size: 9pt; } ul { padding: 0; list-style: none; } li { display: flex; gap: 10pt; border-bottom: 1px solid #aaa; padding: 9pt 0; break-inside: avoid; } li p { font-size: 9pt; }
    .box { border: 1px solid #000; width: 12pt; height: 12pt; flex: 0 0 12pt; font-size: 9pt; text-align: center; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 9pt; } th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #aaa; padding: 6pt 4pt; overflow-wrap: anywhere; } tr { break-inside: avoid; } thead { display: table-header-group; } .page { break-before: page; } li div { min-width: 0; overflow-wrap: anywhere; } footer { margin-top: 20pt; font-size: 8pt; }
    </style></head><body><h1>${escape(input.names.trim() || 'Our wedding plan')}</h1><p>${escape(input.date ? plainDate(input.date) : 'Wedding date not set')}</p><p class="meta">${model.total} tasks · ${model.paid ? 'Full plan' : 'Basic plan'}</p>
    ${model.sections.filter(s => s.tasks.length).map(s => `<section><h2>${escape(s.label)}</h2><ul>${s.tasks.map(task).join('')}</ul></section>`).join('')}
    ${model.paid ? `<section class="page"><h2>Payments schedule</h2>${payments ? `<table><thead><tr><th>Who / what</th><th>Due</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>${payments}</tbody></table>` : '<p>No payments saved.</p>'}<h2>Wedding week</h2>${weekDays || '<p>No wedding-week tasks.</p>'}<h2>Envelopes</h2><ul>${envelopes}</ul><h2>Who to call</h2>${contacts ? `<table><thead><tr><th>Name</th><th>Phone</th><th>Arrival</th><th>Who calls if late</th></tr></thead><tbody>${contacts}</tbody></table>` : '<p>No contacts saved.</p>'}</section>` : ''}
    <footer>Dream Wedding · weddingchecklistpdf.com</footer></body></html>`;
}

export async function sharePacket(input: PacketInput, paper: Paper, io: {
  print(options: { html: string; width: number; height: number }): Promise<{ uri: string }>;
  share(uri: string): Promise<void>;
}) {
  const result = await io.print({ html: packetHtml(input, paper), ...paperSize[paper] });
  if (!result.uri) throw new Error('Could not create the PDF. Try again.');
  await io.share(result.uri);
  return result.uri;
}
