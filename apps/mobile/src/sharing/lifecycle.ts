/** A short interval also retries after connectivity returns, without an account,
 * analytics or a network-status permission. Never overlap requests. */
export function sharingLifecycle(sync: () => Promise<void>, interval: (run: () => void, ms: number) => () => void) {
  let running = false, stopped = false;
  const refresh = async () => {
    if (running || stopped) return;
    running = true;
    try { await sync(); } catch { /* runtime retains the error for the sharing screen */ }
    finally { running = false; }
  };
  const cancel = interval(() => { void refresh(); }, 20000);
  void refresh();
  return { foreground: refresh, stop() { stopped = true; cancel(); } };
}
