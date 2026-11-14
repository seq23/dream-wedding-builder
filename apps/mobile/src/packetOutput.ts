import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { sharePacket, type PacketInput, type Paper } from './packet';
export function preparePacketOutput() {
  return {
    cancel() {},
    async write(input: PacketInput, paper: Paper) {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this phone. Try again when sharing is available.');
      await sharePacket(input, paper, { print: Print.printToFileAsync, share: uri => Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Print or send my plan' }),
        // expo-print names the file with a random id; the share sheet shows "Wedding plan – …" instead.
        rename: (uri, name) => { const named = new File(Paths.cache, name); if (named.exists) named.delete(); new File(uri).moveSync(named); return named.uri; } });
    },
  };
}
