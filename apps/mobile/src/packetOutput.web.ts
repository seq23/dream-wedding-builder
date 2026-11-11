import { packetHtml, type PacketInput, type Paper } from './packet';
export function preparePacketOutput() {
  // Open during the button gesture, before storage reads, so popup blocking cannot
  // silently discard the packet. Expo Print on web prints the current app, ignoring HTML.
  const page = window.open('', '_blank');
  if (!page) throw new Error('Allow this page to open a print window, then try again.');
  page.opener = null;
  return {
    cancel() { page.close(); },
    async write(input: PacketInput, paper: Paper) {
      page.document.open();
      page.document.write(packetHtml(input, paper));
      page.document.close();
      page.focus();
      page.print();
    },
  };
}
