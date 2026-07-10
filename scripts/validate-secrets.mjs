import fs from 'node:fs';
import { execSync } from 'node:child_process';

const tracked = (() => {
  try {
    return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
})();

for (const bad of ['.ops/vault.enc', '.env', '.dev.vars']) {
  if (tracked.includes(bad)) throw new Error(`Secret material tracked: ${bad}`);
}

const files = ['.env.example', '.dev.vars.example', '.ops/vault.example.env'];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (/sk_(live|test)_[A-Za-z0-9]{12,}/.test(source) || /re_[A-Za-z0-9]{12,}/.test(source)) {
    throw new Error(`Real-looking secret in ${file}`);
  }
}
console.log('secret boundaries: PASS');
