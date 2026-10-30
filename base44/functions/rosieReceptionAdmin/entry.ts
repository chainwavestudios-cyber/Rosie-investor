/** Superadmin control surface for corporate Rosie reception; never reads DebtCallCoach data. */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
const PHONE='+18662908994';
export default async function(req:Request) {
  try {
    if(req.method!=='POST')return Response.json({error:'POST only'},{status:405});
    const client=createClientFromRequest(req);
    const body=await req.json().catch(()=>({}));
    let actor:any=null;
    if(body.sessionUserId&&body.sessionToken){
      try {
        const result:any=await client.functions.invoke('debtCoachAuth',{action:'me',sessionUserId:body.sessionUserId,sessionToken:body.sessionToken});
        actor=result?.data?.user||null;
      }catch{}
    }
    if(actor?.role!=='super_admin'){
      const user=await client.auth.me().catch(()=>null);
      if(user?.role==='admin')actor=user;
      else return Response.json({error:'Superadmin access required'},{status:403});
    }
    const service=client.asServiceRole;
    const saved=await service.entities.RosieReceptionConfig.filter({configName:'corporate'});
    let config=saved?.[0]||null;
    const settings={configName:'corporate',isActive:false,phoneNumber:PHONE,notificationEmail:'PR@Rosieai.tech',calendarId:'',calendarTimezone:'America/New_York',meetingDurationMinutes:30};
    if(body.action==='save'){
      const data=body.config||{};
      const notificationEmail=String(data.notificationEmail||settings.notificationEmail).trim();
      if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(notificationEmail))return Response.json({error:'Enter a valid notification email'},{status:400});
      const calendarId=String(data.calendarId||'').trim().slice(0,240);
      const update={
        configName:'corporate',phoneNumber:PHONE,notificationEmail,
        calendarId,calendarTimezone:'America/New_York',
        meetingDurationMinutes:Math.min(60,Math.max(15,Number(data.meetingDurationMinutes)||30)),
        isActive:!!data.isActive,updatedBy:actor.username||actor.full_name||'admin'
      };
      if(config)config=await service.entities.RosieReceptionConfig.update(config.id,update);
      else config=await service.entities.RosieReceptionConfig.create(update);
    }else if(body.action!=='status')return Response.json({error:'Unknown action'},{status:400});
    const records=await service.entities.RosieReceptionCall.list('-created_date',100).catch(()=>[]);
    return Response.json({config:{...settings,...config},records,number:PHONE,
      calendarConfigured:!!config?.calendarId,
      note:'Rosie AI line is isolated from Debt Call Coach and Fronter debt campaigns. Calendar booking requires an authorized Rosie corporate Google calendar ID.'});
  }catch(e:any){console.error('[RosieReceptionAdmin]',e?.message);return Response.json({error:e?.message||'Failed'},{status:500});}
}
