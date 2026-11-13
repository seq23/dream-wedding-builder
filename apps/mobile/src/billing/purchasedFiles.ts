import type { ArchiveFiles, ArchiveRecord } from './archiveFiles';
import type { ArchiveId, DownloadedPlan } from './downloadStore';
import type { EventLedger } from './events';

export const FILE_MISSING_MESSAGE = 'Your purchased files are not on this phone yet. Restore your purchase to download them.';
const FILES = [
  { id: 'printables', grant: 'printables', label: 'Open my printables ›' },
  { id: 'day-of-kit', grant: 'day_of_kit', label: 'Open my day-of kit ›' },
] as const;
export interface PurchasedFile { id: ArchiveId; label: string; record: ArchiveRecord }

/** What More shows: a file needs both the verified grant in the ledger and the
 * saved download. A paid extra with no file on the phone points her to Restore. */
export function purchasedFiles(ledger: EventLedger, content: DownloadedPlan | null) {
  const ready: PurchasedFile[] = [];
  let missing = false;
  for (const file of FILES) {
    const record = content?.archives?.[file.id];
    if (ledger.extras.includes(file.grant) && record) ready.push({ id: file.id, label: file.label, record });
    else if (ledger.extras.includes(file.grant) || ledger.purchasedExtras?.includes(file.grant)) missing = true;
  }
  return { ready, missing };
}

async function shareSheet(uri: string) {
  const Sharing = await import('expo-sharing');
  if (!await Sharing.isAvailableAsync()) throw Error('Sharing is unavailable on this phone. Try again when sharing is available.');
  await Sharing.shareAsync(uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: 'Save or send my files' });
}
/** Hands the saved ZIP to the phone's share sheet (Files, AirDrop, email, print apps). */
export async function openPurchasedFile(files: ArchiveFiles, file: PurchasedFile, share: (uri: string) => Promise<void> = shareSheet) {
  const uri = await files.uri(file.record);
  if (!uri) throw Error(FILE_MISSING_MESSAGE);
  await share(uri);
}
