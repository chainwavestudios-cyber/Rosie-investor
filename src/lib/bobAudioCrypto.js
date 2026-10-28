/**
 * Browser-only encryption for session recordings. Never upload raw audio:
 * ciphertext produced by AES-256-GCM is stored in a private Base44 file.
 */
const encode=new TextEncoder();
export const b64bytes=b=>btoa(String.fromCharCode(...b));
export const decodeB64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function sealRecording(key,blob,organizationId){
  if(!key||!blob?.size)throw new Error('Recording cannot be secured without an unlocked customer vault.');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode(organizationId)},
    key,await blob.arrayBuffer());
  return {file:new File([sealed],'encrypted-bob-training-'+Date.now()+'.bin',{type:'application/octet-stream'}),
   iv:b64bytes(iv)};
}
export async function openRecording(key,encryptedBytes,iv,organizationId){
  const audio=await crypto.subtle.decrypt({name:'AES-GCM',iv:decodeB64(iv),
    additionalData:encode.encode(organizationId)},key,encryptedBytes);
  return new Blob([audio],{type:'audio/webm'});
}
