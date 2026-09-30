/**
 * CreditReportUpload.jsx — iPhone-friendly page for snapping credit report photos.
 * Route: /credit
 * Upload photo via camera → enter debt customer # → AI analyzes → updates lead profile.
 */
import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function CreditReportUpload() {
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [leadNumber, setLeadNumber] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [lead, setLead] = useState(null);
  const fileRef = useRef(null);

  const handlePhoto = useCallback((file) => {
    if (!file) return;
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    setError('');
    setResult(null);
  }, []);

  const submit = useCallback(async () => {
    if (!photo) { setError('Please snap a photo of the credit report first.'); return; }
    if (!leadNumber.trim()) { setError('Please enter the debt customer #.'); return; }

    setStatus('uploading');
    setError('');

    try {
      // 1. Find the lead by leadNumber
      const leads = await base44.entities.DebtLead.filter({ leadNumber: leadNumber.trim() }, '-created_date', 5);
      const matchedLead = leads && leads[0];
      if (!matchedLead) { setError(`No lead found with # ${leadNumber.trim()}.`); setStatus('idle'); return; }
      setLead(matchedLead);

      // 2. Upload the photo privately
      setStatus('uploading-photo');
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: photo });

      // 3. Create a signed URL for the AI to read
      setStatus('analyzing');
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });

      // 4. Call the backend function to analyze the credit report
      const res = await base44.functions.invoke('analyzeCreditReport', { photoUrl: signed_url, leadId: matchedLead.id });
      const analysis = res?.result || res?.data?.result;

      if (!analysis) { setError('AI could not analyze the credit report. Try a clearer photo.'); setStatus('idle'); return; }

      // 5. Update the lead with extracted data
      setStatus('saving');
      const ledger = (analysis.creditors || []).map(c => ({
        creditor: c.creditor || 'Unknown',
        balance: c.balance || 0,
        creditLimit: c.creditLimit || null,
        interestRate: c.interestRate || null,
        monthlyPayment: c.monthlyPayment || null,
        accountLast4: c.accountLast4 || '',
        notes: c.accountStatus ? `Status: ${c.accountStatus}` : (c.notes || ''),
      }));

      const updates = {
        debtLedgerJson: JSON.stringify(ledger),
        debtAmount: analysis.totalDebt || ledger.reduce((s, c) => s + (c.balance || 0), 0),
        creditorCount: analysis.creditorCount || ledger.length,
        creditReportPhotoUri: file_uri,
        creditReportAnalyzedAt: new Date().toISOString(),
      };
      if (analysis.creditScore) updates.creditScore = analysis.creditScore;
      if (analysis.monthlyIncome) updates.monthlyIncome = analysis.monthlyIncome;
      if (analysis.behindOnPayments !== undefined) updates.behindOnPayments = analysis.behindOnPayments;
      if (analysis.monthsBehind) updates.monthsBehind = analysis.monthsBehind;

      await base44.entities.DebtLead.update(matchedLead.id, updates);
      setResult({ ...analysis, ledger, ...updates });
      setStatus('done');
    } catch (e) {
      setError('Failed: ' + (e?.message || String(e)));
      setStatus('idle');
    }
  }, [photo, leadNumber]);

  // ── Calculations ──────────────────────────────────────────────────────────
  const calc = (() => {
    if (!result?.ledger) return null;
    const ledger = result.ledger;
    const monthlyIncome = result.monthlyIncome || lead?.monthlyIncome || 0;

    const perDebt = ledger.map(c => {
      const balance = c.balance || 0;
      const rate = c.interestRate || 0;
      const payment = c.monthlyPayment || 0;
      const monthlyInterest = balance * (rate / 100) / 12;
      const monthlyPrincipal = Math.max(0, payment - monthlyInterest);
      const annualInterest = monthlyInterest * 12;
      const annualPrincipal = monthlyPrincipal * 12;
      const annualPaid = payment * 12;
      return { ...c, monthlyInterest, monthlyPrincipal, annualInterest, annualPrincipal, annualPaid };
    });

    const totalMonthlyPayments = ledger.reduce((s, c) => s + (c.monthlyPayment || 0), 0);
    const totalAnnualPaid = totalMonthlyPayments * 12;
    const totalAnnualInterest = perDebt.reduce((s, c) => s + c.annualInterest, 0);
    const totalAnnualPrincipal = perDebt.reduce((s, c) => s + c.annualPrincipal, 0);
    const totalDebt = ledger.reduce((s, c) => s + (c.balance || 0), 0);
    const dti = monthlyIncome > 0 ? (totalMonthlyPayments / monthlyIncome) * 100 : 0;

    return { perDebt, totalMonthlyPayments, totalAnnualPaid, totalAnnualInterest, totalAnnualPrincipal, totalDebt, dti, monthlyIncome };
  })();

  const statusLabels = {
    'idle': '',
    'uploading': 'Uploading photo…',
    'uploading-photo': 'Uploading photo…',
    'analyzing': '🤖 AI is reading your credit report…',
    'saving': 'Saving to customer profile…',
    'done': '✅ Credit report analyzed and saved!',
  };

  return (
    <div style={{ minHeight: '100vh', background: DARK, padding: '20px 16px', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase' }}>Settlement IQ</div>
          <h1 style={{ color: '#e8e0d0', fontSize: '24px', margin: '4px 0' }}>📷 Credit Report Upload</h1>
          <p style={{ color: '#6b7280', fontSize: '13px' }}>Snap a photo of the credit report and enter the customer #. AI will automatically extract all debts and update the profile.</p>
        </div>

        {/* Upload button */}
        <div style={{ marginBottom: '20px' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ''; }}
          />
          {photoUrl ? (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.3)' }}>
              <img src={photoUrl} alt="Credit report" style={{ width: '100%', display: 'block' }} />
              <button
                onClick={() => { setPhoto(null); setPhotoUrl(null); }}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer' }}
              >×</button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '40px 20px', background: 'rgba(16,185,129,0.08)',
                border: '2px dashed rgba(16,185,129,0.3)', borderRadius: '12px',
                color: GOLD, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              }}
            >
              <span style={{ fontSize: '40px' }}>📷</span>
              <span>Upload Report</span>
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>Tap to open camera</span>
            </button>
          )}
        </div>

        {/* Debt customer # input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Debt Customer #</label>
          <input
            value={leadNumber}
            onChange={e => setLeadNumber(e.target.value)}
            placeholder="#00001"
            style={{
              width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
              padding: '14px 16px', color: '#e8e0d0', fontSize: '16px', outline: 'none',
              fontFamily: 'Georgia, serif',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>
            ⚠ {error}
          </div>
        )}

        {/* Status */}
        {status !== 'idle' && status !== 'done' && (
          <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: GOLD, fontSize: '14px', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(16,185,129,0.3)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '8px', verticalAlign: 'middle' }} />
            {statusLabels[status]}
          </div>
        )}

        {/* Submit button */}
        {status !== 'done' && (
          <button
            onClick={submit}
            disabled={!photo || !leadNumber.trim() || status !== 'idle'}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px',
              background: photo && leadNumber.trim() && status === 'idle' ? 'linear-gradient(135deg,#10b981,#22c55e)' : 'rgba(255,255,255,0.05)',
              color: photo && leadNumber.trim() && status === 'idle' ? DARK : '#4a5568',
              border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: photo && leadNumber.trim() && status === 'idle' ? 'pointer' : 'not-allowed',
              letterSpacing: '1px', textTransform: 'uppercase',
            }}
          >
            {status === 'idle' ? '🚀 Submit for AI Analysis' : 'Processing…'}
          </button>
        )}

        {/* Results */}
        {status === 'done' && result && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ padding: '14px 16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
              ✅ Credit report analyzed and saved to {lead?.firstName} {lead?.lastName}'s profile!
            </div>

            {calc && (
              <>
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <StatBox label="Total Debt" value={`$${Math.round(calc.totalDebt).toLocaleString()}`} color="#ef4444" />
                  <StatBox label="Debt-to-Income" value={calc.monthlyIncome > 0 ? `${calc.dti.toFixed(1)}%` : '—'} color={calc.dti > 43 ? '#ef4444' : calc.dti > 36 ? '#f59e0b' : '#4ade80'} />
                  <StatBox label="Monthly Payments" value={`$${Math.round(calc.totalMonthlyPayments).toLocaleString()}`} color="#60a5fa" />
                  <StatBox label="Creditors" value={result.creditorCount || calc.perDebt.length} color="#a78bfa" />
                </div>

                {/* Annual breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <StatBox label="Annual Interest Paid" value={`$${Math.round(calc.totalAnnualInterest).toLocaleString()}`} color="#ef4444" />
                  <StatBox label="Annual Principal Paid" value={`$${Math.round(calc.totalAnnualPrincipal).toLocaleString()}`} color="#4ade80" />
                  <StatBox label="Total Annual Paid" value={`$${Math.round(calc.totalAnnualPaid).toLocaleString()}`} color="#f59e0b" />
                  <StatBox label="Credit Score" value={result.creditScore || '—'} color="#60a5fa" />
                </div>

                {/* Per-debt breakdown */}
                <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>💳 Per-Debt Breakdown</div>
                {calc.perDebt.map((d, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>{d.creditor}{d.accountLast4 ? ` ····${d.accountLast4}` : ''}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                      <Row label="Balance" value={`$${(d.balance || 0).toLocaleString()}`} color="#e8e0d0" />
                      <Row label="Interest Rate" value={d.interestRate ? `${d.interestRate}%` : '—'} color="#e8e0d0" />
                      <Row label="Monthly Payment" value={`$${(d.monthlyPayment || 0).toLocaleString()}`} color="#60a5fa" />
                      <Row label="Mo. Interest" value={`$${Math.round(d.monthlyInterest).toLocaleString()}`} color="#ef4444" />
                      <Row label="Mo. Principal" value={`$${Math.round(d.monthlyPrincipal).toLocaleString()}`} color="#4ade80" />
                      <Row label="Annual Interest" value={`$${Math.round(d.annualInterest).toLocaleString()}`} color="#ef4444" />
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => { setPhoto(null); setPhotoUrl(null); setResult(null); setStatus('idle'); setLead(null); setLeadNumber(''); }}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: GOLD, border: `1px solid ${GOLD}44`, fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
                >
                  📷 Upload Another Report
                </button>
              </>
            )}
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}