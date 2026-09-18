/**
 * DebtPitchTab.jsx — Browse and manage closer pitches.
 * Pitches are organized by closer name. File names from MP3 uploads become closer names.
 * Also includes a compact pitch reference for live calls.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const PITCH_TYPES = [
  { id: 'opener', label: '🎤 Opener', color: '#60a5fa' },
  { id: 'discovery', label: '🔍 Discovery', color: '#34d399' },
  { id: 'pitch', label: '📊 Pitch', color: '#a78bfa' },
  { id: 'rebuttal', label: '🛡️ Rebuttal', color: '#f59e0b' },
  { id: 'closer', label: '✅ Closer', color: '#f472b6' },
  { id: 'full_call', label: '📞 Full Call', color: '#6b7280' },
];

export default function DebtPitchTab() {
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCloser, setSelectedCloser] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ closerName: '', title: '', content: '', pitchType: 'pitch', tags: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef(null);

  const MAX_BYTES = 50 * 1024 * 1024;

  const handleUpload = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setUploadError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB.`); return; }
    setUploading(true); setUploadError(''); setUploadStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setUploadStatus('Transcribing audio…');
      let transcriptText;
      if (file.size > 25 * 1024 * 1024) {
        const res = await base44.functions.invoke('transcribeAudioLarge', { audio_url: file_url });
        transcriptText = res?.transcript || res?.data?.transcript || '';
      } else {
        transcriptText = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      }
      setUploadStatus('Extracting closer pitches…');
      const closerName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim();
      const pitchResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a sales pitch analyst. Below is a transcript of a real debt settlement call by a closer named "${closerName}". Extract the distinct pitches and techniques used, organized by type. For each, capture the actual language and approach the closer used.

Return JSON with a "pitches" array, each having: title (short label), content (the actual pitch language/approach), pitchType (one of: opener, discovery, pitch, rebuttal, closer, full_call).

Look for:
- OPENER: How they greet and transition from the transfer
- DISCOVERY: Questions they ask to qualify the prospect
- PITCH: How they explain the program and its benefits
- REBUTTAL: How they handle specific objections (bankruptcy, cost, credit impact, "think about it")
- CLOSER: The closing language and enrollment process

Aim for 3-8 distinct pitches. Base them on what the closer ACTUALLY said in the transcript.

TRANSCRIPT:
${transcriptText}`,
        response_json_schema: {
          type: 'object',
          properties: {
            pitches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  pitchType: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const pitches = pitchResult?.pitches || [];
      for (const p of pitches) {
        await base44.entities.CloserPitch.create({
          closerName,
          title: p.title || 'Untitled',
          content: p.content || '',
          pitchType: ['opener', 'discovery', 'pitch', 'rebuttal', 'closer', 'full_call'].includes(p.pitchType) ? p.pitchType : 'pitch',
          source: file.name,
          tags: 'mp3-extracted',
        });
      }
      setUploadStatus(`✓ ${pitches.length} pitches extracted for "${closerName}"!`);
      setSelectedCloser(closerName);
      load();
      setTimeout(() => setUploadStatus(''), 5000);
    } catch (e) {
      setUploadError('Upload failed: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.CloserPitch.list('-created_date', 500);
      setPitches(all || []);
      if (all?.length > 0 && !selectedCloser) {
        const closers = [...new Set(all.map(p => p.closerName))];
        setSelectedCloser(closers[0]);
      }
    } catch {}
    setLoading(false);
  }, [selectedCloser]);

  useEffect(() => { load(); }, [load]);

  const closers = [...new Set(pitches.map(p => p.closerName))].sort();
  const closerPitches = pitches.filter(p => p.closerName === selectedCloser);

  const save = async () => {
    if (!form.closerName.trim() || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await base44.entities.CloserPitch.create({ ...form, created_date: new Date().toISOString() });
      setForm({ closerName: '', title: '', content: '', pitchType: 'pitch', tags: '' });
      setShowAdd(false);
      load();
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this pitch?')) return;
    await base44.entities.CloserPitch.delete(id);
    load();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', alignItems: 'start' }}>
      {/* Closer list */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🎤 Closers</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/ogg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: uploading ? 'rgba(255,255,255,0.05)' : `${GOLD}18`, color: uploading ? '#6b7280' : GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '11px' }}>🎵 Upload MP3</button>
            <button onClick={() => setShowAdd(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>+ Add</button>
          </div>
        </div>
        {(uploadStatus || uploadError) && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {uploadStatus && <div style={{ color: GOLD, fontSize: '11px' }}>{uploadStatus}</div>}
            {uploadError && <div style={{ color: '#ef4444', fontSize: '11px' }}>⚠ {uploadError}</div>}
          </div>
        )}
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {loading ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0' }}>Loading…</div> :
           closers.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No closers yet. Upload MP3 call recordings (file name = closer name) or add manually.</div> :
           closers.map(c => {
             const count = pitches.filter(p => p.closerName === c).length;
             return (
               <button key={c} onClick={() => setSelectedCloser(c)} style={{ width: '100%', background: selectedCloser === c ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' }}>
                 <div style={{ color: selectedCloser === c ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: 'bold' }}>{c}</div>
                 <div style={{ color: '#6b7280', fontSize: '10px' }}>{count} pitch{count !== 1 ? 'es' : ''}</div>
               </button>
             );
           })}
        </div>
      </div>

      {/* Pitch detail */}
      <div>
        {showAdd && (
          <div style={{ marginBottom: '16px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '20px' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>+ Add Pitch Manually</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div><label style={ls}>Closer Name</label><input value={form.closerName} onChange={e => setForm(p => ({ ...p, closerName: e.target.value }))} placeholder="e.g. Marcus, Sarah, Transfer-John" style={inp} /></div>
              <div><label style={ls}>Pitch Title / Topic</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Opener — Transferred Call" style={inp} /></div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={ls}>Pitch Type</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PITCH_TYPES.map(t => (
                  <button key={t.id} onClick={() => setForm(p => ({ ...p, pitchType: t.id }))} style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${form.pitchType === t.id ? t.color + '66' : 'rgba(255,255,255,0.1)'}`, background: form.pitchType === t.id ? `${t.color}18` : 'transparent', color: form.pitchType === t.id ? t.color : '#6b7280', cursor: 'pointer', fontSize: '11px' }}>{t.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}><label style={ls}>Pitch Content</label><textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={6} style={{ ...inp, resize: 'vertical' }} placeholder="The script, talking points, or pitch language…" /></div>
            <div style={{ marginBottom: '12px' }}><label style={ls}>Tags (optional)</label><input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="opener, bankruptcy objection, chase" style={inp} /></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1 }}>💾 Save Pitch</button>
              <button onClick={() => setShowAdd(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 16px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
            </div>
          </div>
        )}

        {!selectedCloser ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '80px 0', fontSize: '13px' }}>Select a closer to view their pitches.</div>
        ) : (
          <div>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
              {selectedCloser} — {closerPitches.length} Pitch{closerPitches.length !== 1 ? 'es' : ''}
            </div>
            {closerPitches.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No pitches saved for this closer yet. Upload an MP3 recording (file name = closer name) to auto-extract pitches.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {closerPitches.map(p => {
                  const pt = PITCH_TYPES.find(t => t.id === p.pitchType) || PITCH_TYPES.find(t => t.id === 'pitch');
                  return (
                    <div key={p.id} style={{ background: '#0d1b2a', border: `1px solid ${pt.color}22`, borderRadius: '6px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${pt.color}18`, color: pt.color, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{pt.label}</span>
                          <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginLeft: '8px' }}>{p.title}</span>
                        </div>
                        <button onClick={() => del(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                      </div>
                      <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{p.content}</div>
                      {p.tags && <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '8px' }}>Tags: {p.tags}</div>}
                      {p.source && <div style={{ color: '#4a5568', fontSize: '10px' }}>Source: {p.source}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compact pitch panel for live calls ──────────────────────────────────────
export function DebtPitchPanel({ closerName }) {
  const [pitches, setPitches] = useState([]);
  const [allClosers, setAllClosers] = useState([]);
  const [selected, setSelected] = useState(closerName || '');
  const [activePitch, setActivePitch] = useState(null);

  useEffect(() => {
    base44.entities.CloserPitch.list('-created_date', 500)
      .then(all => {
        setPitches(all || []);
        setAllClosers([...new Set((all || []).map(p => p.closerName))].sort());
        if (!selected && all?.length > 0) setSelected(closerName || all[0].closerName);
      })
      .catch(() => {});
  }, [closerName]);

  const closerPitches = pitches.filter(p => p.closerName === selected);

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>🎤 Closer Pitches</div>
        {allClosers.length > 0 ? (
          <select value={selected} onChange={e => { setSelected(e.target.value); setActivePitch(null); }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
            {allClosers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <div style={{ color: '#4a5568', fontSize: '11px' }}>No pitches yet. Upload MP3 recordings in the KB tab.</div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
        {closerPitches.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No pitches for this closer.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {closerPitches.map(p => {
              const pt = PITCH_TYPES.find(t => t.id === p.pitchType) || PITCH_TYPES.find(t => t.id === 'pitch');
              const isActive = activePitch?.id === p.id;
              return (
                <div key={p.id} style={{ background: isActive ? `${pt.color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? pt.color + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', overflow: 'hidden' }}>
                  <button onClick={() => setActivePitch(isActive ? null : p)} style={{ width: '100%', background: 'none', border: 'none', padding: '8px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ padding: '1px 6px', borderRadius: '2px', background: `${pt.color}18`, color: pt.color, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{pt.label.replace(/^\S+\s/, '')}</span>
                    <span style={{ color: '#c4cdd8', fontSize: '12px', fontWeight: 'bold', flex: 1 }}>{p.title}</span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>{isActive ? '−' : '+'}</span>
                  </button>
                  {isActive && (
                    <div style={{ padding: '0 12px 10px', color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{p.content}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}