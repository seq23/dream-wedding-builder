import crypto from 'node:crypto';
for(const name of ['APP_SESSION_SECRET','DOWNLOAD_SIGNING_SECRET','ENTITLEMENT_HASH_SECRET','ADMIN_SESSION_SECRET','ADMIN_ACTION_SIGNING_SECRET','CRON_AUTH_SECRET']) console.log(`${name}=${crypto.randomBytes(32).toString('base64url')}`);
