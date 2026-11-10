import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state: { env: Record<string, unknown> } = { env: {} };
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => state.env }));

import { FREE_TASK_COUNT } from '@/components/FullPlanCard';
import { signupSource } from '@/components/BuilderEmailGate';
import { GET as getPlan } from '@/app/api/full-plan/[token]/route';
import { GET as getCounts } from '@/app/api/health/full-plan/route';
import { deliveryEmailBody } from '@/lib/delivery-email';
import { PLAN_WINDOWS, plainDate } from '@/lib/dated-plan';
import { createDownloadToken } from '@/lib/fulfillment';
import { FULL_PLAN_KEY, datedFullPlan, parseFullPlan, taskDate } from '@/lib/full-plan';
import { FULL_PLAN_TEASER } from '@/lib/full-plan-teaser';
import { productById } from '@/lib/products';

// A stand-in for the private list (the real one is not in this repository): the free
// tasks word for word, plus a payment and one task after the wedding.
const LIST = {
  windows: [...PLAN_WINDOWS.map(w => ({ id: w.id, label: w.label })), { id: 'after', label: 'After the wedding' }],
  tasks: [
    ...PLAN_WINDOWS.flatMap((w, wi) => w.tasks.map((text, i) => ({ id: `${w.id}-${i}`, window: w.id, text, daysBefore: Math.max(1, 400 - wi * 60 - i), owner: 'Both of you', kind: 'task' }))),
    { id: 'pay-1', window: '1-month', text: 'Pay the caterer balance', daysBefore: 14, owner: 'Whoever is paying', kind: 'payment' },
    { id: 'after-1', window: 'after', text: 'Send thank-you notes', daysBefore: -45, owner: 'Both of you', kind: 'task' }
  ]
};
const SECRET = 's3';
const bucket = (body: string | null) => ({ get: async (key: string) => (key === FULL_PLAN_KEY && body !== null ? { text: async () => body } : null) });
const db = (row: unknown) => ({ prepare: () => ({ bind: () => ({ first: async () => row }) }) });
const call = (token: string) => getPlan(new NextRequest('https://weddingchecklistpdf.com/api/full-plan/x'), { params: Promise.resolve({ token }) });
const token = () => createDownloadToken('e1', Date.now() + 60_000, SECRET);
const sku = (id: string) => productById(id)!.sku;

