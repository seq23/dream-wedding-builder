import { sharingSwitchedOn } from '@/lib/sharing-status';
import { PartnerInvite } from './PartnerInvite';
import { SharingOff } from './SharingOff';

// The page an invite link opens. Partner sharing is switched off in production until the
// owner turns it on (docs/app-sharing-protocol.md), and while it is off this page says so
// instead of promising a shared plan the app cannot open (promise audit, 27 Nov 2026).
export const dynamic = 'force-dynamic';

export default async function TwoPhones() {
  return (await sharingSwitchedOn()) ? <PartnerInvite /> : <SharingOff />;
}
