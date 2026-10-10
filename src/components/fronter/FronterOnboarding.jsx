/**
 * FronterOnboarding.jsx — First-login onboarding for new fronters.
 * Step 1: Change password (forced on first login).
 * Step 2: Collect full name, address, phone, email.
 * Step 3: Review and sign the Dialer Agreement (auto counter-signed by Chris Bongiorno, CEO).
 * Step 4: Download or email a PDF copy of the signed agreement, then enter dashboard.
 */
import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const CEO_NAME = 'Chris Bongiorno';
const CEO_TITLE = 'CEO, ChainWave Studios LLC';

export function buildAgreementText(fullName, dateStr) {
  return `DIALER AGREEMENT

This Dialer Agreement ("Agreement") is entered into on ${dateStr}, by and between ChainWave Studios LLC ("Company") and ${fullName} ("Dialer").

1. BASE COMPENSATION
Dialer shall receive a base compensation of $300 per month, payable on the 1st and 15th of each month.

2. BONUSES
All bonuses shall be paid on the 1st and 15th of each month, alongside the base compensation.

a) Sales Bonus: To qualify for a sales bonus, a transferred prospect must convert into a sale. All sales will be updated in the leads tab daily. A bonus of $10 per converted sale will be paid.

b) Daily Volume Bonus:
   - 10 successful transfers in one day = $10 bonus
   - 15 successful transfers in one day = $20 bonus

c) Weekly Volume Bonus:
   - 45 transfers in one week = $10 bonus
   - 65 transfers in one week = $20 bonus

3. WORK HOURS
Dialer is expected to work 40 hours per week, 8 hours per day, excluding the lunch period. If Dialer takes a 30-minute lunch, Dialer must work 8.5 hours to account for 8 working hours.

The best times to dial are 11:00 AM to 7:30 PM EST, to ensure USA west coast coverage.

4. SCHEDULE
Dialer has the option of working Monday through Friday. Dialer may also work Saturdays for additional compensation.

a) Saturday Shift: A Saturday shift is 4 hours. Dialer will receive a $12 bonus for working a Saturday shift, plus all bonuses earned on Saturday are increased by an additional 25%.

5. ACKNOWLEDGMENT
By signing below, Dialer acknowledges that they have read and understood the terms of this Agreement and agree to be bound by them.

Date: ${dateStr}

Dialer Signature: ${fullName}

Counter-Signed by: ${CEO_NAME}
${CEO_TITLE}
Date: ${dateStr}`;
}

function buildSignedAgreementHtml(fullName, dateStr) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Dialer Agreement - ${fullName}</title>
<style>
  body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a1a; line-height: 1.7; }
  h1 { text-align: center; font-size: 22px; letter-spacing: 2px; margin-bottom: 30px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 24px; margin-bottom: 8px; }
  .sig { margin-top: 40px; border-top: 1px solid #999; padding-top: 10px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
  .counter { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #aaa; }
</style></head><body>
<h1>DIALER AGREEMENT</h1>
<div class="meta">This Dialer Agreement ("Agreement") is entered into on <strong>${dateStr}</strong>, by and between <strong>ChainWave Studios LLC</strong> ("Company") and <strong>${fullName}</strong> ("Dialer").</div>

<h2>1. Base Compensation</h2>
<p>Dialer shall receive a base compensation of $300 per month, payable on the 1st and 15th of each month.</p>

<h2>2. Bonuses</h2>
<p>All bonuses shall be paid on the 1st and 15th of each month, alongside the base compensation.</p>
<p><strong>a) Sales Bonus:</strong> To qualify for a sales bonus, a transferred prospect must convert into a sale. All sales will be updated in the leads tab daily. A bonus of $10 per converted sale will be paid.</p>
<p><strong>b) Daily Volume Bonus:</strong></p>
<ul><li>10 successful transfers in one day = $10 bonus</li><li>15 successful transfers in one day = $20 bonus</li></ul>
<p><strong>c) Weekly Volume Bonus:</strong></p>
<ul><li>45 transfers in one week = $10 bonus</li><li>65 transfers in one week = $20 bonus</li></ul>

<h2>3. Work Hours</h2>
<p>Dialer is expected to work 40 hours per week, 8 hours per day, excluding the lunch period. If Dialer takes a 30-minute lunch, Dialer must work 8.5 hours to account for 8 working hours.</p>
<p>The best times to dial are 11:00 AM to 7:30 PM EST, to ensure USA west coast coverage.</p>

<h2>4. Schedule</h2>
<p>Dialer has the option of working Monday through Friday. Dialer may also work Saturdays for additional compensation.</p>
<p><strong>a) Saturday Shift:</strong> A Saturday shift is 4 hours. Dialer will receive a $12 bonus for working a Saturday shift, plus all bonuses earned on Saturday are increased by an additional 25%.</p>