describe('the full plan a buyer gets', () => {
  it('a buyer with a wedding date gets EVERY task dated from it, payments and after-wedding tasks included', () => {
    const list = parseFullPlan(LIST)!;
    const dated = datedFullPlan(list, '2027-10-15', '2026-11-10').flatMap(s => s.tasks);
    expect(dated).toHaveLength(LIST.tasks.length);
    expect(dated.length).toBeGreaterThan(FREE_TASK_COUNT);
    for (const task of dated) expect(task.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dated.find(t => t.id === 'pay-1')!.date).toBe('2027-10-01');
    expect(dated.find(t => t.id === 'after-1')!.date).toBe('2027-11-29');
    // The free tasks are all in it, so nothing she ticked for free is missing from what she bought.
    for (const w of PLAN_WINDOWS) for (const text of w.tasks) expect(dated.some(t => t.window === w.id && t.text === text)).toBe(true);
    // A close date marks earlier tasks as already due rather than hiding them.
    expect(datedFullPlan(list, '2027-01-20', '2026-11-10').flatMap(s => s.tasks).some(t => t.overdue)).toBe(true);
    // No real date, no plan: never an undated list passed off as dated.
    expect(datedFullPlan(list, '', '2026-11-10')).toEqual([]);
    expect(datedFullPlan(list, '2027-02-30', '2026-11-10')).toEqual([]);
  });

  it('only a buyer with an active checklist or suite purchase is given the list', async () => {
    process.env.DOWNLOAD_SIGNING_SECRET = SECRET;
    state.env = { DB: db({ id: 'e1', sku: sku('checklist-pdf'), status: 'ACTIVE' }), PRODUCT_RELEASES: bucket(JSON.stringify(LIST)) };
    const ok = await call(token());
    expect(ok.status).toBe(200);
    expect((await ok.json()).tasks).toHaveLength(LIST.tasks.length);
    expect(ok.headers.get('cache-control')).toContain('no-store');

    expect((await call('not-a-token')).status).toBe(401);
    expect((await call(createDownloadToken('e1', Date.now() - 1, SECRET))).status).toBe(401);
    state.env = { ...state.env, DB: db({ id: 'e1', sku: sku('checklist-pdf'), status: 'REVOKED' }) };
    expect((await call(token())).status).toBe(403);
    state.env = { ...state.env, DB: db({ id: 'e1', sku: sku('budget-spreadsheet'), status: 'ACTIVE' }) };
    expect((await call(token())).status).toBe(403);
    state.env = { ...state.env, DB: db({ id: 'e1', sku: sku('operations-suite'), status: 'ACTIVE' }) };
    expect((await call(token())).status).toBe(200);
  });

  it('a missing or broken list is a named stop that still hands her the files, never an empty plan', async () => {
    process.env.DOWNLOAD_SIGNING_SECRET = SECRET;
    const logged: string[] = []; const spy = vi.spyOn(console, 'error').mockImplementation((line: string) => { logged.push(String(line)); });
    for (const body of [null, '{"windows":[],"tasks":[]}', 'not json']) {
      state.env = { DB: db({ id: 'e1', sku: sku('checklist-pdf'), status: 'ACTIVE' }), PRODUCT_RELEASES: bucket(body) };
      const t = token(); const res = await call(t); const data = await res.json();
      expect(res.status).toBe(503);
      expect(data).toMatchObject({ ok: false, stop: 'FULL_PLAN_LIST_MISSING', download_url: `/api/download/${t}` });
      expect(data.tasks).toBeUndefined();
      expect((await getCounts()).status).toBe(503);
    }
    spy.mockRestore();
    expect(logged.filter(line => line.includes('FULL_PLAN_LIST_MISSING')).length).toBeGreaterThanOrEqual(3);
  });

  it('every count shown comes from the list itself, and the public route gives counts only', async () => {
    state.env = { PRODUCT_RELEASES: bucket(JSON.stringify(LIST)) };
    const data = await (await getCounts()).json();
    expect(data.total).toBe(LIST.tasks.length);
    expect(data.payments).toBe(1);
    expect(data.byWindow['1-month']).toBe(LIST.tasks.filter(t => t.window === '1-month').length);
    expect(JSON.stringify(data)).not.toContain('Pay the caterer balance');
  });

  it('the order email gives a checklist buyer the dated-plan link, and other buyers only their download', () => {
    const url = 'https://weddingchecklistpdf.com/api/download/TOKEN';
    const body = deliveryEmailBody(productById('checklist-pdf')!.name, url);
    expect(body).toContain('https://weddingchecklistpdf.com/full-plan?t=TOKEN');
    expect(body).toContain(url);
    expect(deliveryEmailBody(productById('budget-spreadsheet')!.name, url)).not.toContain('/full-plan');
  });

  it('the locked tasks shown free are real extras with her dates, never free tasks relabelled', () => {
    const free = new Set(PLAN_WINDOWS.flatMap(w => w.tasks));
    const windows = PLAN_WINDOWS.filter(w => FULL_PLAN_TEASER[w.id]);
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(FULL_PLAN_TEASER[w.id]).toHaveLength(2);
      for (const task of FULL_PLAN_TEASER[w.id]) { expect(free.has(task.text)).toBe(false); expect(plainDate(taskDate('2027-10-15', task.daysBefore)!)).toMatch(/20\d\d/); }
    }
  });

  it('sells through the existing checkout products at the approved prices', () => {
    expect(productById('checklist-pdf')?.price).toBe(9);
    expect(productById('operations-suite')?.price).toBe(39);
    expect(FREE_TASK_COUNT).toBe(PLAN_WINDOWS.flatMap((w) => w.tasks).length);
  });
});

describe('tool-site planner button source', () => {
  it('tags a signup from a tool site and ignores anything else', () => {
    expect(signupSource('?from=weddingseatingchartmaker.com')).toBe('free-wedding-planner:weddingseatingchartmaker.com');
    expect(signupSource('?from=evil.example')).toBe('free-wedding-planner');
    expect(signupSource('')).toBe('free-wedding-planner');
  });
});
