const respond = (text: string, status: number) => new Response(text,{status,headers:{"Cache-Control":"no-store"}});
Deno.serve(async req => {
  const secret=Deno.env.get("CHAIRSIDE_CALL_SECRET");
  if (!secret || req.method!=="POST" || req.headers.get("authorization")!=="Bearer "+secret) return respond("Unavailable",403);
  const key=Deno.env.get("DEEPGRAM_API_KEY");
  if (!key) return respond("Transcription unavailable",503);
  const type=(req.headers.get("content-type") || "").split(";")[0];
  if (!["audio/webm","audio/ogg","audio/wav","audio/mpeg","audio/mp4","audio/x-mulaw"].includes(type)) return respond("Unsupported audio",415);
  const size=Number(req.headers.get("content-length"));
  const limit=2*1024*1024;
  if (size>limit) return respond("Audio turn too large",413);
  const reader=req.body?.getReader();if (!reader) return respond("Empty audio",400);
  const chunks:Uint8Array<ArrayBuffer>[]=[];let total=0;
  for (;;) {const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();return respond("Audio turn too large",413);}chunks.push(new Uint8Array(value));}
  if (!total) return respond("Empty audio",400);
  const params=new URLSearchParams({model:"nova-3",smart_format:"true"});
  if(type==="audio/x-mulaw"){params.set("encoding","mulaw");params.set("sample_rate","8000");}
  const result=await fetch("https://api.deepgram.com/v1/listen?"+params,{method:"POST",headers:{Authorization:"Token "+key,"Content-Type":type},body:new Blob(chunks,{type}),signal:AbortSignal.timeout(12000)});
  if(!result.ok)return respond("Transcription unavailable",502);
  const data=await result.json();
  return Response.json({transcript:data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""},{headers:{"Cache-Control":"no-store"}});
});