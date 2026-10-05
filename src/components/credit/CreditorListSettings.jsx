/**
 * CreditorListSettings.jsx — Manage accepted and non-accepted creditor lists.
 * Upload a photo of each list (AI extracts creditor names) or add/remove individual entries.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' };
const inp = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', fontFamily: 'Georgia, serif' };

export default function CreditorListSettings() {
  const [accepted, setAccepted] = useState([]);
  const [nonAccepted, setNonAccepted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAccepted, setNewAccepted] = useState('');
  const [newNonAccepted, setNewNonAccepted] = useState('');
  const [uploadingTo, setUploadingTo] = useState(null); // 'accepted' | 'non_accepted' | null
  const acceptedFileRef = useRef(null);
  const nonAcceptedFileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.CreditorListEntry.list('-created_date', 2000);
      setAccepted((all || []).filter(e => e.listType === 'accepted'));
      setNonAccepted((all || []).filter(e => e.listType === 'non_accepted'));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCreditor = async (listType, name) => {
    if (!name.trim()) return;
    try {
      await base44.entities.CreditorListEntry.create({ creditorName: name.trim(), listType });
      if (listType === 'accepted') setNewAccepted(''); else setNewNonAccepted('');
      load();
    } catch (e) { alert('Add failed: ' + (e?.message || String(e))); }
  };

  const removeCreditor = async (id) => {
    await base44.entities.CreditorListEntry.delete(id);
    load();
  };

  const handleUpload = async (listType, file) => {
    if (!file) return;
    setUploadingTo(listType);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract every creditor name, account type, or financial institution name from this image. Return a JSON array of strings — just the names, no balances or extra data.`,
        file_urls: [signed_url],
        response_json_schema: {
          type: 'object',
          properties: {
            creditors: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      const names = (res?.creditors || []).filter(Boolean);
      if (names.length === 0) { alert('No creditor names found in the image.'); setUploadingTo(null); return; }
      // Bulk create, skip duplicates
      const existing = listType === 'accepted' ? accepted : nonAccepted;
      const existingNames = existing.map(e => e.creditorName.toLowerCase());
      const toCreate = names.filter(n => !existingNames.includes(n.toLowerCase())).map(n => ({ creditorName: n, listType }));
      if (toCreate.length > 0) await base44.entities.CreditorListEntry.bulkCreate(toCreate);
      load();
    } catch (e) {
      alert('Upload failed: ' + (e?.message || String(e)));
    }
    setUploadingTo(null);
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#e8e0d0', fontSize: '20px', margin: '4px 0' }}>⚙️ Creditor List Settings</h2>
        <p style={{ color: '#6b7280', fontSize: '13px' }}>Manage the accepted and non-accepted creditor lists. Upload a photo of a list to auto-populate, or add/remove individual creditors.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Accepted Creditors */}
        <CreditorListSection
          title="✅ Accepted Creditors"
          color="#4ade80"
          entries={accepted}
          loading={loading}
          uploading={uploadingTo === 'accepted'}
          fileRef={acceptedFileRef}
          onUpload={(f) => handleUpload('accepted', f)}
          newValue={newAccepted}
          onNewValueChange={setNewAccepted}
          onAdd={() => addCreditor('accepted', newAccepted)}
          onRemove={removeCreditor}
        />

        {/* Non-Accepted Creditors */}
        <CreditorListSection
          title="❌ Non-Accepted Creditors"
          color="#ef4444"
          entries={nonAccepted}
          loading={loading}
          uploading={uploadingTo === 'non_accepted'}
          fileRef={nonAcceptedFileRef}
          onUpload={(f) => handleUpload('non_accepted', f)}
          newValue={newNonAccepted}
          onNewValueChange={setNewNonAccepted}
          onAdd={() => addCreditor('non_accepted', newNonAccepted)}
          onRemove={removeCreditor}
        />
      </div>
    </div>
  );
}

function CreditorListSection({ title, color, entries, loading, uploading, fileRef, onUpload, newValue, onNewValueChange, onAdd, onRemove }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${color}33`, borderRadius: '8px', padding: '16px' }}>
      <div style={{ color, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>{title} ({entries.length})</div>

      {/* Upload photo */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '10px', background: `${color}11`, color, border: `1px dashed ${color}44`, borderRadius: '8px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        {uploading ? '⏳ Extracting…' : '📸 Upload Photo of List'}
      </button>

      {/* Add single */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <input value={newValue} onChange={e => onNewValueChange(e.target.value)} placeholder="Add a creditor…" style={{ ...inp, fontSize: '13px', padding: '10px 12px' }} onKeyDown={e => { if (e.key === 'Enter') onAdd(); }} />
        <button onClick={onAdd} disabled={!newValue.trim()} style={{ background: color, color: DARK, border: 'none', borderRadius: '8px', padding: '0 14px', cursor: newValue.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>+ Add</button>
      </div>

      {/* List */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {loading ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>Loading…</div> :
         entries.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No creditors yet. Upload a photo or add manually.</div> :
         entries.map(e => (
           <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', marginBottom: '4px' }}>
             <span style={{ color: '#c4cdd8', fontSize: '13px' }}>{e.creditorName}</span>
             <button onClick={() => onRemove(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>✕</button>
           </div>
         ))}
      </div>
    </div>
  );
}