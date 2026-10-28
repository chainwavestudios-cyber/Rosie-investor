import { useCallback, useEffect, useRef, useState } from 'react';
import { createLocalAudioTrack, Room, RoomEvent } from 'livekit-client';
import { base44 } from '@/api/base44Client';
/**
 * Consented microphone relay only. Monitor participants may HEAR an opted-in
 * trainee. Coach talk-in is audible to trainee, but is NOT injected into the
 * external AI voice-agent session or advertised as a call takeover.
 */
export default function useBobLiveMonitor(){
 const roomRef=useRef(null),micRef=useRef(null),audioRef=useRef(new Set());
 const [connected,setConnected]=useState(false),[talking,setTalking]=useState(false),[error,setError]=useState('');
 const disconnect=useCallback(async()=>{
  try{if(micRef.current){await roomRef.current?.localParticipant.unpublishTrack(micRef.current);micRef.current.stop();micRef.current=null;}}catch{}
  try{await roomRef.current?.disconnect();}catch{}
  roomRef.current=null;
  for(const el of audioRef.current){try{el.remove();}catch{}}
  audioRef.current.clear();setConnected(false);setTalking(false);
 },[]);
 const join=useCallback(async({organizationId,presenceId,presenceToken,mode='trainee',talk=false})=>{
  await disconnect();setError('');
  try{
   const reply=await base44.functions.invoke('bobMonitor',{organizationId,presenceId,presenceToken,mode,talk});
   const data=reply?.data||reply;
   if(data.error)throw new Error(data.error);
   const room=new Room({adaptiveStream:true,dynacast:true});
   room.on(RoomEvent.TrackSubscribed,(track)=>{
    if(track.kind==='audio'){
      const element=track.attach();element.autoplay=true;
      document.body.appendChild(element);audioRef.current.add(element);
    }
   });
   room.on(RoomEvent.TrackUnsubscribed,track=>{
    try{for(const elem of track.detach()){elem.remove();audioRef.current.delete(elem);}}catch{}
   });
   room.on(RoomEvent.Disconnected,()=>{setConnected(false);});
   await room.connect(data.url,data.token,{autoSubscribe:true});
   roomRef.current=room;setConnected(true);
   if(mode==='trainee'){
     const mic=await createLocalAudioTrack({echoCancellation:true,noiseSuppression:true});
     await room.localParticipant.publishTrack(mic);
     micRef.current=mic;
   }
   return {canPublish:!!data.canPublish,coachTalkAllowed:!!data.coachTalkAllowed};
  }catch(e){await disconnect();setError(e.message||'Live monitor failed.');throw e;}
 },[disconnect]);
 const toggleTalk=useCallback(async()=>{
  if(!roomRef.current)throw new Error('Not in a live monitor session.');
  if(micRef.current){
    await roomRef.current.localParticipant.unpublishTrack(micRef.current);
    micRef.current.stop();micRef.current=null;setTalking(false);return;
  }
  const mic=await createLocalAudioTrack({echoCancellation:true,noiseSuppression:true});
  await roomRef.current.localParticipant.publishTrack(mic);
  micRef.current=mic;setTalking(true);
 },[]);
 useEffect(()=>()=>{disconnect();},[disconnect]);
 return {join,disconnect,toggleTalk,connected,talking,error};
}
