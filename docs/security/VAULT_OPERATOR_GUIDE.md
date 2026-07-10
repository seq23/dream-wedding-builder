# Encrypted vault operator guide

The vault is AES-256-GCM encrypted with a scrypt-derived key. The passphrase must come from a password manager and must never be stored in this repo. Real `.ops/vault.enc` files are local-only, ignored, and excluded from artifacts. `vault:check` decrypts in memory and prints variable names/count only, never values.
