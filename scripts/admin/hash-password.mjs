import crypto from 'node:crypto';
const password=process.argv[2]; if(!password){console.error('Usage: node scripts/admin/hash-password.mjs "strong password"');process.exit(1)}
const salt=crypto.randomBytes(16); const hash=crypto.scryptSync(password,salt,32);
console.log(`scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`);
