// Plain Node: EAS runs this before installing dependencies.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function stops(config, env, scorecard) {
  const out = [];
  if (env.EXPO_PUBLIC_DW_PREVIEW) out.push('PREVIEW_BUILD');
  if (!config.bundleId || config.bundleId.endsWith('.placeholder')) out.push('BUNDLE_ID_PLACEHOLDER');
  for (const key of ['privacyUrl', 'termsUrl']) {
    try {
      const url = new URL(config[key]);
      if (url.protocol !== 'https:' || url.hostname !== 'weddingchecklistpdf.com' || url.pathname !== (key === 'privacyUrl' ? '/privacy' : '/terms')) throw Error();
    } catch { out.push('LEGAL_LINKS_MISSING'); break; }
  }
  if (!scorecard?.bossOsRowId || !scorecard?.recordedAt) out.push('SCORECARD_NOT_REGISTERED');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const production = process.env.EAS_BUILD_PROFILE === 'production' || process.env.EAS_BUILD_DISTRIBUTION === 'store';
  if (process.argv.includes('--if-production') && !production) {
    console.log('Release gate: internal/local build; store gate deferred.');
  } else {
    const config = JSON.parse(readFileSync(new URL('../release/config.json', import.meta.url)));
    const scorecard = JSON.parse(readFileSync(new URL('../release/scorecard.json', import.meta.url)));
    const found = stops(config, process.env, scorecard);
    for (const code of found) console.error(`NAMED STOP [${code}] See release/README.md.`);
    if (found.length) process.exitCode = 2;
    else console.log('Release gate: store configuration passes.');
  }
}
