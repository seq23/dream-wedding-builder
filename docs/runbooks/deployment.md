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

D1 migrations remain explicit provider operations; use the documented `npm run d1:migrate:remote` command only when a migration is intentionally being applied.

Validation command:

```bash
npm run validate:all
```

Authority generation, product generation, provider bootstrap, migrations, and deployment are execution steps. They stay visible in workflows and runbooks instead of being hidden inside validators.
