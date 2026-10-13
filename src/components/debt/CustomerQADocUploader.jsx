/**
 * CustomerQADocUploader.jsx — Upload a document (PDF/TXT/DOC) holding many
 * questions and answers into the Customer Q&A section of the KB.
 * Uses kbExtractFile to extract Q&A pairs, then saves each with the
 * debt_customer category. Includes a "Priority Answers" checkbox — when
 * checked, answers for questions already in the KB are prepended and starred
 * so they become the first answer surfaced in Q&A lookups.
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { computeFileHash, checkDuplicateHash } from '@/lib/fileDedup';
import { saveQAWithPriority } from '@/lib/kbPriority';

const DARK = '#0a0f1e';
const ORANGE = '#f59e0b';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

export default function CustomerQADocUploader({ category, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [priority, setPriority] = useState(false);
  const [extractedEntries, setExtractedEntries] = useState([]);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [fileHash, setFileHash] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStatus('Checking for duplicates…');
    const hash = await computeFileHash(file);
    const dup = await checkDuplicateHash(hash);
    if (dup.isDuplicate) {
      setError(
        `This file was already uploaded on ${new Date(dup.firstUploadDate).toLocaleDateString()} — ${dup.count} entries exist from it. Skipping to avoid duplication.`
      );
      return;
    }
    setFileHash(hash);
    setUploading(true);
    setError('');
    setExtractedEntries([]);
    setSelectedEntries(new Set());
    setStatus(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)…`);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setStatus('Extracting Q&A from document (this may take a minute)…');
      const result = await base44.functions.invoke('kbExtractFile', {
        fileName: file.name,
        fileType: file.type,
        file_url,
        kbName: 'Debt Settlement',
      });
      const entries = (result?.entries || result?.data?.entries || []).filter(
        (e) => e.question && e.answer && e.category !== 'raw_chunk'
      );
      setExtractedEntries(entries);
      setSelectedEntries(new Set(entries.map((_, i) => i)));
      setStatus(`${entries.length} Q&A pairs extracted. Review and save below.`);
    } catch (e) {
      setError('Failed: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  const saveSelected = async () => {
    setSaving(true);
    const toSave = extractedEntries.filter((_, i) => selectedEntries.has(i));
    let merged = 0;
    let created = 0;
    for (const e of toSave) {
      try {
        const res = await saveQAWithPriority({
          question: e.question,
          answers: [e.answer],
          category,
          priority,
          source: 'document_upload',
          tags: `file_hash:${fileHash}`,
        });
        if (res?.merged) merged++;
        else created++;
      } catch (err) {
        console.warn('Failed to save Q&A:', err?.message || err);
      }
    }
    setStatus(
      `✓ Saved ${toSave.length} entries — ${created} new, ${merged} merged into existing questions${priority ? ' (priority)' : ''}.`
    );
    setExtractedEntries([]);
    setSelectedEntries(new Set());
    onSaved();
    setSaving(false);
    setTimeout(() => setStatus(''), 6000);
  };

  return (
    <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
      <div style={{ color: ORANGE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
        📄 Upload Q&A Document
      </div>
      <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '16px' }}>
        Upload a PDF, TXT, or DOC that holds many questions and answers. AI extracts each Q&A pair and saves it to Customer Q&A. Enable Priority Answers to push new answers ahead of existing ones for matching questions.
      </div>

      {/* Priority checkbox */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={priority}
          onChange={(e) => setPriority(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: ORANGE }}
        />
        <span style={{ color: priority ? ORANGE : '#8a9ab8', fontSize: '12px', fontWeight: 'bold' }}>
          ⭐ Priority Answers
        </span>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>
          — new answers become the first answer for questions already in the KB
        </span>
      </label>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          background: uploading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
          color: uploading ? '#6b7280' : DARK,
          border: 'none',
          borderRadius: '4px',
          padding: '12px 24px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          fontWeight: 'bold',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        {uploading ? '⏳ Processing…' : '📁 Upload Q&A Document'}
      </button>

      {status && <div style={{ color: ORANGE, fontSize: '12px', marginTop: '10px' }}>{status}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '10px' }}>⚠ {error}</div>}

      {extractedEntries.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: ORANGE, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Extracted Q&A ({extractedEntries.length})
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setSelectedEntries(new Set(extractedEntries.map((_, i) => i)))}
                style={{ background: 'none', border: 'none', color: '#8a9ab8', cursor: 'pointer', fontSize: '10px' }}
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedEntries(new Set())}
                style={{ background: 'none', border: 'none', color: '#8a9ab8', cursor: 'pointer', fontSize: '10px' }}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {extractedEntries.map((entry, i) => (
              <div
                key={i}
                style={{
                  background: selectedEntries.has(i) ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selectedEntries.has(i) ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '4px',
                  padding: '10px',
                  marginBottom: '6px',
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedEntries.has(i)}
                  onChange={() =>
                    setSelectedEntries((prev) => {
                      const n = new Set(prev);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                  style={{ cursor: 'pointer', accentColor: ORANGE, marginTop: '3px' }}
                />
                <div>
                  <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{entry.question}</div>
                  <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.5 }}>{entry.answer}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveSelected}
            disabled={saving || selectedEntries.size === 0}
            style={{
              marginTop: '8px',
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              color: DARK,
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              opacity: saving || selectedEntries.size === 0 ? 0.5 : 1,
            }}
          >
            💾 Save {selectedEntries.size} Q&A {priority ? 'with Priority' : ''}
          </button>
        </div>
      )}
    </div>
  );
}