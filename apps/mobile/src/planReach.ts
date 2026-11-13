import type { DateStorage } from './weddingDate';

export const INSTALLATION_KEY = 'dw.metrics.installation.v1';
export const REACHED_KEY = 'dw.metrics.reached.v1';
export function metricsBuild(config: { flag?: string; preview?: string; development: boolean; platform: string }) {
  return config.flag === '1' && config.preview !== '1' && !config.development && config.platform !== 'web';
}

/** Best effort: offline or stalled measurement must never hold up the plan.
 * Keep the installation marker through plan deletion to avoid recounting it. */
export function planReach(storage: DateStorage, makeId: () => string, transport: typeof fetch, enabled: boolean, timeoutMs = 3000) {
  let pending: Promise<void> | undefined;
  function record(): Promise<void> {
    if (!enabled) return Promise.resolve();
    if (pending) return pending;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const job = (async () => {
      if (await storage.getItem(REACHED_KEY) === '1' || controller.signal.aborted) return;
      let id = await storage.getItem(INSTALLATION_KEY);
      if (controller.signal.aborted) return;
      if (!id || !/^[a-f0-9]{32}$/.test(id)) {
        id = makeId();
        if (!/^[a-f0-9]{32}$/.test(id)) throw Error('Invalid installation identifier');
        await storage.setItem(INSTALLATION_KEY, id);
      }
      if (controller.signal.aborted) return;
      const response = await transport('https://weddingchecklistpdf.com/api/app-plan-reach', {
        method: 'POST', headers: { 'x-dw-installation': id }, signal: controller.signal, redirect: 'error',
      });
      if (response.status !== 204) throw Error('Plan reach was not recorded');
      if (!controller.signal.aborted) await storage.setItem(REACHED_KEY, '1');
    })();
    pending = Promise.race([job, new Promise<void>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(Error('Plan reach timed out')); }, timeoutMs);
    })]).catch(() => { console.warn('Plan measurement unavailable; will retry.'); })
      .finally(() => { clearTimeout(timer); pending = undefined; });
    return pending;
  }
  return { record };
}
