import { sharingRoute } from '../src/sharing/link';
import { SHARING } from '../src/sharingSwitch';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  // Sharing off: an invite link opens the app normally, never the sharing screen.
  return SHARING ? sharingRoute(path) : path;
}
