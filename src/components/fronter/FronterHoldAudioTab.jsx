/**
 * FronterHoldAudioTab.jsx — Admin controls for the merge hold-message audio.
 * Upload an MP3 or WAV file; the active file is played to the customer when
 * a fronter presses Merge. Replacing the file deactivates the previous one.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import FronterHoldAudioRecorder from './FronterHoldAudioRecorder';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

export default function FronterHoldAudioTab({ adminUsername }) {
  const [activeAudio, setActiveAudio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const all = await base44.entities.FronterHoldAudio.filter({ isActive: true }, '-uploadedAt', 1);
      const current = all?.[0] || null;
      setActiveAudio(current);
      // Create a signed URL for preview
      if (current?.fileUri) {
        try {
          const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: current.fileUri, expires_in: 300 });
          setPreviewUrl(signed?.signed_url || '');
        } catch { setPreviewUrl(''); }
      } else {
        setPreviewUrl('');
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'mp3' && ext !== 'wav') {
      setStatus('✗ Only MP3 and WAV files are accepted');
      setTimeout(() => setStatus(''), 5000);
      return;
    }
    setUploading(true);
    setStatus('Uploading audio file…');
    try {
      // Upload to private storage
      const upRes = await base44.integrations.Core.UploadPrivateFile({ file });
      const fileUri = upRes?.file_uri;
      if (!fileUri) throw new Error('Upload failed');

      setStatus('Saving hold audio…');
      // Deactivate previous active record(s)
      const existing = await base44.entities.FronterHoldAudio.filter({ isActive: true });
      if (existing?.length > 0) {
        await base44.entities.FronterHoldAudio.updateMany(
          { isActive: true },
          { $set: { isActive: false } }
        );
      }
      // Create new active record
      await base44.entities.FronterHoldAudio.create({
        fileName: file.name,
        fileType: ext,
        fileUri,
        uploadedBy: adminUsername,
        uploadedAt: new Date().toISOString(),
        isActive: true,
      });

      setStatus(`✓ "${file.name}" is now the active hold audio`);
      setTimeout(() => setStatus(''), 5000);
      load();
    } catch (e) {
      setStatus('✗ Error: ' + (e?.message || String(e)));
      setTimeout(() => setStatus(''), 8000);
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!activeAudio) return;
    if (!confirm(`Remove "${activeAudio.fileName}" as the hold audio? Merge will revert to no hold message.`)) return;
    try {
      await base44.entities.FronterHoldAudio.delete(activeAudio.id);
      setStatus('✓ Hold audio removed');
      setTimeout(() => setStatus(''), 4000);
      load();
    } catch (e) {
      setStatus('✗ Error: ' + (e?.message || String(e)));
      setTimeout(() => setStatus(''), 6000);
    }
  };

  if (loading) return <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Loading…</div>;

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🔊 Merge Hold Audio</div>

      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '14px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
        When a fronter presses <strong style={{ color: GOLD }}>Merge</strong>, the customer hears this audio while the agent is being connected.
        Upload an MP3 or WAV file below. The most recently uploaded file becomes the active hold audio.
      </div>

      {/* Upload button */}
      <input ref={fileRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 22px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: uploading ? 0.6 : 1, marginBottom: '14px' }}
      >
        {uploading ? '⏳ Uploading…' : '📁 Upload Hold Audio'}
      </button>

      {status && (
        <div style={{ padding: '8px 12px', marginBottom: '14px', background: status.startsWith('✓') ? 'rgba(16,185,129,0.08)' : status.startsWith('✗') ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.06)', border: `1px solid ${status.startsWith('✓') ? 'rgba(16,185,129,0.2)' : status.startsWith('✗') ? 'rgba(239,68,68,0.2)' : 'rgba(96,165,250,0.2)'}`, borderRadius: '4px', color: status.startsWith('✓') ? GOLD : status.startsWith('✗') ? RED : BLUE, fontSize: '11px' }}>
          {status}
        </div>
      )}

      {/* Recording Studio */}
      <FronterHoldAudioRecorder onRecorded={handleUpload} />

      {/* Current active audio */}
      {activeAudio ? (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>✓ Active Hold Audio</div>
            <button onClick={handleDelete} style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✕ Remove</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={ls}>File Name</label>
              <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{activeAudio.fileName}</div>
            </div>
            <div>
              <label style={ls}>Type</label>
              <div style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{activeAudio.fileType}</div>
            </div>
            <div>
              <label style={ls}>Uploaded By</label>
              <div style={{ color: '#c4cdd8', fontSize: '12px' }}>{activeAudio.uploadedBy}</div>
            </div>
            <div>
              <label style={ls}>Uploaded At</label>
              <div style={{ color: '#c4cdd8', fontSize: '12px' }}>{activeAudio.uploadedAt ? new Date(activeAudio.uploadedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div>
            </div>
          </div>
          {previewUrl && (
            <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <label style={ls}>Preview</label>
              <audio controls src={previewUrl} style={{ width: '100%', height: '36px' }} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '30px', textAlign: 'center' }}>
          <div style={{ color: '#4a5568', fontSize: '13px' }}>No hold audio configured yet. Upload an MP3 or WAV file above.</div>
        </div>
      )}
    </div>
  );
}