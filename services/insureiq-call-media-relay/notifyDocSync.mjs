/**
 * Nonblocking Render startup observation for Rosie Core documentation.
 * A received event confirms only process startup on a commit, NOT audio acceptance.
 */
import {createHmac} from 'node:crypto';
export async function notifyCoreDocSync(){
  const key=String(process.env.INSURE_DOCSYNC_SIGNING_SECRET||'');
  const endpoint=String(process.env.INSURE_DOCSYNC_CORE_URL||'');
  const commit=String(process.env.RENDER_GIT_COMMIT||'').trim();
  const service=String(process.env.RENDER_SERVICE_ID||'').trim();
  if(key.length<32||endpoint!=='https://rosie-ai-core-46e10df3.base44.app/functions/coreDocSyncIntake'||!/^[0-9a-f]{7,64}$/i.test(commit)||service!=='srv-dbmjv5bbc2fs73a67fsg'){
    console.info('DocSync notification skipped: sender not fully configured');return;
  }
  const observation={
    action:'submit',app_key:'insureiq',source_type:'render_deploy',
    source_event_id:'render-'+service+'-'+commit,
    source_ref:'https://dashboard.render.com/web/'+service,
    event_type:'render_startup_observation',
    title:'InsureIQ · Call-media relay started at commit '+commit.slice(0,12),
    change_summary:'Render started the InsureIQ dedicated call-media Node process using Git commit '+commit+'. This is a startup observation only; it does not verify Twilio connections, Deepgram transcription, two-track media, session authorization, Live Q&A or any production readiness claim.',
    evidence:['Render service '+service,'Git commit '+commit,'Render branch '+String(process.env.RENDER_GIT_BRANCH||'')],
    target_doc_key:'insureiq-call-media-relay-20261106'
  };
  const body=JSON.stringify(observation);
  const ts=String(Math.floor(Date.now()/1000));
  const sig=createHmac('sha256',key).update(ts+'.'+body).digest('hex');
  try{
    const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-docsync-timestamp':ts,'x-docsync-signature':'sha256='+sig},body,signal:AbortSignal.timeout(10000)});
    const response=await res.json().catch(()=>({}));
    if(res.ok&&response.accepted)console.info('DocSync Render startup notification accepted');
    else console.warn('DocSync Render startup notification rejected',res.status,String(response?.error||'unknown').slice(0,125));
  }catch(e){console.warn('DocSync startup notification unavailable',e?.name||'network_error')}
}