import {auth,pool} from './auth.mjs';
import {getMigrations} from 'better-auth/db/migration';
try{
 const {toBeCreated,toBeAdded,runMigrations}=await getMigrations(auth.options);
 console.log('[identity] migrating isolated staging database; new tables:',toBeCreated?.length||0,'fields:',toBeAdded?.length||0);
 await runMigrations();
 console.log('[identity] migrations complete');
}catch(e){
 console.error('[identity] migration failed:',e?.message||e);
 process.exitCode=1;
}finally{
 await pool.end();
}
