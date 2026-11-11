import { spawnSync } from 'node:child_process';
import { writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function publish({ project, branch, directory = 'dist', env = process.env, run = spawnSync }) {
  const stop = () => { throw new Error('NAMED STOP [PREVIEW_HOST_FAILED]'); };
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID || !branch || !existsSync(resolve(directory, 'index.html'))) stop();
  writeFileSync(resolve(directory, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n');
  writeFileSync(resolve(directory, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const invoke = (args) => run('npx', ['--yes', 'wrangler@4.110.0', 'pages', ...args], { env: { ...env, NO_COLOR: '1' }, encoding: 'utf8', timeout: 120000 });
  const list = invoke(['project', 'list', '--json']);
  if (list.status !== 0) stop();
  let projects;
  try { projects = JSON.parse(list.stdout); } catch { stop(); }
  if (!Array.isArray(projects)) stop();
  if (!projects.some(p => p.name === project || p['Project Name'] === project)) {
    if (invoke(['project', 'create', project, '--production-branch', 'main']).status !== 0) stop();
  }
  const deployed = invoke(['deploy', directory, '--project-name', project, '--branch', branch]);
  if (deployed.status !== 0) stop();
  const urls = (deployed.stdout ?? '').match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev\b/g) ?? [];
  const url = urls.find(value => new URL(value).hostname.endsWith('.' + project + '.pages.dev'));
  if (!url) stop();
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `url=${url}\n`);
  if (env.GITHUB_STEP_SUMMARY) writeFileSync(env.GITHUB_STEP_SUMMARY, `[Open the phone app preview](${url})\n\nFree web preview. No Appetize minutes.\n`);
  return url;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try { console.log(publish({ project: process.argv[2], branch: process.env.PREVIEW_BRANCH })); }
  catch { console.error('NAMED STOP [PREVIEW_HOST_FAILED]'); process.exitCode = 1; }
}
