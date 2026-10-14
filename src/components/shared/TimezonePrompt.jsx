/**
 * TimezonePrompt.jsx — First-login popup that asks the fronter for their
 * timezone. Saves it to the DebtCoachUser record and marks timezonePrompted
 * so it never appears again.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';

const TIMEZONES = [
  { id: 'America/New_York', label: 'Eastern Time (ET) — New York, Miami, Atlanta' },
  { id: 'America/Chicago', label: 'Central Time (CT) — Chicago, Dallas, Houston' },
  { id: 'America/Denver', label: 'Mountain Time (MT) — Denver, Phoenix' },
  { id: 'America/Los_Angeles', label: 'Pacific Time (PT) — Los Angeles, Seattle' },
  { id: 'Asia/Manila', label: 'Philippine Time (PHT, GMT+8) — Manila' },
  { id: 'Asia/Karachi', label: 'Pakistan Time (PKT, GMT+5) — Karachi' },
  { id: 'Asia/Kolkata', label: 'India Time (IST, GMT+5:30) — Mumbai, Delhi' },
  { id: 'Europe/London', label: 'UK Time (GMT) — London' },
  { id: 'Australia/Sydney', label: 'Sydney Time (AEDT) — Australia' },
  { id: 'America/Anchorage', label: 'Alaska Time — Anchorage' },
  { id: 'Pacific/Honolulu', label: 'Hawaii Time — Honolulu' },
];

const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', cursor: 'pointer' };

export default function TimezonePrompt({ userId, currentTz, onDone }) {
  const [tz, setTz] = useState(currentTz || 'America/New_York');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.DebtCoachUser.update(userId, { timezone: tz, timezonePrompted: true });
      onDone(tz);
    } catch (e) {
      alert('Failed to save timezone: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60000 }}>
      <div style={{ background: '#0d1b2a', border: `2px solid ${GOLD}55`, borderRadius: '12px', padding: '32px', maxWidth: '480px', width: '90%', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '40px' }}>🌐</span>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', marginTop: '8px', letterSpacing: '1px' }}>What's Your Timezone?</div>
          <div style={{ color: '#8a9ab8', fontSize: '12px', marginTop: '6px' }}>We'll show your local time alongside Eastern Time on your dashboard.</div>
        </div>
        <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Select Your Timezone</label>
        <select value={tz} onChange={e => setTz(e.target.value)} style={inp}>
          {TIMEZONES.map(t => <option key={t.id} value={t.id} style={{ color: DARK, background: '#fff' }}>{t.label}</option>)}
        </select>
        <button onClick={save} disabled={saving} style={{ marginTop: '20px', width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>
          {saving ? '⏳ Saving…' : 'Save My Timezone'}
        </button>
      </div>
    </div>
  );
}