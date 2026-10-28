/**
 * BOB commercial content encryption, performed in the customer's browser.
 *
 * Implementation: PBKDF2(SHA-256, 310000 iterations, random per-org salt)
 * derives a NON-EXTRACTABLE AES-256-GCM key from the organization's passphrase.
 * A fresh 96-bit random IV is generated for every encrypted document/session.
 *
 * The passphrase and derived CryptoKey are NEVER sent to the BOB backend or
 * persisted to localStorage, sessionStorage, cookies or IndexedDB.
 *
 * SECURITY BOUNDARY: This protects content in persistent storage against
 * backend users without the passphrase. It cannot protect against malicious
 * JavaScript shipped later by the application operator, compromised customer
 * devices, passphrase sharing, or third-party AI vendors processing plaintext
 * sent for a live simulation. It does NOT constitute verified zero-knowledge.
 */
const te = new TextEncoder();
const td = new TextDecoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = input => Uint8Array.from(atob(input),c=>c.charCodeAt(0));
export const BOB_CRYPTO_VERSION = 1;
export const BOB_KDF_ITERATIONS = 310000;

export async function unlockOrganizationKey(passphrase, organizationSalt) {
  if (typeof passphrase !== 'string' || passphrase.length < 14) throw new Error('Use a passphrase at least 14 characters long.');
  if (!organizationSalt) throw new Error('This organization has not been initialized for encrypted storage.');
  const material = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt:unb64(organizationSalt),iterations:BOB_KDF_ITERATIONS,hash:'SHA-256'},
    material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']
  );
}
export function newOrganizationSalt(){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return b64(salt);
}
export async function encryptCustomerContent(key, value, organizationId){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const json=JSON.stringify(value);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(organizationId)},
    key,te.encode(json));
  return JSON.stringify({v:BOB_CRYPTO_VERSION,iv:b64(iv),ct:b64(new Uint8Array(encrypted))});
}
export async function decryptCustomerContent(key, payload, organizationId){
  const data=typeof payload==='string'?JSON.parse(payload):payload;
  if(data.v!==BOB_CRYPTO_VERSION || !data.iv || !data.ct)throw new Error('Unsupported encrypted data format.');
  try{
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(data.iv),additionalData:te.encode(organizationId)},
      key,unb64(data.ct));
    return JSON.parse(td.decode(plain));
  }catch{
    throw new Error('Cannot unlock this data. Check the organization passphrase and selected workspace.');
  }
}
export async function createKeyVerifier(key, organizationId){
  return encryptCustomerContent(key,{verification:'BOB-E2EE-V1'},organizationId);
}
export async function verifyOrganizationKey(key, verifier, organizationId){
  const result=await decryptCustomerContent(key,verifier,organizationId);
  if(result.verification!=='BOB-E2EE-V1')throw new Error('Incorrect organization passphrase.');
  return true;
}