<h2>5. Acknowledgment</h2>
<p>By signing below, Dialer acknowledges that they have read and understood the terms of this Agreement and agree to be bound by them.</p>

<div class="sig">
<p><strong>Date:</strong> ${dateStr}</p>
<p><strong>Dialer Signature:</strong> ${fullName}</p>
<div class="counter">
<p><strong>Counter-Signed by:</strong> ${CEO_NAME}</p>
<p><strong>${CEO_TITLE}</strong></p>
<p><strong>Date:</strong> ${dateStr}</p>
</div>
</div>
</body></html>`;
}

function generateAgreementPdf(fullName, dateStr) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DIALER AGREEMENT', pageWidth / 2, y, { align: 'center' });
  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const text = buildAgreementText(fullName, dateStr);
  const paragraphs = text.split('\n\n');
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, maxWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 13;
    }
    y += 6;
  }

  return doc;
}

export default function FronterOnboarding({ username, onDone, mustResetPassword: mustReset = false }) {
  const { resetMyPassword } = useDebtCoachAuth();
  const [step, setStep] = useState(mustReset ? 1 : 2);
  const [pwForm, setPwForm] = useState({ newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [form, setForm] = useState({ fullName: '', address: '', phone: '', email: '' });
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [savedAgreement, setSavedAgreement] = useState(null);

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const todayISO = new Date().toISOString().slice(0, 10);

  const canSubmitForm = form.fullName.trim() && form.address.trim() && form.phone.trim() && form.email.trim();
  const canSign = signature.trim() && agreed && signature.trim().toLowerCase() === form.fullName.trim().toLowerCase();
  const canChangePw = pwForm.newPassword.length >= 6 && pwForm.newPassword === pwForm.confirm;

  const handleChangePassword = async () => {
    if (!canChangePw) return;
    setPwSaving(true); setPwError('');
    try {
      await resetMyPassword(pwForm.newPassword);
      setStep(2);
    } catch (e) { setPwError(e?.message || String(e)); }
    setPwSaving(false);
  };

  const handleSign = async () => {
    if (!canSign) return;
    setSaving(true); setError('');
    try {
      const agreementText = buildAgreementText(form.fullName.trim(), today);
      await base44.entities.FronterAgreement.create({
        username,
        fullName: form.fullName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        agreementText,
        agreementDate: todayISO,
        signedAt: new Date().toISOString(),
      });
      setSavedAgreement({ text: agreementText, html: buildSignedAgreementHtml(form.fullName.trim(), today), fullName: form.fullName.trim() });
      setStep(4);
    } catch (e) { setError('Failed to save agreement: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const handleDownload = () => {
    if (!savedAgreement) return;
    const doc = generateAgreementPdf(savedAgreement.fullName, today);
    doc.save(`Dialer_Agreement_${savedAgreement.fullName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleEmail = async () => {
    if (!savedAgreement) return;
    setEmailStatus('sending');
    try {
      const doc = generateAgreementPdf(savedAgreement.fullName, today);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      await base44.integrations.Core.SendEmail({
        to: form.email.trim(),
        subject: `Dialer Agreement - ChainWave Studios LLC`,
        html: savedAgreement.html,
        attachments: [{ filename: `Dialer_Agreement_${savedAgreement.fullName.replace(/\s+/g, '_')}.pdf`, content: pdfBase64 }],
      });
      setEmailStatus('sent');
    } catch (e) { setEmailStatus('error: ' + (e?.message || String(e))); }
  };

  const steps = mustReset ? [1, 2, 3, 4] : [2, 3, 4];
  const stepLabels = { 1: 'Password', 2: 'Details', 3: 'Agreement', 4: 'Welcome' };

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
      <div style={{ color: GOLD, fontSize: '24px', fontWeight: 'bold', letterSpacing: '3px', marginBottom: '6px' }}>FRONTER ONBOARDING</div>
      <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '30px' }}>Welcome, {username}. Let's get you set up.</div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div title={stepLabels[s]} style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', background: step >= s ? `${GOLD}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${step >= s ? GOLD + '66' : 'rgba(255,255,255,0.12)'}`, color: step >= s ? GOLD : '#6b7280' }}>{step > s ? '✓' : i + 1}</div>
            {i < steps.length - 1 && <div style={{ width: 40, height: 1, background: step > s ? GOLD + '44' : 'rgba(255,255,255,0.12)' }} />}
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* STEP 1: PASSWORD CHANGE */}
        {step === 1 && (
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '28px' }}>
            <div style={{ color: '#f59e0b', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>🔑 Change Your Password</div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '18px', lineHeight: 1.5 }}>This is your first login. You must set a new password before continuing. Choose a password you'll remember — you'll use it to log in from now on.</div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>New Password (min 6 characters)</label>
              <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} style={inp} placeholder="••••••••" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Confirm New Password</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} style={{ ...inp, borderColor: pwForm.confirm && pwForm.newPassword !== pwForm.confirm ? 'rgba(239,68,68,0.4)' : undefined }} placeholder="••••••••" />
              {pwForm.confirm && pwForm.newPassword !== pwForm.confirm && <div style={{ color: RED, fontSize: '10px', marginTop: '4px' }}>✗ Passwords do not match</div>}
              {pwForm.confirm && pwForm.newPassword === pwForm.confirm && pwForm.newPassword.length >= 6 && <div style={{ color: GOLD, fontSize: '10px', marginTop: '4px' }}>✓ Passwords match</div>}
            </div>
            {pwError && <div style={{ color: RED, fontSize: '11px', marginBottom: '10px' }}>⚠ {pwError}</div>}
            <button onClick={handleChangePassword} disabled={!canChangePw || pwSaving} style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: DARK, border: 'none', borderRadius: '6px', padding: '12px', cursor: canChangePw && !pwSaving ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: canChangePw && !pwSaving ? 1 : 0.4 }}>
              {pwSaving ? '⏳ Saving…' : '✓ Set New Password & Continue'}
            </button>
          </div>
        )}

        {/* STEP 2: FORM */}
        {step === 2 && (
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '28px' }}>
            <div style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '18px' }}>📋 Your Information</div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Full Legal Name</label>
              <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} style={inp} placeholder="John Michael Smith" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Address</label>
              <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="123 Main St, Apt 4B&#10;Los Angeles, CA 90001" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={ls}>Phone Number</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inp} placeholder="555-123-4567" />
              </div>
              <div>
                <label style={ls}>Email Address</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="you@email.com" />
              </div>
            </div>
            <button onClick={() => setStep(3)} disabled={!canSubmitForm} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '12px', cursor: canSubmitForm ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: canSubmitForm ? 1 : 0.4 }}>
              Continue to Agreement →
            </button>
          </div>
        )}

        {/* STEP 3: AGREEMENT + SIGN */}
        {step === 3 && (
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>📜 Dialer Agreement</div>
              <div style={{ color: '#6b7280', fontSize: '11px' }}>{today}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '18px', maxHeight: '320px', overflowY: 'auto', marginBottom: '18px', color: '#c4cdd8', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
              {buildAgreementText(form.fullName.trim() || '[Your Name]', today)}
            </div>

            {/* Signature */}
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Type Your Full Name as Signature</label>
              <input value={signature} onChange={e => setSignature(e.target.value)} style={inp} placeholder={form.fullName} />
              {signature.trim() && signature.trim().toLowerCase() !== form.fullName.trim().toLowerCase() && (
                <div style={{ color: RED, fontSize: '10px', marginTop: '4px' }}>⚠ Signature must match your full legal name exactly.</div>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '18px', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }} />
              <span style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>I have read and understood the terms of this Dialer Agreement and agree to be bound by them. I understand this is a legally binding agreement between myself and ChainWave Studios LLC. Upon signing, this agreement will be automatically counter-signed by ${CEO_NAME}, ${CEO_TITLE}.</span>
            </label>

            {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '10px' }}>⚠ {error}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>← Back</button>
              <button onClick={handleSign} disabled={!canSign || saving} style={{ flex: 2, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '12px', cursor: canSign && !saving ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: canSign && !saving ? 1 : 0.4 }}>
                {saving ? '⏳ Signing…' : '✓ Sign Agreement'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CONFIRMATION */}
        {step === 4 && savedAgreement && (
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤝</div>
            <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', marginBottom: '6px' }}>Agreement Signed & Counter-Signed!</div>
            <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>Your Dialer Agreement with ChainWave Studios LLC has been signed by you and counter-signed by {CEO_NAME}, {CEO_TITLE}.</div>
            <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '24px' }}>Signed on {today}</div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <button onClick={handleDownload} style={{ flex: 1, background: 'rgba(96,165,250,0.12)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⬇ Download PDF Copy</button>
              <button onClick={handleEmail} disabled={emailStatus === 'sending'} style={{ flex: 1, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', padding: '12px', cursor: emailStatus === 'sending' ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                {emailStatus === 'sending' ? '⏳ Sending…' : emailStatus === 'sent' ? '✓ Email Sent' : '✉ Email Me a Copy'}
              </button>
            </div>

            {emailStatus === 'sent' && <div style={{ color: GOLD, fontSize: '11px', marginBottom: '14px' }}>✓ A PDF copy has been sent to {form.email}</div>}
            {emailStatus.startsWith('error') && <div style={{ color: RED, fontSize: '11px', marginBottom: '14px' }}>⚠ {emailStatus}</div>}

            <button onClick={onDone} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '16px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
              🚀 Enter Dashboard — Welcome Aboard!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}