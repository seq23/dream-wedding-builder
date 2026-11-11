import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leaks, type Fingerprint } from './leaks';

export function repositoryLeaks(root: string, entries: Fingerprint[]) {
  if (!entries.length) throw Error('No private content fingerprints supplied');
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  if (!files.length) throw Error('No repository files checked');
  const found = files.filter(file => {
    const bytes = readFileSync(resolve(root, file));
    return !bytes.includes(0) && leaks(bytes.toString('utf8'), entries);
  });
  return { files, found };
}
