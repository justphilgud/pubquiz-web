import {Client} from 'pg';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {writeFileSync} from 'node:fs';

// Deliberately local-only. This helper never accepts a hosted or existing real database.
async function main(){
const url=new URL(process.env.BINGO_EVENING_DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||!/^\/bingo_ap2_qa_\d+$/.test(url.pathname))throw Error('ISOLATED_LOCAL_BINGO_DATABASE_REQUIRED');
const db=new Client({connectionString:url.toString()});await db.connect();
try{
 const email='bingo.evening.admin@example.invalid',password=randomBytes(24).toString('base64url');
 const [account]=(await db.query("INSERT INTO pubquiz.users(id,name,email,password_hash,role,is_active,must_change_password,updated_at) VALUES((SELECT coalesce(max(id),0)+1 FROM pubquiz.users),'Bingo evening synthetic admin',$1,$2,'USER',true,false,NOW()) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id",[email,await bcrypt.hash(password,10)])).rows;
 await db.query("INSERT INTO pubquiz.benutzer_rollenzuweisungen(benutzer_id,rolle,scope_typ,eventreihe_id) SELECT $1,'ADMIN','GLOBAL',NULL WHERE NOT EXISTS(SELECT 1 FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=$1 AND rolle='ADMIN' AND scope_typ='GLOBAL')",[account.id]);
 writeFileSync('.env.bingo-evening-accounts.json',JSON.stringify({email,password}));
 writeFileSync('.env.development.local',`DATABASE_URL=${url.toString()}\nAUTH_SECRET=${randomBytes(32).toString('base64url')}\nAUTH_TRUST_HOST=true\nAUTH_URL=http://localhost:3068\nNEXT_PUBLIC_APP_ENV=development\nMEDIA_UPLOAD_ENV=development\nMEDIA_UPLOAD_STORE_ENV=preview\nTEMPLATE_MEDIA_UPLOAD_ENABLED=false\n`);
 console.info('Synthetic local browser account created. Credentials remain in ignored local files.');
}finally{await db.end();}
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
