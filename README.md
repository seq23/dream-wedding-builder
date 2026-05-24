# Dream Wedding Builder

Free, no-login wedding planning web app that turns a dream wedding idea into a guided plan, pricing ranges, trend moments, inspiration-photo cost context, and a printable Dream Wedding Starter Pack.

## Primary experience
The main app experience is `/build`: a long guided bridal workbook with clear steps:

1. Vision
2. Budget
3. Priorities
4. Trends
5. Photo
6. Pricing
7. Packet

Supporting routes exist for deeper review: `/dashboard`, `/trends`, `/photos`, and `/pack`.

## Local commands

```bash
npm install
NODE_OPTIONS="--max-old-space-size=3072" npm run validate:all
npx playwright install chromium
npm run test:e2e:headed
```

## Truth posture
This is seeded and contract-ready v1. It does not claim live vendor/product search, real-time availability, guaranteed pricing, or permanent photo storage. Estimated costs are planning estimates only.
