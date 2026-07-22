# Local Development Runbook

```bash
npm install
npm run dev
npm run validate:all
npm run test:e2e:headed
```

Use `NODE_OPTIONS="--max-old-space-size=3072"` for build validation on an 8 GB machine.

`npm run validate:all` is intentionally non-mutating. Use `npm run proof:local-full` when you explicitly want authority regeneration and production build proof.
