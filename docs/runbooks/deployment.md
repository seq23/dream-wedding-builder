# Cloudflare Workers (OpenNext) Deployment

Default target: Cloudflare Workers through `@opennextjs/cloudflare`. `wrangler.jsonc` is the authoritative provider/runtime configuration.

Production build:

```bash
npm run build
```

OpenNext preview:

```bash
npm run preview
```

Deploy:

```bash
npm run deploy
```

## Workers Builds configuration (the part that is not in this repo)

Cloudflare Workers Builds is the check that actually publishes the site, and its
commands live in the Cloudflare dashboard, not in git. They are recorded here
because a change to any of them is invisible to code review, and one such change
has already broken a deploy.

**There is more than one trigger, and each carries its own pair of commands.**
Fixing one does not fix the other. Every trigger must be listed here:

| Trigger | Branches | Build command | Deploy command |
| --- | --- | --- | --- |
| Deploy production | `main` | `npm run build` | `npm run deploy` |
| Deploy non-production branches | `*` except `main` | `npm run build` | `npm run upload` |

`deploy` activates the new version; `upload` publishes a version without
activating it, which is what a pull-request branch should do. Both build the
worker first, which is the property that matters.

The deploy command **must** be a script that runs `opennextjs-cloudflare build`
before uploading. `wrangler.jsonc` points `main` at `.open-next/worker.js`, and
that file is produced only by `opennextjs-cloudflare build`. `npm run build` runs
`next build` alone and never produces it.

Incident, 2026-09-01: the deploy command was changed from `npm run deploy` to a
bare `npx wrangler versions upload` on **both** triggers. Restoring only the
production trigger left every pull request still failing, because the
non-production trigger keeps a separate copy of the same two fields. The build stage still passed, then the deploy
stage failed in four seconds with:

```
[ERROR] The entry-point file at ".open-next/worker.js" was not found.
```

Two further notes on that incident, both worth knowing before changing this again:

- It reproduces nowhere locally, because a developer machine already has a
  `.open-next/` directory from an earlier `npm run deploy` or `npm run preview`.
  `.open-next` is gitignored, so only a clean checkout exposes the gap.
- `wrangler versions upload` is not equivalent to `npm run deploy` even once the
  entry point exists. It uploads a version without activating it, so the live site
  would not change on merge. Switching to versioned uploads is a deliberate
  release-process decision and needs a promotion step; it is not a drop-in
  replacement. `npm run upload` is the version-upload equivalent that still builds
  the worker.

`scripts/validate-worker-entrypoint.mjs` enforces the half of this that lives in the
repo, and checks the table above against the scripts it names. (It is named for the
entry point rather than for deployment because `validate:profile-purity` forbids a
`validate:*` command from containing the word deploy - a validator must never be
able to trigger one.)

D1 migrations remain explicit provider operations; use the documented `npm run d1:migrate:remote` command only when a migration is intentionally being applied.

Validation command:

```bash
npm run validate:all
```

Authority generation, product generation, provider bootstrap, migrations, and deployment are execution steps. They stay visible in workflows and runbooks instead of being hidden inside validators.
