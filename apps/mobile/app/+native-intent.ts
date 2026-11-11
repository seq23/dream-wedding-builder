import { sharingRoute } from '../src/sharing/link';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return sharingRoute(path);
}
