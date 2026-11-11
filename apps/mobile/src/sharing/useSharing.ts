import { useEffect, useState } from 'react';
import { watchSharing } from './runtime';
export function useSharingRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => watchSharing(() => setRevision(value => value + 1)), []);
  return revision;
}
