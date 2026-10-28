import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AudioLines, BookOpen, Building2, ChartNoAxesCombined, Check,
  CircleHelp, Clock3, GraduationCap, Headphones, KeyRound, LayoutDashboard,
  LogOut, Mic2, Pause, Play, Plus, Settings2, ShieldCheck, Square,
  Trash2, UserRoundPlus, Users, Volume2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDebtBobVoice } from '@/hooks/useDebtBobVoice';
import { BOB_CHARACTERS, DEFAULT_THINK_MODEL } from '@/components/debt/bob/BobCharacters';
import { BobBrand } from './BobMarketing';
import BobVault, { BobVaultLock } from './BobVault';
import BobBillingPanel from './BobBillingPanel';
import BobFlowStudio from './BobFlowStudio';
import BobSupervisor from './BobSupervisor';
import BobCallFlowControls from './BobCallFlowControls';
import BobAddonsPanel from './BobAddonsPanel';
import BobAdminCenter from './BobAdminCenter';
import useBobLiveMonitor from '@/hooks/useBobLiveMonitor';
import { sealRecording } from '@/lib/bobAudioCrypto';
import { mockCustomer,applyTokens,clearCues } from '@/lib/bobSimulation';
import { encryptCustomerContent, decryptCustomerContent } from '@/lib/bobKnowledgeCrypto';
import './BobSite.css';

async function api(action, payload={}) {
  const res=await base44.functions.invoke('bobSaas',{action,...payload});
  const data=res?.data||res;
  if(data?.error)throw new Error(data.error);
  return data;
}
const voices=[
  {id:'flux-cliff-en',name:'Cliff · Warm and grounded'},
  {id:'flux-miles-en',name:'Miles · Clear and confident'},
  {id:'flux-drew-en',name:'Drew · Natural and direct'},
  {id:'flux-bruce-en',name:'Bruce · Deeper male'},
  {id:'flux-marcus-en',name:'Marcus · Serious and composed'},
  {id:'flux-cole-en',name:'Cole · Friendly and casual'},
  {id:'flux-hannah-en',name:'Hannah · Calm and thoughtful'},
  {id:'flux-alexis-en',name:'Alexis · Bright and assured'},
  {id:'flux-sienna-en',name:'Sienna · Approachable'},
  {id:'flux-paige-en',name:'Paige · Natural and expressive'},
  {id:'flux-elise-en',name:'Elise · Warm and steady'},
];
const tabs=[
  {id:'overview',label:'Overview',Icon:LayoutDashboard},
  {id:'admin',label:'Administration',Icon:Settings2,admin:true},
  {id:'training',label:'Training room',Icon:Headphones},
  {id:'sessions',label:'Training history',Icon:ChartNoAxesCombined},
  {id:'knowledge',label:'Knowledge base',Icon:BookOpen,admin:true},
  {id:'team',label:'Trainees & seats',Icon:Users,admin:true},
  {id:'settings',label:'Organization settings',Icon:Settings2,admin:true},
  {id:'billing',label:'Seats & billing',Icon:KeyRound,admin:true},
  {id:'addons',label:'Live products',Icon:AudioLines,admin:true},
  {id:'workflow',label:'Workflow studio',Icon:BookOpen,admin:true},
  {id:'supervisor',label:'Manager cockpit',Icon:Users,admin:true}
];
const errorMessage=(err)=>err?.response?.data?.error||err?.response?.data?.message||err?.message||String(err);

