# Cloudflare Pages Deployment

Default target: Cloudflare Pages.

Build command:

```bash
npm run build
```

Environment variables are optional in v1 unless Apps Script forwarding is enabled.

Validation command:

```bash
npm run validate:all
```

Authority generation, product generation, provider bootstrap, and deployment are execution steps. They should stay visible in workflows and runbooks instead of being hidden inside validators.
