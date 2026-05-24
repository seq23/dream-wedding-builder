# Repo Validation Matrix

| Layer | Command | Severity | Proves | Does Not Prove |
|---|---|---:|---|---|
| TypeScript | npm run typecheck | HARD FAIL | typed app contracts compile | browser behavior |
| Unit | npm run test | HARD FAIL | pure product rules | visual behavior |
| Content | npm run validate:content | HARD FAIL | required routes/data/contracts exist | runtime provider success |
| Env | npm run validate:env | HARD FAIL for enabled provider shape | env contract is documented | secrets are valid |
| Disclaimers | npm run validate:disclaimers | HARD FAIL | required warnings exist | legal sufficiency |
| Anti-theater | npm run validate:no-theater | HARD FAIL | no fake-live/provider theater terms in source | provider accuracy |
| Build | npm run build | HARD FAIL | production build compiles | user journeys |
| E2E Gauntlet | npm run test:e2e:gauntlet | HARD FAIL when browser available | surface/transaction/outcome/common-sense journeys | deployed Cloudflare behavior |
| Headed E2E | npm run test:e2e:headed | Local proof | visible browser testing | CI display unless Xvfb configured |
