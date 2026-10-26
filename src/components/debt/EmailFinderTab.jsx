/**
 * EmailFinderTab.jsx — one-at-a-time email lookup (admin tool).
 *
 * The same Tracerfy service the Leads Vault uses for phone append: type a name,
 * a number and an address, and it returns the emails on file at that address.
 * The name and number pick which person at the address is meant, so the email
 * shown is the right household member's.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const MUTED = '#8a9ab8';
const DIM = '#6b7280';
const BORDER = 'rgba(255,255,255,0.09)';

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER}`,
  borderRadius: '4px',
  color: '#e5eaf2',
  padding: '9px 10px',
  fontSize: '12px',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  color: DIM,
  fontSize: '9px',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '5px',
};

const EMPTY = { firstName: '', lastName: '', phone: '', address: '', city: '', state: '', zip: '' };

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export default function EmailFinderTab() {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const find = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setCopied('');
    try {
      const res = await base44.functions.invoke('emailFinder', { ...form });
      setResult(res?.data || res);
    } catch (e) {
      setResult(null);
      setError(e?.response?.data?.error || e?.message || 'The lookup could not run.');
    }
    setBusy(false);
  };

  const copy = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(email);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setResult(null);
    setError('');
    setCopied('');
  };

  const searchable = form.address.trim() && form.state.trim().length >= 2;
  const otherEmails = (result?.emails || []).filter((e) => e.email !== result?.bestEmail);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '900px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '18px' }}>
        <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🔎 Email Finder</div>
        <div style={{ color: MUTED, fontSize: '11px', marginTop: '6px', lineHeight: 1.6 }}>
          Looks up the emails on file at an address — the same Tracerfy service the Leads Vault uses. Type the name, number and address; the name and number decide
          which person at that address is meant. One lookup at a time, and nothing is saved. A hit costs credits, a miss is free.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px', marginTop: '16px' }}>
          <Field label="First name">
            <input style={inputStyle} value={form.firstName} onChange={set('firstName')} placeholder="Janet" />
          </Field>
          <Field label="Last name">
            <input style={inputStyle} value={form.lastName} onChange={set('lastName')} placeholder="Morris" />
          </Field>
          <Field label="Phone number">
            <input style={inputStyle} value={form.phone} onChange={set('phone')} placeholder="(480) 555-1234" />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginTop: '10px' }}>
          <Field label="Street address">
            <input style={inputStyle} value={form.address} onChange={set('address')} placeholder="4521 E Monte Cristo Ave" />
          </Field>
          <Field label="City">
            <input style={inputStyle} value={form.city} onChange={set('city')} placeholder="Phoenix" />
          </Field>
          <Field label="State">
            <input style={inputStyle} value={form.state} onChange={set('state')} placeholder="AZ" maxLength={2} />
          </Field>
          <Field label="ZIP">
            <input style={inputStyle} value={form.zip} onChange={set('zip')} placeholder="85032" />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
          <button
            onClick={find}
            disabled={busy || !searchable}
            style={{
              background: 'linear-gradient(135deg,#059669,#10b981)',
              color: '#04110c',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: busy || !searchable ? 'not-allowed' : 'pointer',
              opacity: busy || !searchable ? 0.5 : 1,
            }}
          >
            {busy ? '⏳ Searching…' : '🔎 Find email'}
          </button>
          <button
            onClick={reset}
            disabled={busy}
            style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '10px 14px', fontSize: '11px', cursor: 'pointer' }}
          >
            Clear
          </button>
          <span style={{ color: DIM, fontSize: '10px' }}>
            {searchable ? 'Address and state are what the lookup searches on.' : 'Street address and a two-letter state are needed.'}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '6px', padding: '14px', color: '#fca5a5', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {result && !result.hit && !result.error && (
        <div style={{ background: '#0d1b2a', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '18px' }}>
          <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>No email found at that address</div>
          <div style={{ color: MUTED, fontSize: '11px', marginTop: '6px', lineHeight: 1.6 }}>
            {result.message || 'Tracerfy had no match for that address.'} Check the street, city and ZIP, or try the address without the apartment number.
          </div>
          <div style={{ color: DIM, fontSize: '10px', marginTop: '8px' }}>{result.creditsUsed || 0} credits used.</div>
        </div>
      )}

      {result?.hit && (
        <div style={{ background: '#0d1b2a', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Email found</div>
            <div style={{ color: DIM, fontSize: '10px' }}>
              {result.creditsUsed || 0} credits · matched by {result.matchedBy}
            </div>
          </div>

          {result.bestEmail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
              <div style={{ color: '#ffffff', fontSize: '17px', fontWeight: 'bold', wordBreak: 'break-all' }}>{result.bestEmail}</div>
              <button
                onClick={() => copy(result.bestEmail)}
                style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '5px 10px', fontSize: '10px', cursor: 'pointer' }}
              >
                {copied === result.bestEmail ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <div style={{ color: '#f59e0b', fontSize: '12px', marginTop: '10px' }}>A person was found at that address, but no email is on file for them.</div>
          )}

          {!!result.match?.name && (
            <div style={{ color: MUTED, fontSize: '11px', marginTop: '8px' }}>
              {result.match.name}
              {!!result.match.phones?.length && (
                <> · {result.match.phones.map((p) => `${p.number}${p.type ? ` (${p.type})` : ''}`).join(' · ')}</>
              )}
            </div>
          )}

          {!!otherEmails.length && (
            <div style={{ marginTop: '14px', borderTop: `1px solid ${BORDER}`, paddingTop: '12px' }}>
              <div style={{ ...labelStyle, marginBottom: '8px' }}>Other emails at this address</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {otherEmails.map((email) => (
                  <div key={email.email} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#c4cdd8', fontSize: '12px', wordBreak: 'break-all' }}>{email.email}</span>
                    <button
                      onClick={() => copy(email.email)}
                      style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }}
                    >
                      {copied === email.email ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.persons?.length > 1 && (
            <div style={{ color: DIM, fontSize: '10px', marginTop: '12px' }}>
              {result.persons.length} people are on file at this address — the top one is the best match for what you typed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}