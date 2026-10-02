/**
 * LogPage.jsx — Paste debug logs from any computer so they can be reviewed.
 * Saved logs are stored in the DebugLog entity and listed below the paste area.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function LogPage() {
  const [title, setTitle] = useState('');
  const [sourceComputer, setSourceComputer] = useState('');
  const [category, setCategory] = useState('general');
  const [logText, setLogText] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [fileUri, setFileUri] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.DebugLog.list('-created_date', 100);
      setLogs(all || []);
    } catch (e) { console.error('load logs failed', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!logText.trim()) return;
    setSaving(true);
    try {
      await base44.entities.DebugLog.create({
        title: title.trim() || (fileName || `Log ${new Date().toLocaleString()}`),
        logText,
        sourceComputer: sourceComputer.trim(),
        category,
        fileUri: fileUri || undefined,
        fileName: fileName || undefined,
      });
      setLogText(''); setTitle(''); setSourceComputer(''); setCategory('general'); setFileUri(''); setFileName('');
      setSavedMsg('✓ Log saved');
      setTimeout(() => setSavedMsg(''), 3000);
      load();
    } catch (e) {
      setSavedMsg('⚠ Save failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this log?')) return;
    await base44.entities.DebugLog.delete(id);
    if (viewing?.id === id) setViewing(null);
    load();
  };

  const copyLog = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setSavedMsg('✓ Copied to clipboard');
      setTimeout(() => setSavedMsg(''), 2000);
    });
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setFileUri(file_uri);
      setFileName(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
      // Load a preview (first 8000 chars) into the textarea; the full file is attached for download.
      const text = await file.text();
      const preview = text.length > 8000
        ? text.slice(0, 8000) + `\n…[truncated — ${text.length.toLocaleString()} chars total, full file attached as download]`
        : text;
      setLogText(preview);
      setSavedMsg('✓ File attached — preview loaded');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e) {
      setSavedMsg('⚠ Upload failed: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  const downloadLog = async (l) => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: l.fileUri });
      window.open(signed_url, '_blank');
    } catch (e) {
      setSavedMsg('⚠ Download failed: ' + (e?.message || String(e)));
      setTimeout(() => setSavedMsg(''), 3000);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: DARK, padding: '24px', fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: GOLD, fontSize: '22px', fontWeight: 'bold' }}>📋 Debug Log Drop</div>
          <div style={{ color: '#8a9ab8', fontSize: '13px', marginTop: '4px' }}>Paste console logs, error text, or network output from any computer. Saved logs are stored so they can be reviewed here.</div>
        </div>

        {/* Paste area */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={ls}>Title (optional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. AI popup loop on call start" style={inp} />
            </div>
            <div>
              <label style={ls}>Source Computer</label>
              <input value={sourceComputer} onChange={e => setSourceComputer(e.target.value)} placeholder="e.g. Office-Desktop" style={inp} />
            </div>
            <div>
              <label style={ls}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                <option value="general">General</option>
                <option value="error">Error</option>
                <option value="console">Console</option>
                <option value="network">Network</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={ls}>Paste Log Text</label>
            <textarea
              value={logText}
              onChange={e => setLogText(e.target.value)}
              rows={12}
              placeholder="Paste your log output here… (Ctrl+V / Cmd+V)"
              style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={save} disabled={saving || !logText.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: saving || !logText.trim() ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving || !logText.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : '💾 Save Log'}
            </button>
            <button onClick={() => { setLogText(''); setTitle(''); setSourceComputer(''); setFileUri(''); setFileName(''); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 16px', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
            <input ref={fileRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: uploading ? 'rgba(255,255,255,0.05)' : `${GOLD}18`, color: uploading ? '#6b7280' : GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '10px 16px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '11px' }}>{uploading ? 'Uploading…' : '📄 Upload .txt'}</button>
            {fileName && <span style={{ color: GOLD, fontSize: '11px' }}>📎 {fileName}</span>}
            {savedMsg && <span style={{ color: savedMsg.startsWith('✓') ? GOLD : '#ef4444', fontSize: '12px' }}>{savedMsg}</span>}
          </div>
        </div>

        {/* Saved logs list */}
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>Saved Logs</div>
            <button onClick={load} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>↻ Refresh</button>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {loading ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0' }}>Loading…</div> :
             logs.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No logs saved yet. Paste one above.</div> :
             logs.map(l => (
              <div key={l.id} style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '1px 6px', borderRadius: '2px', background: `${GOLD}18`, color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{l.category || 'general'}</span>
                      <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{l.title || 'Untitled'}</span>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>
                      {new Date(l.created_date).toLocaleString()}{l.sourceComputer ? ` · from ${l.sourceComputer}` : ''} · {l.logText?.length || 0} chars
                    </div>
                    <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '6px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: viewing?.id === l.id ? '400px' : '60px', overflow: 'hidden', overflowY: viewing?.id === l.id ? 'auto' : 'hidden' }}>
                      {l.logText}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => setViewing(viewing?.id === l.id ? null : l)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>{viewing?.id === l.id ? 'Collapse' : 'Expand'}</button>
                    <button onClick={() => copyLog(l.logText)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Copy</button>
                    {l.fileUri && <button onClick={() => downloadLog(l)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Download</button>}
                    <button onClick={() => del(l.id)} style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}