import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveCalendar(text: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this phone. Please try again later.');
  const file = new File(Paths.cache, 'wedding-plan.ics');
  try {
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: 'Save my calendar file' });
  } finally {
    if (file.exists) file.delete();
  }
}
