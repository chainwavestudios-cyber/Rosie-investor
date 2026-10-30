/** Read-only preflight of Rosie AI toll-free routing; does not change Twilio settings. */
import { twilioFetch } from '../../shared/twilioHelpers.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
export default async function(req:Request) {
  try {
    const data=await twilioFetch('/IncomingPhoneNumbers.json?PageSize=100');
    const number=(data.incoming_phone_numbers||[]).find((n:any)=>n.phone_number==='+18662908994');
    const service=createClientFromRequest(req).asServiceRole;
    const c=(await service.entities.RosieReceptionConfig.filter({configName:'corporate'}))?.[0]||{};
    if(!number)return Response.json({found:false,configured:!!c.isActive,message:'Corporate 866 line not in this Twilio account'});
    let appVoiceUrl='';
    if(number.voice_application_sid){
      const app=await twilioFetch('/Applications/'+number.voice_application_sid+'.json').catch(()=>null);
      appVoiceUrl=app?.voice_url||'';
    }
    const effective=appVoiceUrl||number.voice_url||'';
    return Response.json({found:true,voiceCapable:!!number.capabilities?.voice,voiceUrl:effective,
      routedToFronter:/\/functions\/dialerVoiceHandler(?:[?\/#]|$)/i.test(effective),
      voiceApplicationBound:!!number.voice_application_sid,
      activeInApp:!!c.isActive,calendarConfigured:!!c.calendarId,
      message:'If routedToFronter is false, the Twilio number must point to the Fronter voice handler before the corporate call branch can run.'});
  }catch(e:any){return Response.json({error:e?.message||'Twilio check failed'},{status:500});}
}