export default function BobPortal({initialAdmin=false}){
  const navigate=useNavigate();
  const [ctx,setCtx]=useState(null),[orgId,setOrgId]=useState(''),[tab,setTab]=useState(initialAdmin?'admin':'overview');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [documents,setDocuments]=useState([]),[members,setMembers]=useState([]),[sessions,setSessions]=useState([]),[inquiries,setInquiries]=useState([]);
  const [vaultKey,setVaultKey]=useState(null),[decryptedDocs,setDecryptedDocs]=useState([]),[sessionHeaders,setSessionHeaders]=useState({});
  const [newOrg,setNewOrg]=useState({name:'',industry:'General sales',seatLimit:5,ownerEmail:'',requestedAddons:[]});
  const [newMember,setNewMember]=useState({email:'',displayName:'',role:'trainee'});
  const [flows,setFlows]=useState([]),[scripts,setScripts]=useState([]);
  const [selectedFlowId,setSelectedFlowId]=useState(''),[stageIndex,setStageIndex]=useState(0);
  const [previousSessionId,setPreviousSessionId]=useState(''),[priorDialogue,setPriorDialogue]=useState([]);
  const [simActions,setSimActions]=useState([]),[creditReport,setCreditReport]=useState(null);
  const [recordConsent,setRecordConsent]=useState(false),[monitorConsent,setMonitorConsent]=useState(false),[coachTalkConsent,setCoachTalkConsent]=useState(false);
  const presenceRef=useRef(null),recordContextRef=useRef(null);
  const [presence,setPresence]=useState(null);
  const monitorRoom=useBobLiveMonitor();

  const [settings,setSettings]=useState({name:'',industry:'',preferredVoice:'flux-cliff-en',seatLimit:3,status:'trial'});
  const [deepgramKey,setDeepgramKey]=useState('');
  const [selectedSession,setSelectedSession]=useState(null);
  const [reviewBusy,setReviewBusy]=useState(false);
  const [scenario,setScenario]=useState('First-time prospect discovery'),[mode,setMode]=useState('outbound');
  const [personaId,setPersonaId]=useState('classic_bob'),[difficulty,setDifficulty]=useState(6),[voice,setVoice]=useState('flux-cliff-en');
  const [notes,setNotes]=useState(''),[messages,setMessages]=useState([]),[callBusy,setCallBusy]=useState(false);
  const messagesRef=useRef([]),startRef=useRef(null);
  const onTranscript=useCallback((entry)=>{
    messagesRef.current=[...messagesRef.current,entry];
    setMessages(messagesRef.current);
  },[]);
  const onRecordingBlob=useCallback(async(blob)=>{
    const record=recordContextRef.current;
    if(!record?.key || !record?.organizationId || !record?.presenceToken || !record?.consented)return;
    try{
      // No unencrypted audio ever goes to the file service.
      const sealed=await sealRecording(record.key,blob,record.organizationId);
      const result=await base44.integrations.Core.UploadPrivateFile({file:sealed.file});
      if(!result?.file_uri)throw new Error('Private recording upload did not return a file URI.');
      await api('recordingSaved',{organizationId:record.organizationId,
        presenceToken:record.presenceToken,callId:record.callId,fileUri:result.file_uri,
        encryptedIv:sealed.iv,sizeBytes:sealed.file.size,
        durationSeconds:Math.max(0,Math.round((Date.now()-record.started)/1000))});
      setNotice('Call audio saved encrypted in your organization private storage.');
    }catch(e){setError('Private recording could not be saved: '+errorMessage(e));}
  },[]);
  const voiceCall=useDebtBobVoice({onTranscript,onRecordingBlob,
    recordingPolicy:recordConsent?'encrypted':'disabled',lazyMicDevices:true});
  const org=ctx?.organizations?.find(o=>o.id===orgId);
  const isPlatform=!!ctx?.isPlatformAdmin;
  const isMember=!!org && org.myRole!=='platform';
  const isAdmin=!!org && ['admin','owner'].includes(org.myRole);
  const isManager=org?.myRole==='manager';
  const isSupervisor=isAdmin||isManager;
  const canDesign=isAdmin||(isManager&&!!org?.managerCanConfigure);
  const canConfigure=isPlatform||isAdmin;
  const selectedFlow=flows.find(f=>f.dbId===selectedFlowId);
  const selectedStage=selectedFlow?.stages?.[stageIndex];
  const customer=mockCustomer(orgId+selectedFlowId,{});
  const availableSeats=Math.max(0,(Number(org?.seatLimit)||0)-members.filter(m=>m.status==='active').length);
  const reloadContext=useCallback(async()=>{
    const data=await api('context');
    setCtx(data);setOrgId(current=>data.organizations.find(o=>o.id===current)?.id||data.organizations[0]?.id||'');
    return data;
  },[]);

  useEffect(()=>{
    let active=true;
    (async()=>{try{
      await base44.auth.me();
      if(active)await reloadContext();
    }catch(e){if(active)setError('Sign in using your BOB training account to continue.');}
    finally{if(active)setLoading(false);}})();
    return()=>{active=false};
  },[reloadContext]);

  const reloadOrg=useCallback(async()=>{
    if(!orgId||!ctx?.organizations?.some(o=>o.id===orgId && o.myRole!=='platform')){
      setDocuments([]);setSessions([]);setMembers([]);return;
    }
    const isManager=['admin','owner'].includes(ctx?.organizations.find(o=>o.id===orgId)?.myRole);
    const calls=[api('knowledge',{organizationId:orgId}),api('sessions',{organizationId:orgId})];
    if(isManager)calls.push(api('members',{organizationId:orgId}));
    const results=await Promise.all(calls);
    setDocuments(results[0].documents||[]);
    setSessions(results[1].sessions||[]);
    setMembers(isManager?results[2].members||[]:[]);
  },[orgId,isPlatform,ctx?.organizations]);
  useEffect(()=>{reloadOrg().catch(e=>setError(errorMessage(e)));},[reloadOrg]);
  useEffect(()=>{
    // Public signup stores ONLY non-secret signup preferences in sessionStorage.
    // The organization is created only after verified Base44 authentication.
    try{
      const raw=window.sessionStorage.getItem('bob_signup_preferences_v1');
      if(!raw)return;
      const selected=JSON.parse(raw);
      if(selected&&typeof selected==='object'){
        setNewOrg(current=>({...current,
          name:String(selected.name||'').slice(0,120),
          industry:String(selected.industry||'General sales').slice(0,80),
          requestedAddons:Array.isArray(selected.requestedAddons)?
            ['live_qa','live_coach'].filter(id=>selected.requestedAddons.includes(id)):[]
        }));
      }
    }catch{}
  },[]);

  useEffect(()=>{
    setVaultKey(null);setDecryptedDocs([]);setSessionHeaders({});setSelectedSession(null);
    setFlows([]);setScripts([]);setSelectedFlowId('');setStageIndex(0);setPriorDialogue([]);
    setCreditReport(null);setSimActions([]);setPreviousSessionId('');setPresence(null);
  },[orgId]);
  const reloadFlowLibrary=useCallback(async()=>{
    if(!vaultKey||!orgId||!isMember){setFlows([]);setScripts([]);return;}
    const [flowData,scriptData]=await Promise.all([
      api('listFlows',{organizationId:orgId}),api('listScripts',{organizationId:orgId})
    ]);
    const unpack=async row=>{try{return{...await decryptCustomerContent(vaultKey,row.encryptedPayload,orgId),dbId:row.id};}
      catch{return null;}};
    const [unpackedFlows,unpackedScripts]=await Promise.all([
      Promise.all((flowData.items||[]).map(unpack)),Promise.all((scriptData.items||[]).map(unpack))
    ]);
    setFlows(unpackedFlows.filter(Boolean));setScripts(unpackedScripts.filter(Boolean));
  },[orgId,vaultKey,isMember]);
  useEffect(()=>{reloadFlowLibrary().catch(e=>setError(errorMessage(e)));},[reloadFlowLibrary]);
  useEffect(()=>{
    const onChange=e=>{if(e.detail?.organizationId===orgId)reloadFlowLibrary().catch(()=>{});};
    window.addEventListener('bob_flow_saved',onChange);
    return()=>window.removeEventListener('bob_flow_saved',onChange);
  },[orgId,reloadFlowLibrary]);
  useEffect(()=>{
    let alive=true;if(!vaultKey||!previousSessionId){setPriorDialogue([]);return;}
    const session=sessions.find(s=>s.id===previousSessionId);
    if(!session)return;
    decryptCustomerContent(vaultKey,session.encryptedPayload,orgId).then(data=>{
      if(alive)setPriorDialogue(data.transcript||[]);
    }).catch(e=>{if(alive)setError(errorMessage(e));});
    return()=>{alive=false;};
  },[previousSessionId,sessions,vaultKey,orgId]);
  useEffect(()=>{
    if(!presence?.sessionToken)return;
    const token=presence.sessionToken,organizationId=orgId;
    const heartbeat=()=>api('presenceHeartbeat',{organizationId,sessionToken:token,
      stage:selectedStage?.label||scenario}).catch(()=>{});
    const interval=setInterval(heartbeat,25000);
    return()=>clearInterval(interval);
  },[presence?.sessionToken,orgId,selectedStage?.label,scenario]);
  useEffect(()=>{
    let mounted=true;
    if(!vaultKey||!orgId){setDecryptedDocs([]);return;}
    Promise.all(documents.map(async(d)=>{
      try{return await decryptCustomerContent(vaultKey,d.encryptedPayload,orgId);}
      catch{return null;}
    })).then(results=>{if(mounted)setDecryptedDocs(results.filter(Boolean));})
      .catch(e=>{if(mounted)setError(errorMessage(e));});
    return()=>{mounted=false;};
  },[documents,vaultKey,orgId]);
  useEffect(()=>{
    let mounted=true;
    if(!vaultKey||!orgId){setSessionHeaders({});return;}
    Promise.all(sessions.map(async(s)=>{
      try{const content=await decryptCustomerContent(vaultKey,s.encryptedPayload,orgId);
        return [s.id,{scenario:content.scenario,mode:content.mode}];}
      catch{return[s.id,{scenario:'Cannot decrypt',mode:'—'}];}
    })).then(entries=>{if(mounted)setSessionHeaders(Object.fromEntries(entries))}).catch(()=>{});
    return()=>{mounted=false;};
  },[sessions,vaultKey,orgId]);
  useEffect(()=>{
    if(org){setSettings({name:org.name,industry:org.industry,preferredVoice:org.preferredVoice||'flux-cliff-en',
      seatLimit:org.seatLimit,status:org.status,
      managerCanConfigure:!!org.managerCanConfigure,
      managerCanControlRecording:!!org.managerCanControlRecording,
      allowSessionRecording:!!org.allowSessionRecording,
      allowLiveMonitoring:!!org.allowLiveMonitoring});setVoice(org.preferredVoice||'flux-cliff-en');}
  },[org?.id,org?.name,org?.industry,org?.preferredVoice,org?.seatLimit,org?.status,org?.managerCanConfigure,org?.managerCanControlRecording,org?.allowSessionRecording,org?.allowLiveMonitoring]);
  useEffect(()=>{if(isPlatform)api('listInquiries').then(d=>setInquiries(d.inquiries||[])).catch(()=>{});},[isPlatform]);

  async function act(fn,success='Saved.'){
    setBusy(true);setError('');setNotice('');
    try{await fn();setNotice(success);await reloadContext();await reloadOrg();}
    catch(e){setError(errorMessage(e));}finally{setBusy(false);}
  }
  const createOrg=async(e)=>{e.preventDefault();await act(async()=>{
    const data=await api('createOrg',newOrg);setOrgId(data.organization.id);setNewOrg({name:'',industry:'General sales',seatLimit:5,ownerEmail:'',requestedAddons:[]});
    try{window.sessionStorage.removeItem('bob_signup_preferences_v1');}catch{}
  },'Organization created. You can now assign trainees.');};
  const addMember=async(e)=>{e.preventDefault();await act(async()=>{
    const result=await api('addMember',{organizationId:orgId,...newMember});setNewMember({email:'',displayName:'',role:'trainee'});
    if(result.invitationStatus!=='sent')setNotice('Seat assigned but automated email delivery failed; share the portal URL directly.');
  },'Training seat assigned. Ask your trainee to sign in with that email.');};

  const changeRole=async(memberId,role)=>{
    await act(()=>api('updateMemberRole',{organizationId:orgId,memberId,role}),
      'Team member role updated.');
  };
  const setPlatformOrg=async(targetId,fields)=>{
    const result=await api('setOrg',{organizationId:targetId,...fields});
    await reloadContext();
    return result;
  };
  const createPlatformOrg=async(form)=>{
    const result=await api('createOrg',form);
    await reloadContext();
    if(result?.organization?.id)setOrgId(result.organization.id);
    return result;
  };
  const updatePlatformInquiry=async(inquiryId,status)=>{
    const result=await api('updateInquiry',{inquiryId,status});
    setInquiries(list=>list.map(i=>i.id===inquiryId?{...i,status}:i));
    return result;
  };
  const resendInvite=async(memberId)=>act(()=>api('resendMemberInvite',{organizationId:orgId,memberId}),
    'A fresh invitation was emailed to this member.');
  const saveSettings=async(e)=>{e.preventDefault();await act(()=>api('setOrg',{organizationId:orgId,...settings}),'Organization settings saved.');};
  const saveKey=async(e)=>{e.preventDefault();await act(async()=>{await api('setDeepgramKey',{organizationId:orgId,key:deepgramKey});setDeepgramKey('');},'Deepgram credential updated. The key is stored encrypted, not displayed.');};

  const advanceStage=async()=>{
    if(!selectedFlow || stageIndex>=selectedFlow.stages.length-1)return;
    if(!['idle','error'].includes(voiceCall.phase))await finish();
    // The next AI voice stage reconnects with previous conversation memory.
    // This is an explicitly simulated handoff, not a real phone-line transfer.
    setPriorDialogue(prev=>[...prev,...messagesRef.current].slice(-50));
    setStageIndex(i=>Math.min(i+1,selectedFlow.stages.length-1));
    setSimActions(prev=>[...prev,{time:new Date().toLocaleTimeString(),
      message:'Advanced to the next simulated call stage. Start the next AI conversation when ready.'}]);
  };
  const triggerAction=async(action)=>{
    const messages={
      qualify:'Customer marked qualified in this fictional scenario.',
      mock_credit:'Synthetic credit report generated in the browser — no real bureau inquiry.',
      send_email:'Mock credentials email marked as sent. No email was actually sent.',
      send_text:'Mock SMS marked as sent. No text message was actually sent.',
      capture_data:'Practice contact fields captured in the simulator only.',
      confirm_debt:'Mock debt amount verified for the scenario.',
      transfer:'AI handoff prepared. Advance to the next stage for the next agent voice.',
      callback:'Follow-up requested. Advance to callback stage or choose this session on the next call.',
      completed:'Simulation stage marked complete.'
    };
    if(action==='mock_credit')setCreditReport(mockCustomer(orgId+selectedFlowId,{createdAt:new Date().toISOString()}));
    setSimActions(list=>[...list,{time:new Date().toLocaleTimeString(),message:messages[action]||action}]);
    if(action==='transfer'&&selectedFlow && stageIndex<selectedFlow.stages.length-1)await advanceStage();
  };
  const start=async()=>{
    if(!orgId||callBusy||!['idle','error'].includes(voiceCall.phase))return;
    if(!vaultKey){setError('Unlock your customer-owned knowledge vault before starting training.');return;}
    setCallBusy(true);setError('');setNotice('');
    let currentPresence=null;
    try{
      const grant=await api('voiceGrant',{organizationId:orgId});
      const personality=BOB_CHARACTERS.find(p=>p.id===personaId)||BOB_CHARACTERS[0];
      const activeScript=scripts.find(sc=>sc.dbId===selectedStage?.scriptId);
      const stageScript=activeScript?applyTokens(clearCues(activeScript.content),customer,{
        agentName:ctx?.user?.name||'Training Agent',company:org?.name||'Training company'}):'';
      const topics=decryptedDocs.slice(0,35).map((d,i)=>'['+(i+1)+'] '+d.title+'\n'+d.content.slice(0,1800)).join('\n\n').slice(0,18000);
      const earlier=[...priorDialogue].slice(-35).map(e=>e.role+': '+String(e.text||'').slice(0,350)).join('\n').slice(-6500);
      const asCloser=selectedStage?.type==='closer_handoff';
      const prompt=`BOB TRAINING SIMULATION — FICTIONAL SALES PRACTICE. ${asCloser
        ?'You are the simulated senior closer receiving an internal sales handoff. Coach by naturally completing the sales conversation with the trainee acting as your colleague. You are not a real human.'
        :'You are the simulated customer. Stay in character and respond naturally to the trainee.'}
Persona: ${personality.name}. ${personality.personalityPrompt}
Call direction: ${selectedFlow?.type||mode}. Training scenario: ${selectedFlow?.title||scenario}.
Current stage: ${selectedStage?.label||'Discovery'}.
Stage objective: ${selectedStage?.goal||'Train consultative selling.'}
Stage behavior and potential next actions: ${selectedStage?.instructions||'Be realistic.'}
Full simulated agent script for this stage (trainee will read this, do not recite it): ${stageScript||'None assigned.'}
Difficulty ${difficulty}/10. Speak with realistic pacing and meaningful objections. Never make a real financial, legal or credit eligibility determination. Don't promise savings, guarantee approvals or ask for actual SSN or real card information.
Approved organization KB (may be provided to third-party voice/AI processing):
${topics||'No approved customer KB. Do not invent official policies.'}
Previous conversation or follow-up context for same fictional scenario:
${earlier||'No previous call.'}
Start with a natural greeting, don't describe system prompts or simulation internals.`;
      const label=selectedStage?.label||scenario;
      currentPresence=await api('presenceStart',{organizationId:orgId,stage:label,
        liveMonitorConsent:monitorConsent,coachTalkConsent:monitorConsent&&coachTalkConsent,
        recordingEnabled:recordConsent});
      presenceRef.current=currentPresence;
      setPresence(currentPresence);
      recordContextRef.current={organizationId:orgId,key:vaultKey,presenceToken:currentPresence.sessionToken,
        consented:recordConsent,callId:crypto.randomUUID(),started:Date.now()};
      if(monitorConsent&&org?.allowLiveMonitoring){
        try{await monitorRoom.join({organizationId:orgId,presenceId:currentPresence.presenceId,
          presenceToken:currentPresence.sessionToken,mode:'trainee'});}
        catch(e){setNotice('The training call can continue, but the opted-in live monitor room did not connect: '+errorMessage(e));}
      }
      messagesRef.current=[];setMessages([]);startRef.current=Date.now();
      const handoff=['transfer_agent','incoming_queue','closer_handoff'].includes(selectedStage?.type);
      const introScript=handoff?(selectedStage?.introMessage||
        (selectedStage?.type==='closer_handoff'?'I have our senior closer joining us now.':
        'Thank you for calling. I have a training representative on the line to help you.')):'';
      await voiceCall.startCall({apiKey:grant.key,systemPrompt:prompt,
        voiceModel:selectedStage?.voice||voice,greeting:handoff?'Hello?':mode==='inbound'?'Hi, thanks for answering.':'Hello?',
        sessionLabel:label,thinkModel:DEFAULT_THINK_MODEL,
        introScript,introVoice:'aura-asteria-en'});
    }catch(e){
      setError(errorMessage(e));startRef.current=null;
      if(currentPresence){
        await api('presenceEnd',{organizationId:orgId,sessionToken:currentPresence.sessionToken}).catch(()=>{});
        setPresence(null);presenceRef.current=null;await monitorRoom.disconnect();
      }
    }finally{setCallBusy(false);}
  };
  const finish=async()=>{
    const durationSeconds=startRef.current?Math.round((Date.now()-startRef.current)/1000):0;
    voiceCall.hangup();startRef.current=null;
    await monitorRoom.disconnect();
    const present=presenceRef.current;presenceRef.current=null;setPresence(null);
    if(present)api('presenceEnd',{organizationId:orgId,sessionToken:present.sessionToken}).catch(()=>{});
    if(durationSeconds<1)return;
    if(!vaultKey){setError('Session could not be saved because the vault is locked.');return;}
    try {
      const encryptedPayload=await encryptCustomerContent(vaultKey,{
        transcript:messagesRef.current,notes,scenario:selectedFlow?.title||scenario,
        stage:selectedStage?.label||'Stand-alone',
        mode:selectedFlow?.type||mode,persona:personaId,difficulty,voiceModel:selectedStage?.voice||voice,
        simActions,creditReport
      },orgId);
      await act(()=>api('saveSession',{organizationId:orgId,scenario:'Private training',
        durationSeconds,encryptedPayload}),
        'Training session saved with browser-side encryption.');
      setNotes('');
    }catch(e){setError(errorMessage(e));}
  };
  const getReview=async()=>{
    if(!selectedSession)return;
    setReviewBusy(true);setError('');
    try{
      if(!vaultKey)throw new Error('Unlock the customer vault first.');
      const transcript=JSON.parse(selectedSession.transcriptJson||'[]');
      const result=await api('reviewSession',{organizationId:orgId,sessionId:selectedSession.id,transcript});
      const encryptedReview=await encryptCustomerContent(vaultKey,result.review,orgId);
      await api('saveReview',{organizationId:orgId,sessionId:selectedSession.id,encryptedReview});
      setSelectedSession(s=>s?.id===selectedSession.id?{...s,reviewJson:JSON.stringify(result.review),score:result.review.score}:s);
      await reloadOrg();
    }catch(e){setError(errorMessage(e));}finally{setReviewBusy(false);}
  };
  const openSession=async(s)=>{
    if(selectedSession?.id===s.id){setSelectedSession(null);return;}
    if(!vaultKey){setError('Unlock your customer-owned vault to review training transcripts.');return;}
    setError('');
    try{
      const content=await decryptCustomerContent(vaultKey,s.encryptedPayload,orgId);
      const review=s.encryptedReview?await decryptCustomerContent(vaultKey,s.encryptedReview,orgId):null;
      setSelectedSession({...s,scenario:content.scenario||'Training',mode:content.mode||'private',transcriptJson:JSON.stringify(content.transcript||[]),notes:content.notes||'',
        reviewJson:review?JSON.stringify(review):'',score:review?.score});
    }catch(e){setError(errorMessage(e));}
  };
  const exit=async()=>{setVaultKey(null);try{await base44.auth.logout();}finally{navigate('/bob/login');}};
  if(loading)return <div className="bob-site"><div className="bob-empty" style={{margin:'24vh auto',maxWidth:450}}>Loading your BOB training portal…</div></div>;

  return <div className="bob-site"><header className="bob-nav"><BobBrand/><div className="bob-nav-links"><Link to="/bob">BOB website</Link><Link to="/bob/portal">Training portal</Link>{(isPlatform||isAdmin||isManager)&&<Link to="/bob/admin">Administration</Link>}<span style={{color:'#a5b3c5'}}>{ctx?.user?.email||'Not signed in'}</span><button className="bob-btn bob-btn-ghost" onClick={exit}><LogOut size={14}/> Sign out</button></div></header>
    <main className="bob-portal">
      {!ctx?<div className="bob-form-page"><div className="bob-panel"><h2>Sign in to BOB</h2><p>Use your account to access a training workspace.</p>{error&&<p className="bob-message error">{error}</p>}<button className="bob-btn bob-btn-gold" onClick={()=>base44.auth.redirectToLogin(window.location.href)}>Sign in securely</button></div></div>
      :!org?<div style={{maxWidth:660,margin:'55px auto'}}><div className="bob-eyebrow">Welcome to BOB</div><h1 style={{fontSize:39,letterSpacing:'-.05em',margin:'12px 0'}}>Create your training organization.</h1><p className="bob-portal-desc">Use your company name to create an isolated training space. Invite team members by the email they'll use to sign in.</p><form className="bob-panel" onSubmit={createOrg} style={{marginTop:24}}><div className="bob-field"><label>Organization name *</label><input required minLength={2} value={newOrg.name} onChange={e=>setNewOrg(s=>({...s,name:e.target.value}))} placeholder="Your company name"/></div><div className="bob-field"><label>Industry / training focus</label><input value={newOrg.industry} onChange={e=>setNewOrg(s=>({...s,industry:e.target.value}))} placeholder="e.g. Financial services"/></div>{isPlatform&&<><div className="bob-field"><label>Owner email</label><input type="email" value={newOrg.ownerEmail} onChange={e=>setNewOrg(s=>({...s,ownerEmail:e.target.value}))} placeholder="Owner's account email"/></div><div className="bob-field"><label>Licensed training seats</label><input type="number" min="1" value={newOrg.seatLimit} onChange={e=>setNewOrg(s=>({...s,seatLimit:e.target.value}))}/></div></>}<button className="bob-btn bob-btn-gold" disabled={busy} type="submit"><Plus size={15}/>{busy?'Creating…':'Create organization'}</button><p className="bob-tiny">Self-service organizations start with three trial seats. No card is collected during setup.</p></form></div>
      :<><div className="bob-portal-top"><div><div className="bob-eyebrow">{isPlatform?'BOB Platform · Organization management':'BOB Training Portal'}</div><h1>{org.name}</h1><div className="bob-portal-desc">{org.industry||'Sales training'} · {ctx.user.email}</div></div><div className="bob-portal-top-actions"><span className="bob-pill"><ShieldCheck size={13}/> {org.status?.toUpperCase()}</span><span className="bob-pill"><Users size={13}/> {org.seatLimit} licensed seats</span>{ctx.organizations.length>1&&<label className="bob-field" style={{margin:0}}><span className="bob-tiny">Organization</span><select value={orgId} onChange={e=>{setOrgId(e.target.value);setTab('overview');}}>{ctx.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}</div></div>
      <div className="bob-tabbar" role="tablist" aria-label={initialAdmin?'BOB administration sections':'BOB training portal sections'}>{
      tabs.filter(t=>{
        if(initialAdmin && t.id!=='admin' && t.id!==tab)return false;
        if(!initialAdmin && !['overview','training','sessions','admin'].includes(t.id))return false;
        if(['settings','billing','addons','team'].includes(t.id))return isAdmin||(isPlatform && ['settings','billing','addons'].includes(t.id));
        if(['workflow','knowledge'].includes(t.id))return canDesign;
        if(t.id==='supervisor')return isSupervisor;
        if(t.id==='admin')return isPlatform||isAdmin||isManager;
        return isMember;
      }).map(({id,label,Icon})=><button type="button" key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>{
        if(id==='admin' && !initialAdmin){navigate('/bob/admin');return;}
        if(!['idle','error'].includes(voiceCall.phase)&&id!=='training'){setError('End your live training call before leaving the training room.');return;}
        setTab(id);
      }}><Icon size={16}/>{label}</button>)}</div>
      {error&&<div className="bob-message error" role="alert">{error} <button style={{float:'right',color:'inherit'}} onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
      {notice&&<div className="bob-message success" role="status"><Check size={14} style={{display:'inline',marginRight:8}}/>{notice}</div>}
      {tab==='admin'&&(isPlatform||isAdmin||isManager)&&
        <BobAdminCenter ctx={ctx} org={org} isPlatform={isPlatform} isAdmin={isAdmin}
          isManager={isManager} canDesign={canDesign} isSupervisor={isSupervisor}
          members={members} sessions={sessions} documents={documents} flows={flows} scripts={scripts}
          vaultUnlocked={!!vaultKey} onNavigate={setTab}
          onSelectOrganization={setOrgId} onSetOrganization={setPlatformOrg}
          onCreateOrganization={createPlatformOrg} onSetInquiryStatus={updatePlatformInquiry}
          api={api} onRefresh={reloadContext}/>}
      {tab==='overview'&&<div className="bob-stack"><div className="bob-dashboard-grid"><div className="bob-stat"><span>Licensed seats</span><strong>{org.seatLimit}</strong></div><div className="bob-stat"><span>Assigned trainees</span><strong>{isAdmin?members.filter(m=>m.status==='active').length:'—'}</strong></div><div className="bob-stat"><span>Training sessions</span><strong>{sessions.length}</strong></div><div className="bob-stat"><span>Knowledge entries</span><strong>{documents.length}</strong></div></div><div className="bob-grid-2"><div className="bob-panel"><div className="bob-panel-title"><h3>Train with BOB</h3><GraduationCap size={19} color="#d7b978"/></div><p>Launch a conversation with an AI prospect. Switch between inbound and outbound scenarios, select a persona, and adjust difficulty.</p><button className="bob-btn bob-btn-gold" onClick={()=>setTab('training')}>Enter the training room <Play size={14}/></button></div><div className="bob-panel"><div className="bob-panel-title"><h3>Most recent sessions</h3><Clock3 size={18} color="#d7b978"/></div>{sessions.length===0?<div className="bob-empty">Your training history will appear here after the first practice session.</div>:sessions.slice(0,5).map(s=><div key={s.id} style={{padding:'10px 0',display:'flex',justifyContent:'space-between',borderBottom:'1px solid #ffffff12',gap:12,fontSize:12}}><span>{sessionHeaders[s.id]?.scenario||'Encrypted training'}<small style={{display:'block',color:'#8ea2b1'}}>{s.traineeEmail}</small></span><span style={{color:'#d7b978'}}>{s.durationSeconds?Math.ceil(s.durationSeconds/60)+' min':'—'}</span></div>)}</div></div></div>}
      {tab==='training'&&isMember&&<><BobVaultLock org={org} isAdmin={isAdmin} vaultKey={vaultKey} setVaultKey={setVaultKey} api={api} onInitialized={reloadContext} compact/>
        <BobCallFlowControls flows={flows} selectedFlowId={selectedFlowId} setSelectedFlowId={setSelectedFlowId}
          selectedFlow={selectedFlow} stageIndex={stageIndex} setStageIndex={setStageIndex}
          scripts={scripts} customer={customer} report={creditReport}
          history={priorDialogue} previousSessionId={previousSessionId} setPreviousSessionId={setPreviousSessionId}
          sessions={sessions} onAction={triggerAction} actionLog={simActions}
          liveActive={!['idle','error'].includes(voiceCall.phase)}
          canAdvance={!callBusy} onAdvance={advanceStage}/>
        <div className="bob-grid-2"><div className="bob-stack"><div className="bob-panel"><div className="bob-panel-title"><h3>Training scenario</h3><span className="bob-pill"><Mic2 size={12}/> Live voice simulation</span></div><div className="bob-field"><label>Call direction</label><div className="bob-radio-row"><button type="button" className={mode==='outbound'?'active':''} disabled={voiceCall.phase!=='idle'} onClick={()=>setMode('outbound')}>Outbound prospect</button><button type="button" className={mode==='inbound'?'active':''} disabled={voiceCall.phase!=='idle'} onClick={()=>setMode('inbound')}>Inbound inquiry</button></div></div><div className="bob-field"><label>What will the trainee practice?</label><input value={scenario} maxLength={150} disabled={voiceCall.phase!=='idle'} onChange={e=>setScenario(e.target.value)} placeholder="Discovery, objections, closing…"/></div><div className="bob-field"><label>AI customer persona</label><select value={personaId} disabled={voiceCall.phase!=='idle'} onChange={e=>setPersonaId(e.target.value)}>{BOB_CHARACTERS.map(c=><option key={c.id} value={c.id}>{c.name} — {c.description}</option>)}</select></div><div className="bob-field"><label>Difficulty <span style={{color:'#d7b978'}}>{difficulty} / 10</span></label><input type="range" min={1} max={10} value={difficulty} disabled={voiceCall.phase!=='idle'} onChange={e=>setDifficulty(Number(e.target.value))}/><div className="bob-tiny">1 = receptive · 5 = skeptical · 10 = challenging objections</div></div><div className="bob-field"><label><Volume2 size={13} style={{display:'inline'}}/> Deepgram voice</label><select value={voice} disabled={voiceCall.phase!=='idle'} onChange={e=>setVoice(e.target.value)}>{voices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div><div className="bob-field"><label>Microphone</label><select value={voiceCall.micDeviceId} onChange={e=>voiceCall.setMicDeviceId(e.target.value)}>{voiceCall.micDevices.length?voiceCall.micDevices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||'Mic '+(i+1)}</option>):<option value="">Default microphone</option>}</select></div><div className="bob-field"><label>Audio output</label><select value={voiceCall.outputDeviceId} onChange={e=>voiceCall.setOutputDeviceId(e.target.value)}>{voiceCall.outputDevices.length?voiceCall.outputDevices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||'Speaker '+(i+1)}</option>):<option value="">System default output</option>}</select></div><div className="bob-panel" style={{background:'#081925',padding:15,margin:'12px 0'}}>
        <div className="bob-panel-title"><h3>Recording & live coaching consent</h3><ShieldCheck size={16} color="#d7b978"/></div>
        {org.allowSessionRecording?<label style={{display:'flex',gap:10,alignItems:'center',fontSize:12,color:'#d8e3e8',marginBottom:12}}><input type="checkbox" checked={recordConsent} disabled={!['idle','error'].includes(voiceCall.phase)} onChange={e=>setRecordConsent(e.target.checked)}/> I consent to this practice call being recorded and encrypted for authorized team review.</label>:<p className="bob-tiny">Recording is disabled by your organization.</p>}
        {org.allowLiveMonitoring?<><label style={{display:'flex',gap:10,alignItems:'center',fontSize:12,color:'#d8e3e8',marginBottom:12}}><input type="checkbox" checked={monitorConsent} disabled={!['idle','error'].includes(voiceCall.phase)} onChange={e=>{setMonitorConsent(e.target.checked);if(!e.target.checked)setCoachTalkConsent(false);}}/> I agree to let my authorized manager listen live to this practice microphone.</label>
        {monitorConsent&&<label style={{display:'flex',gap:10,alignItems:'center',fontSize:12,color:'#d8e3e8'}}><input type="checkbox" checked={coachTalkConsent} disabled={!['idle','error'].includes(voiceCall.phase)} onChange={e=>setCoachTalkConsent(e.target.checked)}/> Also allow manager voice coaching to my headphones during the call.</label>}</>:<p className="bob-tiny">Live monitoring is disabled by your organization.</p>}
        {monitorRoom.connected&&<span className="bob-pill">Consented live monitor connected</span>}
        <p className="bob-tiny">Managers can only join when consented. Coach talk-in goes to your headphones, not into a real customer line. Use headphones to avoid feedback.</p>
        </div>
        <div className="bob-voice-status"><span className="bob-voice-dot"/>{voiceCall.phase==='idle'?'Ready for training':voiceCall.phase==='active'?'BOB is connected':voiceCall.phase==='error'?'Voice service error':voiceCall.phase==='ringing'?'Calling BOB…':'Connecting…'}</div>{voiceCall.error&&<p className="bob-message error">{voiceCall.error}</p>}<div style={{display:'flex',gap:9,marginTop:20,flexWrap:'wrap'}}>{voiceCall.phase==='idle'||voiceCall.phase==='error'?<button className="bob-btn bob-btn-gold" disabled={callBusy} onClick={start}><Play size={16}/>{callBusy?'Connecting…':'Start training call'}</button>:<><button className="bob-btn bob-btn-danger" onClick={finish}><Square size={13}/> End & save</button>{voiceCall.phase==='active'&&<button className="bob-btn bob-btn-dark" onClick={voiceCall.paused?voiceCall.resumeCall:voiceCall.pauseCall}>{voiceCall.paused?<Play size={14}/>:<Pause size={14}/>} {voiceCall.paused?'Resume':'Pause'}</button>}</>}</div></div><div className="bob-panel"><div className="bob-panel-title"><h3>Session debrief</h3><CircleHelp size={18} color="#d7b978"/></div><div className="bob-field"><label>Coaching observations (saved at end of call)</label><textarea placeholder="Discovery questions, objection handling, pacing, areas to practice…" value={notes} onChange={e=>setNotes(e.target.value)}/></div><p className="bob-tiny">The training history saves the transcript and your notes. Automatic scoring and manager review workflows are planned upgrades.</p></div></div>
      <div className="bob-panel" style={{minHeight:540}}><div className="bob-panel-title"><h3>Live conversation</h3><span className="bob-pill"><AudioLines size={13}/>{voiceCall.agentSpeaking?'BOB speaking':voiceCall.phase==='active'?'Listening':'Transcript'}</span></div>{messages.length===0?<div className="bob-empty"><div><AudioLines size={40} style={{margin:'0 auto 16px',color:'#c9a96c'}}/><div style={{fontWeight:700,color:'#e4dfd4',marginBottom:7}}>Your training room is ready.</div><span>Connect with BOB to see the conversation live, turn by turn.</span></div></div>:<div className="bob-timeline" aria-live="polite">{messages.map((m,i)=><div className={'bob-chat '+(m.role==='bob'?'bob':'')} key={i}><small>{m.role==='bob'?'BOB · AI CUSTOMER':'YOU · TRAINEE'}</small><p>{m.text}</p></div>)}</div>}</div></div></>}
      {tab==='sessions'&&isMember&&<div className="bob-panel"><div className="bob-panel-title"><h3>Organization training history</h3><span className="bob-tiny">Your latest {sessions.length} sessions</span></div>{sessions.length===0?<div className="bob-empty">No completed training sessions yet.</div>:<div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Scenario</th><th>Trainee</th><th>Direction</th><th>Duration</th><th>Date</th><th/></tr></thead><tbody>{sessions.map(s=><tr key={s.id}><td>{sessionHeaders[s.id]?.scenario||'Encrypted training'}</td><td>{s.traineeEmail}</td><td>{sessionHeaders[s.id]?.mode||'Private'}</td><td>{Math.ceil((s.durationSeconds||0)/60)} min</td><td>{s.createdAt?new Date(s.createdAt).toLocaleDateString():'—'}</td><td><button className="bob-btn bob-btn-ghost" onClick={()=>openSession(s)}>{selectedSession?.id===s.id?'Close':'Review'}</button></td></tr>)}</tbody></table></div>}{selectedSession&&<div className="bob-panel" style={{marginTop:22}}><div className="bob-panel-title"><h3>Session review · {selectedSession.scenario}</h3><button className="bob-btn bob-btn-ghost" onClick={()=>setSelectedSession(null)}>Close</button></div><p className="bob-tiny">Notes: {selectedSession.notes||'No debrief notes added.'}</p>{selectedSession.reviewJson?(()=>{let review;try{review=JSON.parse(selectedSession.reviewJson)}catch{return null}return <div className="bob-panel" style={{marginBottom:18,background:'#132d35'}}><div className="bob-panel-title"><h3>AI coaching scorecard</h3><span className="bob-pill">{review.score}/100</span></div><p>{review.summary}</p><div className="bob-dashboard-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',marginBottom:17}}>{[['Discovery','discovery'],['Listening','listening'],['Clarity','clarity'],['Objections','objections'],['Next steps','nextSteps']].map(([label,key])=><div key={key} className="bob-stat" style={{padding:12}}><span>{label}</span><strong style={{fontSize:23}}>{review[key]}<small style={{fontSize:11,color:'#8195a8'}}>/20</small></strong></div>)}</div><h4 style={{fontSize:13}}>Priorities for next practice</h4><ul style={{fontSize:13,color:'#c7d3dc',lineHeight:1.8}}>{(review.tips||[]).map((tip,i)=><li key={i}>{tip}</li>)}</ul><p className="bob-tiny">AI-generated coaching observations, not an objective certification.</p></div>})():<button className="bob-btn bob-btn-gold" style={{marginBottom:18}} disabled={reviewBusy} onClick={getReview}>{reviewBusy?'Reviewing transcript…':'Generate AI coaching review'}</button>}<div className="bob-timeline">{(()=>{try{return JSON.parse(selectedSession.transcriptJson||'[]')}catch{return[]}})().map((m,i)=><div className={'bob-chat '+(m.role==='bob'?'bob':'')} key={i}><small>{m.role==='bob'?'BOB':'TRAINEE'}</small><p>{m.text}</p></div>)}</div></div>}</div>}
      {tab==='knowledge'&&canDesign&&<>
        <BobVaultLock org={org} isAdmin={isAdmin} vaultKey={vaultKey} setVaultKey={setVaultKey} api={api} onInitialized={reloadContext}/>
        <BobVault org={org} isAdmin={canDesign} documents={documents} vaultKey={vaultKey} api={api} refresh={reloadOrg} busy={busy} act={act}/>
      </>}
      {tab==='workflow'&&canDesign&&<>
        <BobVaultLock org={org} isAdmin={isAdmin} vaultKey={vaultKey} setVaultKey={setVaultKey} api={api} onInitialized={reloadContext} compact/>
        <BobFlowStudio org={org} vaultKey={vaultKey} canDesign={canDesign} api={api} notify={setNotice}/>
      </>}
      {tab==='supervisor'&&isSupervisor&&<>
        <BobVaultLock org={org} isAdmin={isAdmin} vaultKey={vaultKey} setVaultKey={setVaultKey} api={api} onInitialized={reloadContext} compact/>
        <BobSupervisor org={org} vaultKey={vaultKey} api={api}/>
      </>}
      {tab==='team'&&isAdmin&&<div className="bob-grid-2"><form className="bob-panel" onSubmit={addMember}><div className="bob-panel-title"><h3>Assign a training seat</h3><UserRoundPlus size={18} color="#d7b978"/></div><p className="bob-tiny">{availableSeats} of {org.seatLimit} seats available. Each assigned email consumes one seat.</p><div className="bob-field"><label>Trainee email *</label><input type="email" required value={newMember.email} onChange={e=>setNewMember(s=>({...s,email:e.target.value}))} placeholder="person@company.com"/></div><div className="bob-field"><label>Display name</label><input value={newMember.displayName} onChange={e=>setNewMember(s=>({...s,displayName:e.target.value}))}/></div><div className="bob-field"><label>Role</label><select value={newMember.role} onChange={e=>setNewMember(s=>({...s,role:e.target.value}))}><option value="trainee">Trainee</option><option value="manager">Manager</option><option value="admin">Organization administrator</option></select></div><button disabled={busy||availableSeats===0} className="bob-btn bob-btn-gold"><Plus size={15}/> Assign seat</button><p className="bob-tiny">Invitations are emailed automatically when the mail integration is available. Otherwise share the <Link style={{color:'#d7b978'}} to="/bob/login">training portal link</Link>. They sign in using this exact assigned email.</p></form><div className="bob-panel"><div className="bob-panel-title"><h3>Organization members</h3><span className="bob-pill">{members.filter(m=>m.status==='active').length} / {org.seatLimit}</span></div><div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th/></tr></thead><tbody>{members.map(m=><tr key={m.id}><td>{m.displayName&&<div>{m.displayName}</div>}<span style={{color:'#a9bac9'}}>{m.email}</span></td><td>{m.role==='owner'?'owner':<select className="bob-input" style={{maxWidth:130}} value={m.role} disabled={busy} onChange={e=>changeRole(m.id,e.target.value)}><option value="trainee">Trainee</option><option value="manager">Manager</option><option value="admin">Admin</option></select>}</td><td>{m.status}</td><td><div style={{display:'flex',gap:5}}><button disabled={busy} className="bob-btn bob-btn-ghost" type="button" onClick={()=>resendInvite(m.id)}>Resend invite</button>{m.role!=='owner'&&<button disabled={busy} className="bob-btn bob-btn-danger" onClick={()=>{if(window.confirm('Remove this member and release their seat?'))act(()=>api('removeMember',{organizationId:orgId,memberId:m.id}),'Seat released.')}}><Trash2 size={13}/></button>}</div></td></tr>)}</tbody></table></div></div></div>}
      {tab==='addons'&&canConfigure&&<><BobVaultLock org={org} isAdmin={isAdmin} vaultKey={vaultKey} setVaultKey={setVaultKey} api={api} onInitialized={reloadContext} compact/><BobAddonsPanel org={org} api={api} vaultKey={vaultKey} canManage={isAdmin} onNotice={message=>{setNotice(message);reloadContext().catch(()=>{});}}/></>}
      {tab==='billing'&&canConfigure&&<BobBillingPanel organizationId={org.id} organizationName={org.name} orgStatus={org.status} seatLimit={org.seatLimit}/>}
      {tab==='settings'&&canConfigure&&<div className="bob-grid-2"><form className="bob-panel" onSubmit={saveSettings}><div className="bob-panel-title"><h3>Organization profile</h3><Building2 size={18} color="#d7b978"/></div><div className="bob-field"><label>Name</label><input required value={settings.name} onChange={e=>setSettings(s=>({...s,name:e.target.value}))}/></div><div className="bob-field"><label>Industry</label><input value={settings.industry} onChange={e=>setSettings(s=>({...s,industry:e.target.value}))}/></div><div className="bob-field"><label>Default Deepgram voice</label><select value={settings.preferredVoice} onChange={e=>setSettings(s=>({...s,preferredVoice:e.target.value}))}>{voices.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select></div><div className="bob-field"><label>Licensed seats {isPlatform?'· platform controlled':'· managed by BOB'}</label><input type="number" min={1} disabled={!isPlatform} value={settings.seatLimit} onChange={e=>setSettings(s=>({...s,seatLimit:Number(e.target.value)}))}/></div>{isPlatform&&<div className="bob-field"><label>Organization status</label><select value={settings.status} onChange={e=>setSettings(s=>({...s,status:e.target.value}))}><option value="trial">Trial</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>}{isAdmin&&<div className="bob-panel" style={{background:'#091925',marginBottom:18,padding:15}}>
  <h3 style={{marginTop:0}}>Team permissions & privacy policy</h3>
  <p className="bob-tiny">Only customer owners/admins can change these organization-wide rules.</p>
  {[
   ['managerCanConfigure','Allow managers to edit BOB call flows, scripts and knowledge'],
   ['managerCanControlRecording','Allow managers to manage recording options'],
   ['allowSessionRecording','Allow opt-in recording of simulated calls'],
   ['allowLiveMonitoring','Allow trainee-consented live listening and coach talk-in']
  ].map(([key,label])=><label key={key} style={{display:'flex',alignItems:'center',gap:9,margin:'12px 0',fontSize:12,color:'#d1dce4'}}>
   <input type="checkbox" checked={!!settings[key]} onChange={e=>setSettings(o=>({...o,[key]:e.target.checked}))}/>{label}
  </label>)}
</div>}<button className="bob-btn bob-btn-gold" disabled={busy}>Save organization</button></form>{isAdmin&&<form className="bob-panel" onSubmit={saveKey}><div className="bob-panel-title"><h3>Voice provider & credentials</h3><KeyRound size={18} color="#d7b978"/></div><p>BOB supports organization-specific Deepgram credentials. Keys are encrypted server-side. The browser only receives a limited-lifetime training credential.</p><span className="bob-pill">{org.hasDeepgramKey?'Organization key configured':'Using platform voice (if configured)'}</span><div className="bob-field" style={{marginTop:22}}><label>New Deepgram API key</label><input type="password" autoComplete="off" value={deepgramKey} placeholder="Paste to replace existing key" onChange={e=>setDeepgramKey(e.target.value)}/></div><button className="bob-btn bob-btn-gold" disabled={busy||!deepgramKey}>Save new key</button>{org.hasDeepgramKey&&<button type="button" className="bob-btn bob-btn-danger" style={{marginLeft:8}} disabled={busy} onClick={()=>{if(window.confirm('Delete the organization Deepgram key?'))act(()=>api('setDeepgramKey',{organizationId:orgId,key:''}),'Organization key removed.');}}>Remove key</button>}<p className="bob-tiny">A server encryption secret must be configured before organization keys can be saved. Raw keys are never displayed after saving.</p></form>}</div>}
      {isPlatform&&tab==='overview'&&<div className="bob-panel" style={{marginTop:20}}><div className="bob-panel-title"><h3>Platform management</h3><span className="bob-pill">{ctx.organizations.length} organizations</span></div><div className="bob-portal-desc">Switch organizations above to manage their seats, status, and voice settings. Create another customer organization below.</div><form className="bob-form-grid" style={{marginTop:16}} onSubmit={createOrg}><div className="bob-field"><label>New customer organization</label><input required minLength={2} value={newOrg.name} onChange={e=>setNewOrg(s=>({...s,name:e.target.value}))}/></div><div className="bob-field"><label>Owner email</label><input type="email" required value={newOrg.ownerEmail} onChange={e=>setNewOrg(s=>({...s,ownerEmail:e.target.value}))}/></div><div className="bob-field"><label>Seats</label><input type="number" min={1} value={newOrg.seatLimit} onChange={e=>setNewOrg(s=>({...s,seatLimit:Number(e.target.value)}))}/></div><div className="bob-field" style={{justifyContent:'end'}}><button disabled={busy} className="bob-btn bob-btn-gold"><Plus size={15}/> Add organization</button></div></form><h3 style={{marginTop:23}}>Commercial inquiries · {inquiries.length}</h3>{inquiries.length>0?<div className="bob-table-wrap"><table className="bob-table"><thead><tr><th>Contact</th><th>Organization</th><th>Seats</th><th>Inquiry</th></tr></thead><tbody>{inquiries.slice(0,20).map(i=><tr key={i.id}><td>{i.contactName}<div className="bob-tiny">{i.email}</div></td><td>{i.company}</td><td>{i.seatEstimate}</td><td style={{maxWidth:390}}>{i.message||'—'}</td></tr>)}</tbody></table></div>:<p className="bob-tiny">No sales inquiries yet.</p>}</div>}
      </>}
    </main>
  </div>;
}
