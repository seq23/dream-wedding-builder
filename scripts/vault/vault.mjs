import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
const [cmd,file='.ops/vault.enc']=process.argv.slice(2); const pass=process.env.VAULT_PASSPHRASE;
if(!pass){console.error('VAULT_PASSPHRASE must be supplied from a password manager/current shell.');process.exit(2)}
const derive=salt=>crypto.scryptSync(pass,salt,32);
const decrypt=()=>{const p=JSON.parse(fs.readFileSync(file,'utf8'));const d=crypto.createDecipheriv('aes-256-gcm',derive(Buffer.from(p.salt,'base64')),Buffer.from(p.iv,'base64'));d.setAuthTag(Buffer.from(p.tag,'base64'));return Buffer.concat([d.update(Buffer.from(p.data,'base64')),d.final()]).toString('utf8')};
if(cmd==='init'){
 if(fs.existsSync(file)){console.error('Vault exists; refusing overwrite.');process.exit(3)}
 fs.mkdirSync(path.dirname(file),{recursive:true});const plaintext=Buffer.from(fs.readFileSync('.ops/vault.example.env','utf8'));const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=derive(salt),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);const payload={v:1,kdf:'scrypt',cipher:'aes-256-gcm',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')};fs.writeFileSync(file,JSON.stringify(payload));fs.chmodSync(file,0o600);console.log(`Encrypted vault initialized: ${file}`)
}else if(cmd==='check'){
 const out=decrypt();const names=out.split(/\r?\n/).filter(x=>x&&!x.startsWith('#')).map(x=>x.split('=')[0]);console.log(`Vault decrypted in memory; ${names.length} names validated. Values were not printed.`)
}else{console.error('Usage: node scripts/vault/vault.mjs init|check [.ops/vault.enc]');process.exit(1)}
