import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { sharePacket, type PacketInput, type Paper } from './packet';
export function preparePacketOutput() {
  return {
    cancel() {},
    async write(input: PacketInput, paper: Paper) {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this phone. Try again when sharing is available.');
      await sharePacket(input, paper, { print: Print.printToFileAsync, share: uri => Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Print or send my plan' }) });
    },
  };
}
