import { useEffect, useRef, useState } from 'react';
import { BookLock, FileUp, Lock, Trash2, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BOBAddonSelection, BOB_ADDON_OPTIONS } from './BobAddonSelection';
import { textFromFile } from './BobVault';
import { encryptCustomerContent, decryptCustomerContent } from '@/lib/bobKnowledgeCrypto';
import './BobSite.css';

export default function BobAddonsPanel({org,api,vaultKey,canManage,onNotice}){
 const [requested,setRequested]=useState(org.requestedAddons||[]),[selected,setSelected]=useState('live_qa'),
  [docs,setDocs]=useState([]),[decoded,setDecoded]=useState([]),[newDoc,setNewDoc]=useState({title:'',content:''}),
  [error,setError]=useState(''),[busy,setBusy]=useState(false),[importBusy,setImportBusy]=useState(false);
 const fileRef=useRef(null);
 useEffect(()=>{setRequested(org.requestedAddons||[]);},[org.id,JSON.stringify(org.requestedAddons||[])]);
 const productId=org.id+'::'+selected;
 const load=async()=>{
   if(!vaultKey){setDocs([]);setDecoded([]);return;}
   const res=await api('addonKnowledge',{organizationId:org.id,product:selected});
   setDocs(res.documents||[]);
 };
 useEffect(()=>{load().catch(e=>setError(e.message));},[org.id,selected,vaultKey]);
 useEffect(()=>{
   let valid=true;
   if(!vaultKey){setDecoded([]);return;}
   Promise.all(docs.map(async d=>{
     try{
       const value=await decryptCustomerContent(vaultKey,d.encryptedPayload,productId);
       return {...value,id:d.id};
     }catch{return{id:d.id,title:'Encrypted entry (could not decrypt)',content:'Unable to unlock'};}
   })).then(rows=>{if(valid)setDecoded(rows);}).catch(e=>{if(valid)setError(e.message);});
   return()=>{valid=false;};
 },[docs,vaultKey,productId]);
 const saveInterest=async()=>{
   setBusy(true);setError('');
   try{
     const r=await api('requestAddons',{organizationId:org.id,requestedAddons:requested});
     onNotice?.(r.message||'Product interest saved for commercial follow-up.');
   }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const saveKnowledge=async(e)=>{
   e.preventDefault();if(!vaultKey)return;
   setBusy(true);setError('');
   try{
     const encryptedPayload=await encryptCustomerContent(vaultKey,newDoc,productId);
     await api('addAddonKnowledge',{organizationId:org.id,product:selected,encryptedPayload});
     setNewDoc({title:'',content:''});await load();
     onNotice?.('Encrypted draft knowledge stored for this organization and product.');
   }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const remove=async(id)=>{
   if(!window.confirm('Remove this encrypted add-on knowledge entry?'))return;
   setBusy(true);setError('');
   try{await api('deleteAddonKnowledge',{organizationId:org.id,product:selected,documentId:id});await load();}
   catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const importFile=async(e)=>{
   const file=e.target.files?.[0];if(!file)return;
   setImportBusy(true);setError('');
   try{
     const content=await textFromFile(file);
     if(!content||content.trim().length<10)throw new Error('No readable text found. Import a text-based PDF or document.');
     setNewDoc({title:file.name,content:content.slice(0,24000)});
   }catch(e){setError(e.message);}finally{setImportBusy(false);e.target.value='';}
 };
 return <div className="bob-stack">
   <section className="bob-panel"><div className="bob-eyebrow">Optional commercial products</div>
     <h2 style={{margin:'9px 0 11px',fontSize:26,letterSpacing:'-.04em'}}>Expand beyond simulated training.</h2>
     <p>Live Q&A and Live Coach are separate products for call-center deployment. They are being developed for commercial licensing; registering interest does not enable or charge for either product. <Link to="/bob/live-products" style={{color:'#d7b978'}}>Learn about both products</Link>.</p>
     <BobAddonSelection compact value={requested} disabled={!canManage} onChange={setRequested}/>
     {canManage&&<button style={{marginTop:16}} className="bob-btn bob-btn-gold" disabled={busy} onClick={saveInterest}><Save size={14}/> Save product interests</button>}
     {requested.length>0&&<p className="bob-tiny" style={{marginTop:14}}>Requested: {requested.map(id=>BOB_ADDON_OPTIONS.find(x=>x.id===id)?.name||id).join(' and ')}. Commercial availability and separate pricing will be discussed with your organization.</p>}
   </section>
   <section className="bob-panel"><div className="bob-panel-title"><h3>Separated organization knowledge libraries</h3><span className="bob-pill">Encrypted drafts · not connected to a live service</span></div>
     <p className="bob-tiny">Each product's draft knowledge lives in a different tenant-scoped collection partition. A different authenticated encryption context also binds ciphertext to that product, preventing a Live Q&A document from being decrypted as Live Coach or BOB training material. No content is used by the separate services until those products are completed and explicitly activated.</p>
     <div className="bob-tabbar">{BOB_ADDON_OPTIONS.map(p=><button type="button" key={p.id} className={selected===p.id?'active':''} onClick={()=>setSelected(p.id)}><p.Icon size={15}/>{p.name}</button>)}</div>
     {error&&<p className="bob-message error">{error}</p>}
     {!vaultKey?<div className="bob-empty"><BookLock size={27} color="#d7b978"/> Unlock the organization vault in the Training Room or Knowledge Base before preparing this encrypted product library.</div>:
     <div className="bob-grid-2">
       <form onSubmit={saveKnowledge} className="bob-panel" style={{background:'#0c1927'}}>
         <div className="bob-panel-title"><h3>{BOB_ADDON_OPTIONS.find(p=>p.id===selected)?.name} knowledge draft</h3><Lock size={16} color="#d7b978"/></div>
         <div className="bob-field"><label>Document name</label><input required maxLength={150} value={newDoc.title} onChange={e=>setNewDoc(s=>({...s,title:e.target.value}))}/></div>
         <div className="bob-field"><label>Text for this product only</label><textarea required minLength={10} maxLength={24000} style={{minHeight:180}} value={newDoc.content} onChange={e=>setNewDoc(s=>({...s,content:e.target.value}))}/></div>
         <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" hidden onChange={importFile}/>
         <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
           <button type="button" disabled={importBusy||!canManage} className="bob-btn bob-btn-ghost" onClick={()=>fileRef.current?.click()}><FileUp size={14}/>{importBusy?'Reading locally…':'Import file locally'}</button>
           <button type="submit" disabled={busy||!canManage} className="bob-btn bob-btn-gold"><Lock size={13}/> Encrypt & save draft</button>
         </div>
         <p className="bob-tiny">Extracts text in your browser; stores ciphertext only. This is draft data and is not forwarded to a live agent product.</p>
       </form>
       <div className="bob-panel" style={{background:'#0c1927'}}><div className="bob-panel-title"><h3>Private {selected==='live_qa'?'Q&A':'Live Coach'} library · {decoded.length}</h3></div>
         {decoded.length===0?<div className="bob-empty">No encrypted documents have been added for this product.</div>:
         decoded.map(d=><div key={d.id} style={{borderBottom:'1px solid #ffffff19',padding:'12px 0'}}>
           <div style={{display:'flex',justifyContent:'space-between',gap:7}}><strong style={{fontSize:13}}>{d.title}</strong>{canManage&&<button type="button" className="bob-btn bob-btn-danger" disabled={busy} onClick={()=>remove(d.id)}><Trash2 size={13}/></button>}</div>
           <p style={{whiteSpace:'pre-wrap',maxHeight:110,overflowY:'auto'}}>{d.content}</p>
         </div>)}
       </div>
     </div>}
   </section>
 </div>;
}
