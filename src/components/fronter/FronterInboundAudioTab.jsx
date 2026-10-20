/**
 * FronterInboundAudioTab.jsx — Admin controls for the two inbound call audio
 * assets (Prompt 5):
 *   Option 1: Inbound Call Initial Message — played when prospects first call in
 *             (Clip C in the greeting pipeline, after the name + regional clips).
 *   Option 2: Adam Transfer Queue Hold Message — played when Adam transfers the
 *             prospect into the live fronter queue (replaces standard hold music).
 *
 * Admins can record from the browser mic or upload pre-recorded .wav/.mp3 files.
 * Files are stored publicly so Twilio <Play> can fetch them.
 */
import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import FronterHoldAudioRecorder from './FronterHoldAudioRecorder';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

const ASSET_TYPES = [
  {
    key: 'inbound_initial_message',
    title: '📞 Inbound Call Initial Message',
    description: 'Played when prospects first call in, right after the personalized name greeting and regional phrase. This is Christopher\'s master intro / the "Inbound Call" hold message.',
  },
  {
    key: 'adam_transfer_hold',
    title: '🔄 Adam Transfer Queue Hold Message',
    description: 'Custom audio played when Adam transfers the prospect into the live fronter queue, replacing standard hold music. Fronters hear this while picking up.',
  },
];

function AssetManager({ assetType, adminUsername }) {
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  const meta = ASSET_TYPES.find(a => a.key === assetType);

  const load = async () => {
    try {
      const results = await base44.entities.InboundCallAudio.filter(
        { assetType, isActive: true }, '-uploadedAt', 1,
      );
      setActive(results?.[0] || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'mp3' && ext !== 'wav') {
      setStatus('✗ Only MP3 and WAV files are accepted');
      setTimeout(() => setStatus(''), 5000);
      return;
    }
    setUploading(true);
    setStatus('Uploading audio file…');
    try {
      const upRes = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = upRes?.file_url;
      if (!fileUrl) throw new Error('Upload failed');

      setStatus('Saving audio asset…');
      await base44.entities.InboundCallAudio.updateMany(
        { assetType, isActive: true },
        { $set: { isActive: false } },
      );
      await base44.entities.InboundCallAudio.create({
        assetType,
        fileName: file.name,
        fileType: ext,
        fileUrl,
        uploadedBy: adminUsername,
        uploadedAt: new Date().toISOString(),
        isActive: true,
      });
      setStatus(`✓ "${file.name}" is now the active ${meta.title}`);
      setTimeout(() => setStatus(''), 5000);
      load();
    } catch (e) {
      setStatus('✗ Error: ' + (e?.message || String(e)));
      setTimeout(() => setStatus(''), 8000);
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!confirm(`Remove "${active.fileName}"? The system will revert to the default for this asset.`)) return;
    try {
      await base44.entities.InboundCallAudio.delete(active.id);
      setStatus('✓ Audio asset removed');
      setTimeout(() => setStatus(''), 4000);
      load();
    } catch (e) {
      setStatus('✗ Error: ' + (e?.message || String(e)));
      setTimeout(() => setStatus(''), 6000);
    }
  };

  if (loading) return <div style={{ color: '#4a5568', padding: '20px' }}>Loading…</div>;

  return (
    <div style={{ background: '#0d1b2a', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
      <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>{meta.title}</div>
      <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, marginBottom: '14px' }}>{meta.description}</div>

      <input ref={fileRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 20px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: uploading ? 0.6 : 1, marginRight: '10px' }}
      >
        {uploading ? '⏳ Uploading…' : '📁 Upload Audio'}
      </button>

      {status && (
        <div style={{ marginTop: '10px', padding: '8px 12px', background: status.startsWith('✓') ? 'rgba(16,185,129,0.08)' : status.startsWith('✗') ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.06)', border: `1px solid ${status.startsWith('✓') ? 'rgba(16,185,129,0.2)' : status.startsWith('✗') ? 'rgba(239,68,68,0.2)' : 'rgba(96,165,250,0.2)'}`, borderRadius: '4px', color: status.startsWith('✓') ? GOLD : status.startsWith('✗') ? RED : BLUE, fontSize: '11px' }}>
          {status}
        </div>
      )}

      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <label style={{ ...ls, color: BLUE }}>🎙 Record from Microphone</label>
        <FronterHoldAudioRecorder onRecorded={handleUpload} />
      </div>

      {active ? (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>✓ Active Audio</div>
            <button onClick={handleDelete} style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✕ Remove</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={ls}>File Name</label>
              <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{active.fileName}</div>
            </div>
            <div>
              <label style={ls}>Uploaded By</label>
              <div style={{ color: '#c4cdd8', fontSize: '12px' }}>{active.uploadedBy} · {active.uploadedAt ? new Date(active.uploadedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div>
            </div>
          </div>
          <audio controls src={active.fileUrl} style={{ width: '100%', height: '36px' }} />
        </div>
      ) : (
        <div style={{ marginTop: '14px', padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
          <div style={{ color: '#4a5568', fontSize: '12px' }}>No audio configured. Upload or record above.</div>
        </div>
      )}
    </div>
  );
}

export default function FronterInboundAudioTab({ adminUsername }) {
  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🔊 Custom Hold Music & Inbound Audio</div>
      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
        Manage the two audio assets that play during inbound calls. The <strong style={{ color: GOLD }}>Inbound Call Initial Message</strong> plays after the personalized name greeting and regional phrase. The <strong style={{ color: GOLD }}>Adam Transfer Queue Hold Message</strong> replaces standard hold music when Adam transfers a prospect to the fronter queue. Record from your microphone or upload a .wav/.mp3 file.
      </div>
      {ASSET_TYPES.map(a => (
        <AssetManager key={a.key} assetType={a.key} adminUsername={adminUsername} />
      ))}
    </div>
  );
}