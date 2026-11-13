import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPurchasedFile, purchasedFiles, FILE_MISSING_MESSAGE } from '../src/billing/purchasedFiles';
import type { ArchiveFiles, ArchiveRecord } from '../src/billing/archiveFiles';
import type { EventLedger } from '../src/billing/events';

const record = (id: 'printables' | 'day-of-kit'): ArchiveRecord => ({ id, byteLength: 22, sha256: (id === 'printables' ? 'a' : 'b').repeat(64) });
const content = (archives: object) => ({ list: { windows: [], tasks: [] }, packs: [], archives });
const ledger = (extras: EventLedger['extras'], purchasedExtras?: EventLedger['extras']): EventLedger => ({ firstEventId: null, events: [], extras, ...(purchasedExtras ? { purchasedExtras } : {}) });

test('a buyer can open each file she paid for; no grant or no file shows nothing to open and points to Restore', async () => {
  const both = { printables: record('printables'), 'day-of-kit': record('day-of-kit') };
  // Verified grant and saved file: both open.
  const owned = purchasedFiles(ledger(['printables', 'day_of_kit']), content(both));
  assert.deepEqual(owned.ready.map(f => f.id), ['printables', 'day-of-kit']);
  assert.equal(owned.missing, false);
  // A saved file with no verified grant is never offered.
  assert.deepEqual(purchasedFiles(ledger([]), content(both)), { ready: [], missing: false });
  // Paid but not delivered (failed download, or the plan was deleted from this phone): Restore.
  assert.deepEqual(purchasedFiles(ledger([], ['printables']), content({})), { ready: [], missing: true });
  assert.deepEqual(purchasedFiles(ledger(['day_of_kit']), null), { ready: [], missing: true });
  const partly = purchasedFiles(ledger(['day_of_kit'], ['printables', 'day_of_kit']), content({ 'day-of-kit': record('day-of-kit') }));
  assert.deepEqual(partly.ready.map(f => f.id), ['day-of-kit']);
  assert.equal(partly.missing, true);

  const shared: string[] = [];
  let present = true;
  const files: ArchiveFiles = {
    async write() { throw Error('unused'); }, async has() { return present; }, async clear() {},
    async uri(r) { return present ? `file:///archives/${r.id}-${r.sha256}.zip` : null; },
  };
  await openPurchasedFile(files, owned.ready[0], async uri => { shared.push(uri); });
  assert.deepEqual(shared, [`file:///archives/printables-${'a'.repeat(64)}.zip`]);
  present = false;
  await assert.rejects(openPurchasedFile(files, owned.ready[0], async uri => { shared.push(uri); }), { message: FILE_MISSING_MESSAGE });
  assert.equal(shared.length, 1);
});
