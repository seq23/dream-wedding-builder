# Why the deploy passes `--dangerouslyUseUnsupportedNextVersion`

**Found 2026-10-25, while landing the Search Readiness repairs. Production had not
deployed since 2026-10-20.**

## What happened

`@opennextjs/cloudflare` refuses to build an app on a Next.js major that is more than
two years past its release:

```
ERROR Next.js version 15.5.18 is not supported by the Next.js team.
Major versions are supported for 2 years from their release date.
```

Next.js 15.0 was released on **21 October 2024**. This repository pins Next 15.5.18.
On **21 October 2026** that check began to fail, and the Cloudflare Workers Builds
production deploy - which runs `npm run deploy` - has failed on every `main` commit
since. The last green deploy was `aee43ba1` on 20 October.

Nothing in the repository changed to cause it and nothing in the repository could
detect it: the CI gate builds with `next build`, which is unaffected, and no check
read the deploy's own result. Five days of content, search-intelligence and SEO
commits were merged green and never reached a reader.

## Why the flag, and not an upgrade, today

The flag restores the state production was already in on 20 October: the same Next
15.5.18 bundle, deployed again. An upgrade to a supported Next major is a different
piece of work - a major-version migration against a Level 3 interactive app with a
Playwright gauntlet - and holding every deploy hostage to it would have kept the site
stale for however long that takes.

Proved locally before it was applied: `npx opennextjs-cloudflare build` fails with
the error above, and the same command with `--dangerouslyUseUnsupportedNextVersion`
completes ("OpenNext build complete", worker saved).

## What this costs, and the follow-up

The risk the flag accepts is real: an unsupported Next major stops receiving security
patches, so a vulnerability in 15.5.x will not be fixed upstream. That is the reason
to upgrade, and it is now the only reason this flag exists.

**Follow-up, owed:** upgrade to a Next major inside its support window and remove the
flag from the `deploy`, `preview` and `upload` scripts in `package.json`. Until then
the flag is load-bearing and removing it stops production deploying.

## How this class of failure gets caught next time

`.github/workflows/post-deploy-live-check.yml` (added in the same change) waits for
the Workers Builds check on each pushed commit and fails the lane when that check is
not green, then asserts what the live hosts actually serve. A deploy that stops
happening is now a red lane in this repository rather than a silence only the
Cloudflare dashboard knows about.
