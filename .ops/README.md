# Encrypted vault

The real `.ops/vault.enc` is local-only and ignored. It must never enter Git or a baseline ZIP. Set `VAULT_PASSPHRASE` from a password manager/current shell, then run `npm run vault:init` or `npm run vault:check`. The passphrase is never stored in this repository.
