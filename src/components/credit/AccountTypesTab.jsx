/**
 * AccountTypesTab.jsx — Upload a CRM screenshot of added accounts, cross-reference
 * against the accepted creditors list. Green check = accepted, red X = not accepted.
 * Enter lead ID# to update the lead's debt ledger (accepted) and non-accepted creditors.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' };
const inp = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '14px 16px', color: '#e8e0d0', fontSize: '16px', outline: 'none', fontFamily: 'Georgia, serif' };

export default function AccountTypesTab() {
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [leadNumber, setLeadNumber] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [lead, setLead] = useState(null);
  const [acceptedList, setAcceptedList] = useState([]);
  const [nonAcceptedList, setNonAcceptedList] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    base44.entities.CreditorListEntry.list('-created_date', 1000)
      .then(all => {
        setAcceptedList((all || []).filter(e => e.listType === 'accepted'));
        setNonAcceptedList((all || []).filter(e => e.listType === 'non_accepted'));
      })
      .catch(() => {});
  }, []);

  const handlePhoto = useCallback((file) => {
    if (!file) return;
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    setError('');
    setResults(null);
  }, []);

  const submit = useCallback(async () => {
    if (!photo) { setError('Please upload a screenshot from the CRM first.'); return; }
    if (!leadNumber.trim()) { setError('Please enter the lead ID #.'); return; }
    if (acceptedList.length === 0) { setError('No accepted creditors in the list yet. Go to Settings to add them.'); return; }

    setStatus('uploading');
    setError('');

    try {
      // 1. Find the lead
      const leads = await base44.entities.DebtLead.filter({ leadNumber: leadNumber.trim() }, '-created_date', 5);
      const matchedLead = leads && leads[0];
      if (!matchedLead) { setError(`No lead found with # ${leadNumber.trim()}.`); setStatus('idle'); return; }
      setLead(matchedLead);

      // 2. Upload photo privately
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: photo });

      // 3. Get signed URL for AI
      setStatus('analyzing');
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });

      // 4. AI: extract creditor names from the photo and classify each
      const acceptedNames = acceptedList.map(e => e.creditorName);
      const nonAcceptedNames = nonAcceptedList.map(e => e.creditorName);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a screenshot from a CRM showing a list of added accounts/creditors. Extract every creditor or account name visible in the image.

Then classify each extracted creditor as either "accepted" or "not_accepted" based on these lists:

ACCEPTED creditors (match these names or close variations):
${acceptedNames.join(', ')}

NON-ACCEPTED creditors (match these names or close variations):
${nonAcceptedNames.join(', ')}

For each extracted creditor, check if it matches any name in the accepted list or the non-accepted list. Use fuzzy matching — "Chase Sapphire" matches "Chase", "Capital One" matches "Capital One Bank", etc. If a creditor is not in either list, default to "not_accepted".

Return JSON with two arrays: acceptedCreditors and nonAcceptedCreditors. Each entry should have: creditor (name), balance (number if visible, else null), accountLast4 (string if visible, else null).`,
        file_urls: [signed_url],
        response_json_schema: {
          type: 'object',
          properties: {
            acceptedCreditors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  creditor: { type: 'string' },
                  balance: { type: 'number' },
                  accountLast4: { type: 'string' },
                },
              },
            },
            nonAcceptedCreditors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  creditor: { type: 'string' },
                  balance: { type: 'number' },
                  accountLast4: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const accepted = res?.acceptedCreditors || [];
      const nonAccepted = res?.nonAcceptedCreditors || [];

      // 5. Update the lead
      setStatus('saving');
      const existingLedger = (() => { try { return JSON.parse(matchedLead.debtLedgerJson || '[]'); } catch { return []; } })();
      const existingNonAccepted = (() => { try { return JSON.parse(matchedLead.nonAcceptedCreditorsJson || '[]'); } catch { return []; } })();

      // Merge: add new accepted creditors to the ledger (skip duplicates by name)
      const existingNames = existingLedger.map(c => (c.creditor || '').toLowerCase());
      const newAccepted = accepted.filter(c => c.creditor && !existingNames.includes(c.creditor.toLowerCase()));
      const mergedLedger = [...existingLedger, ...newAccepted.map(c => ({
        creditor: c.creditor,
        balance: c.balance || null,
        interestRate: null,
        monthlyPayment: null,
        paymentSchedule: 'monthly',
        accountLast4: c.accountLast4 || '',
        notes: '',
      }))];

      // Merge non-accepted
      const existingNonNames = existingNonAccepted.map(c => (c.creditor || '').toLowerCase());
      const newNonAccepted = nonAccepted.filter(c => c.creditor && !existingNonNames.includes(c.creditor.toLowerCase()));
      const mergedNonAccepted = [...existingNonAccepted, ...newNonAccepted.map(c => ({
        creditor: c.creditor,
        balance: c.balance || null,
        accountLast4: c.accountLast4 || '',
        notes: '',
      }))];

      const totalDebt = mergedLedger.reduce((s, c) => s + (c.balance || 0), 0);

      await base44.entities.DebtLead.update(matchedLead.id, {
        debtLedgerJson: JSON.stringify(mergedLedger),
        nonAcceptedCreditorsJson: JSON.stringify(mergedNonAccepted),
        debtAmount: totalDebt || matchedLead.debtAmount || null,
        creditorCount: mergedLedger.length,
      });

      setResults({ accepted, nonAccepted, totalAccepted: mergedLedger.length, totalNonAccepted: mergedNonAccepted.length });
      setStatus('done');
    } catch (e) {
      setError('Failed: ' + (e?.message || String(e)));
      setStatus('idle');
    }
  }, [photo, leadNumber, acceptedList, nonAcceptedList]);

  const reset = () => {
    setPhoto(null); setPhotoUrl(null); setResults(null); setStatus('idle'); setLead(null); setLeadNumber(''); setError('');
  };

  const statusLabels = {
    idle: '', uploading: 'Uploading photo…', analyzing: '🤖 AI is reading the CRM screenshot…', saving: 'Saving to customer profile…', done: '✅ Done!',
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#e8e0d0', fontSize: '20px', margin: '4px 0' }}>✅ Account Types Accepted</h2>
        <p style={{ color: '#6b7280', fontSize: '13px' }}>Upload a screenshot from the CRM of added accounts. AI will cross-reference each creditor against the accepted list and flag them green (accepted) or red (not accepted).</p>
      </div>

      {/* Upload */}
      <div style={{ marginBottom: '20px' }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ''; }} />
        {photoUrl ? (
          <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.3)', marginBottom: '12px' }}>
            <img src={photoUrl} alt="CRM screenshot" style={{ width: '100%', display: 'block' }} />
            <button onClick={() => { setPhoto(null); setPhotoUrl(null); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer' }}>×</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '40px 20px', background: 'rgba(16,185,129,0.08)', border: '2px dashed rgba(16,185,129,0.3)', borderRadius: '12px', color: GOLD, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '40px' }}>📸</span>
            <span>Upload CRM Screenshot</span>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>Photo of added accounts from the CRM</span>
          </button>
        )}
      </div>

      {/* Lead ID input */}
      <div style={{ marginBottom: '20px' }}>
        <label style={ls}>Lead ID #</label>
        <input value={leadNumber} onChange={e => setLeadNumber(e.target.value)} placeholder="#00001" style={inp} />
      </div>

      {error && <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>⚠ {error}</div>}

      {status !== 'idle' && status !== 'done' && (
        <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: GOLD, fontSize: '14px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(16,185,129,0.3)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '8px', verticalAlign: 'middle' }} />
          {statusLabels[status]}
        </div>
      )}

      {status !== 'done' && (
        <button onClick={submit} disabled={!photo || !leadNumber.trim() || status !== 'idle'} style={{ width: '100%', padding: '16px', borderRadius: '12px', background: photo && leadNumber.trim() && status === 'idle' ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(255,255,255,0.05)', color: photo && leadNumber.trim() && status === 'idle' ? DARK : '#4a5568', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: photo && leadNumber.trim() && status === 'idle' ? 'pointer' : 'not-allowed', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {status === 'idle' ? '🔍 Cross-Reference Accounts' : 'Processing…'}
        </button>
      )}

      {/* Results */}
      {status === 'done' && results && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ padding: '14px 16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
            ✅ Saved to {lead?.firstName} {lead?.lastName}'s profile — {results.totalAccepted} accepted, {results.totalNonAccepted} non-accepted
          </div>

          {results.accepted.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>✅ Accepted Creditors</div>
              {results.accepted.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', marginBottom: '6px' }}>
                  <span style={{ color: '#4ade80', fontSize: '20px' }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{c.creditor}</div>
                    {c.balance != null && <div style={{ color: '#6b7280', fontSize: '11px' }}>Balance: ${c.balance.toLocaleString()}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.nonAccepted.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>❌ Not Accepted Creditors</div>
              {results.nonAccepted.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', marginBottom: '6px' }}>
                  <span style={{ color: '#ef4444', fontSize: '20px' }}>❌</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{c.creditor}</div>
                    {c.balance != null && <div style={{ color: '#6b7280', fontSize: '11px' }}>Balance: ${c.balance.toLocaleString()}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={reset} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: GOLD, border: `1px solid ${GOLD}44`, fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}>
            📸 Upload Another Screenshot
          </button>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}