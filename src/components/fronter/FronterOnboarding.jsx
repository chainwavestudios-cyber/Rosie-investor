/**
 * FronterOnboarding.jsx — First-login onboarding for new fronters.
 * Step 1: Collect full name, address, phone, email.
 * Step 2: Review and sign the Dialer Agreement (employment contract with ChainWave Studios LLC).
 * Step 3: Download or email a copy of the signed agreement.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

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

ChainWave Studios LLC`;
}

function buildAgreementHtml(fullName, dateStr) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Dialer Agreement - ${fullName}</title>
<style>
  body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a1a; line-height: 1.7; }
  h1 { text-align: center; font-size: 22px; letter-spacing: 2px; margin-bottom: 30px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 24px; margin-bottom: 8px; }
  .sig { margin-top: 40px; border-top: 1px solid #999; padding-top: 10px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
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
<p><strong>ChainWave Studios LLC</strong></p>
</div>
</body></html>`;
}

export default function FronterOnboarding({ username, onDone }) {
  const [step, setStep] = useState(1);
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

  const handleSign = async () => {
    if (!canSign) return;
    setSaving(true); setError('');
    try {
      const agreementText = buildAgreementText(form.fullName.trim(), today);
      const rec = await base44.entities.FronterAgreement.create({
        username,
        fullName: form.fullName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        agreementText,
        agreementDate: todayISO,
        signedAt: new Date().toISOString(),
      });
      setSavedAgreement({ text: agreementText, html: buildAgreementHtml(form.fullName.trim(), today), fullName: form.fullName.trim() });
      setStep(3);
    } catch (e) { setError('Failed to save agreement: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const handleDownload = () => {
    if (!savedAgreement) return;
    const blob = new Blob([savedAgreement.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dialer_Agreement_${savedAgreement.fullName.replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmail = async () => {
    if (!savedAgreement) return;
    setEmailStatus('sending');
    try {
      await base44.integrations.Core.SendEmail({
        to: form.email.trim(),
        subject: `Dialer Agreement - ChainWave Studios LLC`,
        html: savedAgreement.html,
      });
      setEmailStatus('sent');
    } catch (e) { setEmailStatus('error: ' + (e?.message || String(e))); }
  };

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <div style={{ color: GOLD, fontSize: '24px', fontWeight: 'bold', letterSpacing: '3px', marginBottom: '6px' }}>FRONTER ONBOARDING</div>
      <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '30px' }}>Welcome, {username}. Let's get you set up.</div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', background: step >= s ? `${GOLD}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${step >= s ? GOLD + '66' : 'rgba(255,255,255,0.12)'}`, color: step >= s ? GOLD : '#6b7280' }}>{step > s ? '✓' : s}</div>
            {s < 3 && <div style={{ width: 40, height: 1, background: step > s ? GOLD + '44' : 'rgba(255,255,255,0.12)' }} />}
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* STEP 1: FORM */}
        {step === 1 && (
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
            <button onClick={() => setStep(2)} disabled={!canSubmitForm} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '12px', cursor: canSubmitForm ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: canSubmitForm ? 1 : 0.4 }}>
              Continue to Agreement →
            </button>
          </div>
        )}

        {/* STEP 2: AGREEMENT + SIGN */}
        {step === 2 && (
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
              <span style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>I have read and understood the terms of this Dialer Agreement and agree to be bound by them. I understand this is a legally binding agreement between myself and ChainWave Studios LLC.</span>
            </label>

            {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '10px' }}>⚠ {error}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>← Back</button>
              <button onClick={handleSign} disabled={!canSign || saving} style={{ flex: 2, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '12px', cursor: canSign && !saving ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: canSign && !saving ? 1 : 0.4 }}>
                {saving ? '⏳ Signing…' : '✓ Sign Agreement'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRMATION */}
        {step === 3 && (
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
            <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', marginBottom: '6px' }}>Agreement Signed!</div>
            <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '24px' }}>Your Dialer Agreement with ChainWave Studios LLC has been signed and saved.</div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <button onClick={handleDownload} style={{ flex: 1, background: 'rgba(96,165,250,0.12)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⬇ Download Copy</button>
              <button onClick={handleEmail} disabled={emailStatus === 'sending'} style={{ flex: 1, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', padding: '12px', cursor: emailStatus === 'sending' ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                {emailStatus === 'sending' ? '⏳ Sending…' : emailStatus === 'sent' ? '✓ Email Sent' : '✉ Email Me a Copy'}
              </button>
            </div>

            {emailStatus === 'sent' && <div style={{ color: GOLD, fontSize: '11px', marginBottom: '14px' }}>✓ A copy has been sent to {form.email}</div>}
            {emailStatus.startsWith('error') && <div style={{ color: RED, fontSize: '11px', marginBottom: '14px' }}>⚠ {emailStatus}</div>}

            <button onClick={onDone} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '14px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Continue to Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}