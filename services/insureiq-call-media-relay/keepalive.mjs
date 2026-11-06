// Deepgram closes streaming sockets after about 10 seconds without audio.
// KeepAlive MUST be sent as a text frame while an individual track is silent.
// The clock is injectable to make this policy deterministic in tests.
export function installDeepgramKeepAlive(socket,{now=()=>Date.now(),intervalMs=4000}={}){
 let lastAudioAt=now(),closed=false;
 const pulse=()=>{
  if(closed||socket.readyState!==1)return false;
  if(now()-lastAudioAt<intervalMs)return false;
  socket.send(JSON.stringify({type:'KeepAlive'}));return true;
 };
 const interval=setInterval(pulse,intervalMs);
 interval.unref?.();
 return {markAudio(){lastAudioAt=now()},pulse,stop(){if(closed)return;closed=true;clearInterval(interval)}};
}