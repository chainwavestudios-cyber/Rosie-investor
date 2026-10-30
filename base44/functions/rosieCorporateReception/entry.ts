/**
 * Rosie AI corporate receptionist — isolated from Fronter debt scripts, DAA and Debt Call Coach.
 * Twilio <Gather> speech conversation, service-role storage in RosieReceptionCall, and
 * optional confirmed booking on an explicitly configured Rosie corporate calendar.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { verifyTwilioSignature } from '../../shared/verifyTwilioSignature.ts';
import { xmlEscape, toE164 } from '../../shared/twilioHelpers.ts';
import { getCalendarAuth, hasConflict, formatInTz } from '../../shared/googleCalendarHelpers.ts';

const BASE = 'https://rosieai-investorpage.base44.app';
const TZ = 'America/New_York';
const H = { 'Content-Type': 'text/xml; charset=utf-8' };
const MAX_LEN = 1000;
const reply = (xml: string) => new Response('<?xml version="1.0" encoding="UTF-8"?>\n<Response>'+xml+'</Response>',{headers:H});
const clean = (s: unknown, max=MAX_LEN) => String(s||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const yes = (s:string) => /\b(yes|yeah|yep|sure|correct|that's right|please|absolutely|i do|of course)\b/i.test(s);
const no = (s:string) => /\b(no|nah|nope|incorrect|not right|don't|do not)\b/i.test(s);
const msg = (text: string) => '<Say voice="Polly.Joanna-Neural">'+xmlEscape(text)+'</Say>';
function ask(text:string, retry=false) {
  const action = BASE+'/functions/rosieCorporateReception';
  return reply('<Gather input="speech" method="POST" action="'+xmlEscape(action)+'" timeout="9" speechTimeout="auto" actionOnEmptyResult="true" language="en-US">'+msg(text)+'</Gather>'+(retry?msg("I'm still here when you're ready."):''));
}
function greet() {
  const hour = Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:TZ}).format(new Date()));
  return hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
}
function department(s:string) {
  if (/\b(steph|stephani|scheidt|managing partner)\b/i.test(s)) return 'Stephani Scheidt / Managing Partner';
  if (/\b(pr|press|public relations|journalist|media|interview)\b/i.test(s)) return 'PR / Media';
  if (/\b(develop|engineering|technical|developer|product|coding)\b/i.test(s)) return 'Development';
  if (/\b(senior|management|executive|leadership|ceo)\b/i.test(s)) return 'Senior Management';
  return 'General / Other';
}
function preferredIntent(s:string) {
  if (/\b(meeting|appointment|schedule|book|calendar|demo|consultation|time to talk)\b/i.test(s)) return 'meeting';
  if (/\b(message|voicemail|leave a note|call me back|callback|follow.up|speak with|transfer|connect me|department)\b/i.test(s)) return 'message';
  return '';
}
async function normalizeEmail(value:string, client:any) {
  const raw = clean(value,200).toLowerCase();
  const simple = raw.replace(/\s+(at sign|at)\s+/g,'@').replace(/\s+(dot|period)\s+/g,'.').replace(/\s+/g,'').replace(/,/g,'.');
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(simple)) return simple;
  try {
    const answer = await client.integrations.Core.InvokeLLM({
      prompt:'Normalize this spoken email address as an email address. If unambiguous, output only email. Otherwise output INVALID. No other text. Speech: '+raw,
    });
    const candidate = clean(typeof answer==='string'?answer:answer?.text||'',200).replace(/\s/g,'').toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(candidate)?candidate:'';
  } catch { return ''; }
}
function firstName(full:string) { return full.split(' ')[0] || 'there'; }
function normalizePhone(value:string, original:string) {
  if (/\b(same|this number|number i'm calling|caller id|this phone)\b/i.test(value)) return original;
  const digits=value.replace(/\D/g,'');
  return digits.length===10?'+1'+digits:digits.length===11&&digits[0]==='1'?'+'+digits:/^\+[1-9]\d{7,14}$/.test(value.trim())?value.trim():'';
}
async function parseTime(speech:string, client:any) {
  const answer:any=await client.integrations.Core.InvokeLLM({
    prompt:`Extract a future date/time from a telephone meeting request. Current UTC: ${new Date().toISOString()}, Rosie AI time zone: America/New_York. Caller said: "${clean(speech,300)}". Return success boolean and startISO in UTC, accurate for DST. Do not invent a time if missing. If relative time ambiguous return success=false. Meeting must occur in the future, Monday–Friday, 9am–6pm Eastern.`,
    response_json_schema:{type:'object',properties:{success:{type:'boolean'},startISO:{type:'string'}}}
  });
  if (!answer?.success) return '';
  const d=new Date(answer.startISO);
  if(!Number.isFinite(d.getTime())||d.getTime()<Date.now()+5*60000||d.getTime()>Date.now()+90*86400000)return '';
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour:'numeric',hourCycle:'h23',weekday:'short'}).formatToParts(d);
  const hour=Number(parts.find(p=>p.type==='hour')?.value||0),day=parts.find(p=>p.type==='weekday')?.value||'';
  return hour>=9&&hour<18&&!['Sat','Sun'].includes(day)?d.toISOString():'';
}
async function availability(client:any, config:any, iso:string) {
  const calendarId=clean(config.calendarId,250);
  if(!calendarId)return {bookable:false,reason:'corporate calendar not configured'};
  try {
    const auth=await getCalendarAuth(client);
    const start=new Date(iso),end=new Date(start.getTime()+(Number(config.meetingDurationMinutes)||30)*60000);
    const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events?singleEvents=true&timeMin='+encodeURIComponent(start.toISOString())+'&timeMax='+encodeURIComponent(end.toISOString())+'&maxResults=100';
    const res=await fetch(url,{headers:auth,signal:AbortSignal.timeout(7000)});
    if(!res.ok)return {bookable:false,reason:'calendar unavailable'};
    const data=await res.json();
    return {bookable:!hasConflict(data.items||[],start,end),reason:'conflict'};
  } catch { return {bookable:false,reason:'calendar unavailable'}; }
}
async function book(client:any,config:any,record:any) {
  const available=await availability(client,config,record.meetingStartISO);
  if(!available.bookable)return {ok:false,reason:available.reason};
  const start=new Date(record.meetingStartISO),end=new Date(start.getTime()+(Number(config.meetingDurationMinutes)||30)*60000);
  const auth=await getCalendarAuth(client);
  const payload={
    summary:'Rosie AI inquiry — '+clean(record.fullName,100),
    description:`Corporate Rosie AI receptionist booking\nCaller: ${record.fullName}\nPhone: ${record.callerPhone}\nEmail: ${record.email}\nDepartment: ${record.department}\nReason: ${record.message||'General meeting'}\nCall SID: ${record.callSid}`,
    start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()},
  };
  const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(clean(config.calendarId,250))+'/events?sendUpdates=none';
  const res=await fetch(url,{method:'POST',headers:auth,body:JSON.stringify(payload),signal:AbortSignal.timeout(9000)});
  if(!res.ok)return {ok:false,reason:'calendar create failed'};
  const data=await res.json();
  return {ok:true,eventId:data.id,endISO:end.toISOString()};
}
async function notify(client:any,to:string,subject:string,body:string) {
  if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to))return false;
  try { await client.integrations.Core.SendEmail({to,subject,body});return true; }catch(e){console.warn('[RosieReception] Email failed',e?.message);return false;}
}
async function finish(client:any,service:any,config:any,call:any,updates:any) {
  const final={...updates,step:'done',updatedAt:new Date().toISOString()};
  await service.entities.RosieReceptionCall.update(call.id,final);
  const record={...call,...final};
  const where=record.department||'General';
  const when=record.meetingStartISO?formatInTz(record.meetingStartISO,TZ):record.preferredTime||'not provided';
  await notify(client,config.notificationEmail||'PR@Rosieai.tech',
    'Rosie AI corporate call — '+(record.status==='booked'?'Booked meeting':'New message')+' — '+record.fullName,
    `Rosie AI receptionist call\nName: ${record.fullName}\nPhone: ${record.callerPhone}\nEmail: ${record.email}\nDepartment: ${where}\nRequest: ${record.message||'—'}\nStatus: ${record.status}\nMeeting time/request: ${when}\nEmail reminder consent: ${record.reminderConsent?'yes':'no'}\nCall ID: ${record.callSid}`);
  if(record.reminderConsent&&record.email){
    await notify(client,record.email,
      record.status==='booked'?'Rosie AI — Your meeting is confirmed':'Rosie AI — We received your request',
      `Hello ${firstName(record.fullName)},\n\n${record.status==='booked'?`Your Rosie AI meeting is confirmed for ${when}.`:'Thank you for speaking with Rosie. We received your meeting/message request. A member of our team will follow up to confirm the details.'}\n\nDepartment: ${where}\n\nRosie AI\nhttps://rosieai.tech`);
  }
  return reply(msg(record.status==='booked'
    ?'Wonderful. Your appointment is confirmed. Thank you for calling Rosie AI. Have a beautiful day!'
    :'Perfect. I have passed your details along to our team. Someone will follow up with you. Thank you for calling Rosie AI, and have a beautiful day!')+'<Hangup/>');
}
export default async function(req:Request) {
  const body=await req.text();
  if(!await verifyTwilioSignature(req,body))return new Response('Unauthorized',{status:401});
  try {
    const form=new URLSearchParams(body);
    const callSid=clean(form.get('CallSid'),70);
    if(!/^CA[a-f0-9]{32}$/i.test(callSid))return reply(msg("I'm sorry, we couldn't identify this call. Please try again.")+'<Hangup/>');
    const client=createClientFromRequest(req),service=client.asServiceRole;
    const configs=await service.entities.RosieReceptionConfig.filter({configName:'corporate'});
    const config=configs?.[0]||{};
    if(!config.isActive)return reply(msg('Our reception team is not available right now. Please call back shortly.')+'<Hangup/>');
    const existing=await service.entities.RosieReceptionCall.filter({callSid});
    let call=existing?.[0];
    const from=toE164(clean(form.get('From'),24));
    if(!call) {
      call=await service.entities.RosieReceptionCall.create({callSid,callerPhone:from,fullName:'',email:'',department:'General / Other',intent:'',message:'',step:'name',status:'in_progress',reminderConsent:false,reminderSent:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      return ask(greet()+". It's a beautiful day here at Rosie AI headquarters! I'm Rosie, the official Rosie AI virtual receptionist. May I ask whom I'm speaking with?");
    }
    if(call.step==='done')return reply(msg('Thank you for calling Rosie AI. Goodbye!')+'<Hangup/>');
    const speech=clean(form.get('SpeechResult')||'',400);
    if(!speech)return ask("I'm sorry, I didn't quite catch that. Could you say that again?");
    const save=async(fields:any)=>{await service.entities.RosieReceptionCall.update(call.id,{...fields,updatedAt:new Date().toISOString()});call={...call,...fields};};
    switch(call.step) {
      case 'name': {
        const fullName=speech.replace(/^(hi|hello|hey|this is|my name is|it's|it is|i'm|i am)\s+/i,'').replace(/[.!?]/g,'').trim();
        if(fullName.length<3)return ask('May I have your first and last name, please?');
        await save({fullName,step:'department'});
        return ask('Lovely to meet you, '+firstName(fullName)+'. Would you like our senior management team, public relations, development department, or Steph, our Managing Partner? I can also arrange a meeting or take a message.');
      }
      case 'department': {
        const dep=department(speech),intent=preferredIntent(speech);
        await save({department:dep,intent,step:intent?'phone':'intent'});
        return ask(intent?'Of course. I can '+(intent==='meeting'?'help arrange a meeting':'pass along a message')+'. What is the best callback phone number? You can say same number if you are calling from the best number.':'Absolutely. Would you like to leave a message for '+dep+' or arrange a meeting?');
      }
      case 'intent': {
        const intent=preferredIntent(speech);
        if(!intent)return ask('No problem. Should I take a message or arrange a meeting?');
        await save({intent,step:'phone'});
        return ask('Certainly. What is the best callback phone number? You can say same number if the number you are calling from is best.');
      }
      case 'phone': {
        const phone=normalizePhone(speech,call.callerPhone||'');
        if(!/^\+[1-9]\d{7,14}$/.test(phone))return ask('Could you repeat your callback phone number, including the area code?');
        await save({callerPhone:phone,step:'email'});
        return ask('Thank you. What is the best email address for the team to reach you? Feel free to spell it slowly.');
      }
      case 'email': {
        const email=await normalizeEmail(speech,client);
        if(!email)return ask("I couldn't quite make out the email address. Could you say it slowly, for example name at company dot com?");
        await save({email,step:'email_confirm'});
        return ask('Just to confirm, I heard '+email.replace('@',' at ').replace(/\./g,' dot ')+'. Is that correct?');
      }
      case 'email_confirm': {
        if(no(speech)){await save({step:'email',email:''});return ask('Of course. Could you repeat or spell the correct email address for me?');}
        if(!yes(speech))return ask('Was that email address correct? Please say yes or no.');
        if(call.intent==='meeting'){await save({step:'meeting_purpose'});return ask('Wonderful. What would you like to discuss at the meeting?');}
        await save({step:'message'});return ask('What message would you like me to pass along to '+(call.department||'the team')+'?');
      }
      case 'meeting_purpose': {
        await save({message:speech,step:'meeting_time'});
        return ask('What date and time works best for you? Please include the time zone if you are outside Eastern time.');
      }
      case 'meeting_time': {
        const startISO=await parseTime(speech,client).catch(()=> '');
        if(!startISO){await save({preferredTime:speech,step:'reminder',status:'meeting_requested'});return ask("I have your preferred time noted. I'll have our team confirm availability. Would you like an email acknowledging your meeting request?");}
        const avail=await availability(client,config,startISO);
        if(avail.bookable){
          await save({preferredTime:speech,meetingStartISO:startISO,step:'meeting_confirm'});
          return ask('I found an opening on '+formatInTz(startISO,TZ)+'. Would you like me to confirm that appointment?');
        }
        await save({preferredTime:speech,step:'reminder',status:'meeting_requested'});
        return ask("I've recorded your preferred time. Our team will confirm the appointment because I can't verify that slot right now. Would you like an email acknowledging your meeting request?");
      }
      case 'meeting_confirm': {
        if(no(speech)){await save({step:'meeting_time',meetingStartISO:''});return ask('Of course. What other date and time would suit you?');}
        if(!yes(speech))return ask('Shall I book that time? Please say yes or no.');
        const booked=await book(client,config,call).catch(()=>({ok:false,reason:'calendar unavailable'}));
        await save(booked.ok?{calendarEventId:booked.eventId,meetingEndISO:booked.endISO,status:'booked',step:'reminder'}:{status:'meeting_requested',step:'reminder'});
        return ask(booked.ok?'Perfect, your meeting is booked. Would you like an email confirmation and reminder?':'I have saved your meeting request, but could not confirm the calendar booking. Our team will follow up. Would you like an email acknowledgement?');
      }
      case 'message': {
        await save({message:speech,status:'message',step:'reminder'});
        return ask('Thank you. Would you like an email acknowledging your message?');
      }
      case 'reminder': {
        if(!yes(speech)&&!no(speech))return ask('Would you like an email from Rosie AI about this, yes or no?');
        return await finish(client,service,config,call,{reminderConsent:yes(speech),status:call.status==='in_progress'?'message':call.status});
      }
      default:return reply(msg('Thanks for calling Rosie AI. Goodbye!')+'<Hangup/>');
    }
  }catch(e:any){
    console.error('[RosieReception] error',e?.message);
    return reply(msg("I'm sorry, I couldn't complete that just now. Please call back later.")+'<Hangup/>');
  }
}
