import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args=process.argv.slice(2);
const cmd=args[0];
const file=args[1] && !args[1].startsWith('-') && cmd!=='exec' ? args[1] : '.ops/vault.enc';
const pass=process.env.VAULT_PASSPHRASE;
if(!pass){console.error('VAULT_PASSPHRASE must be set in the current shell.');process.exit(2)}
const derive=salt=>crypto.scryptSync(pass,salt,32);
const decrypt=()=>{const p=JSON.parse(fs.readFileSync(file,'utf8'));const d=crypto.createDecipheriv('aes-256-gcm',derive(Buffer.from(p.salt,'base64')),Buffer.from(p.iv,'base64'));d.setAuthTag(Buffer.from(p.tag,'base64'));return Buffer.concat([d.update(Buffer.from(p.data,'base64')),d.final()]).toString('utf8')};
function parseEnv(text){
  const out={};
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith('#')) continue;
    const i=line.indexOf('='); if(i<1) continue;
    const key=line.slice(0,i).trim(); let value=line.slice(i+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    value=value.replace(/\\n/g,'\n'); out[key]=value;
  }
  return out;
}
if(cmd==='init'){
 if(fs.existsSync(file)){console.error('Vault exists; refusing overwrite.');process.exit(3)}
 fs.mkdirSync(path.dirname(file),{recursive:true});const plaintext=Buffer.from(fs.readFileSync('.ops/vault.example.env','utf8'));const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=derive(salt),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);const payload={v:1,kdf:'scrypt',cipher:'aes-256-gcm',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')};fs.writeFileSync(file,JSON.stringify(payload));fs.chmodSync(file,0o600);console.log(`Encrypted vault initialized: ${file}`)
}else if(cmd==='check'){
 const out=decrypt();const names=Object.keys(parseEnv(out));console.log(`Vault decrypted in memory; ${names.length} names validated. Values were not printed.`)
}else if(cmd==='exec'){
 const sep=args.indexOf('--'); const child=sep>=0?args.slice(sep+1):args.slice(1);
 if(!child.length){console.error('Usage: npm run vault:exec -- <command> [args...]');process.exit(1)}
 const env={...process.env,...parseEnv(decrypt())};
 const r=spawnSync(child[0],child.slice(1),{stdio:'inherit',env,shell:false});
 process.exit(r.status??1);
}else{console.error('Usage: node scripts/vault/vault.mjs init|check|exec');process.exit(1)}
