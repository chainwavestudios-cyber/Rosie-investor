/** Rosie AI corporate meeting reminders — independent of FronterMeeting and DAA emails.
 * Intended to run on a schedule; requires an opted-in, confirmed Rosie booking.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { formatInTz } from '../../shared/googleCalendarHelpers.ts';

export default async function(req:Request) {
  try {
    const client=createClientFromRequest(req);
    const service=client.asServiceRole;
    const bookings=await service.entities.RosieReceptionCall.filter({status:'booked',reminderConsent:true,reminderSent:false});
    const now=Date.now();
    let sent=0;
    for(const booking of bookings||[]){
      const when=Date.parse(booking.meetingStartISO||'');
      if(!Number.isFinite(when)||when<now||when-now>65*60000||when-now<0)continue;
      if(!booking.email||!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(booking.email))continue;
      try {
        await client.integrations.Core.SendEmail({
          to:booking.email,
          subject:'Rosie AI — Your meeting is coming up',
          body:`Hello ${booking.fullName?.split(' ')[0]||'there'},\n\nThis is your requested reminder that your Rosie AI meeting is scheduled for ${formatInTz(booking.meetingStartISO,'America/New_York')}.\n\nWe look forward to speaking with you.\n\nRosie AI\nhttps://rosieai.tech`
        });
        await service.entities.RosieReceptionCall.update(booking.id,{reminderSent:true,updatedAt:new Date().toISOString()});
        sent++;
      }catch(e:any){console.warn('[RosieReminder] Unable to send',e?.message);}
    }
    return Response.json({checked:bookings?.length||0,sent});
  } catch(e:any){return Response.json({error:e?.message||'Reminder error'},{status:500});}
}
