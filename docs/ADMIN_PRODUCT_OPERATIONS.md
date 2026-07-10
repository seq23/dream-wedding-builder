# Admin Product Operations

## Purpose
The `/admin` command center supports the product lifecycle without exposing credentials to the browser.

## Product states
- `DRAFT`: hidden and not purchasable.
- `ACTIVE`: visible and purchasable.
- `PAUSED`: sales disabled; historical access remains.
- `REVOKED`: removed from new sales; evidence and order history remain.
- `ARCHIVED`: hidden from merchandising; records remain.

## Storage modes
- Local development: `ADMIN_STORAGE_MODE=filesystem`; catalog and receipts are written directly to the working tree.
- Deployed runtime: `ADMIN_STORAGE_MODE=github`; mutations are committed through a selected-repo fine-grained GitHub token.

## Required secrets
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `ADMIN_STORAGE_MODE`
- `GITHUB_ADMIN_TOKEN` for deployed mutations
- `GITHUB_REPOSITORY`
- `GITHUB_DEFAULT_BRANCH`

Create the password hash locally:

`npm run admin:hash-password -- "your strong password"`

## Owner actions
Owner may create, edit, activate, pause, revoke, archive, and change prices. Revocation preserves historical evidence. Permanent deletion is limited to unused draft products.

## Provider boundary
Binary release uploads, private R2 delivery, Stripe object creation, and customer entitlement changes require provider bindings. The product catalog and lifecycle controls are implemented here; provider proof remains a separate phase.
