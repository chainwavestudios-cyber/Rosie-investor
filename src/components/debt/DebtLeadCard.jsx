/**
 * DebtLeadCard.jsx — Debt settlement lead contact card for live calls.
 * Shows debt-specific fields + AI-detected info from the call (debt amount, creditors, etc.).
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ClientProfileModal from '@/components/debt/ClientProfileModal';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const STATUS_COLORS = {
  new: '#60a5fa', contacted: '#f59e0b', qualified: '#a78bfa', enrolled: '#4ade80', declined: '#ef4444', completed: '#6b7280', callback: '#f59e0b',
};
const STATUS_LABELS = {
  new: '🔵 New', contacted: '📞 Contacted', qualified: '⭐ Qualified', enrolled: '✅ Enrolled', declined: '❌ Declined', completed: '✓ Completed', callback: '📅 Callback',
};

export default function DebtLeadCard({ lead, onLeadChange, transcript, intentScore, animalType, profileData }) {
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const update = (field, value) => onLeadChange({ ...lead, [field]: value });

  const save = async () => {
    if (!lead.id) return;
    setSaving(true);
    try {
      await base44.entities.DebtLead.update(lead.id, {
        firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, email: lead.email,
        address: lead.address, city: lead.city, state: lead.state, zip: lead.zip,
        debtAmount: lead.debtAmount, creditorCount: lead.creditorCount, creditors: lead.creditors,
        debtLedgerJson: lead.debtLedgerJson,
        employmentStatus: lead.employmentStatus, monthlyIncome: lead.monthlyIncome,
        creditScore: lead.creditScore, behindOnPayments: lead.behindOnPayments,
        monthsBehind: lead.monthsBehind, programEnrolled: lead.programEnrolled,
        enrollmentDate: lead.enrollmentDate, status: lead.status, notes: lead.notes,
        intentScore: intentScore ?? lead.intentScore, animalType: animalType || lead.animalType,
        profileJson: profileData ? JSON.stringify(profileData) : lead.profileJson,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const CARD_TABS = [['overview', 'Overview'], ['transcript', '📋 Transcript'], ['debt', 'Debt Details'], ['ledger', '💳 Debt Ledger'], ['employment', 'Employment'], ['notes', 'Notes'], ['ai', '🤖 AI Profile']];

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.1))', border: '2px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>💳</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#e8e0d0', fontSize: '16px' }}>{lead.firstName} {lead.lastName}</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{lead.phone} · {lead.email}</div>
          </div>
          <button onClick={() => setShowProfile(true)} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            👤 Client Profile
          </button>
          <span style={{ padding: '3px 10px', borderRadius: '2px', background: `${STATUS_COLORS[lead.status] || '#6b7280'}22`, color: STATUS_COLORS[lead.status] || '#6b7280', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{STATUS_LABELS[lead.status] || lead.status}</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_LABELS).map(([s, l]) => (
            <button key={s} onClick={() => update('status', s)} style={{ padding: '3px 8px', borderRadius: '20px', border: `1px solid ${lead.status === s ? STATUS_COLORS[s] + '66' : 'rgba(255,255,255,0.1)'}`, background: lead.status === s ? `${STATUS_COLORS[s]}18` : 'transparent', color: lead.status === s ? STATUS_COLORS[s] : '#6b7280', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto' }}>
        {CARD_TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? GOLD : 'transparent'}`, color: tab === id ? GOLD : '#6b7280', padding: '10px 14px', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="First Name" value={lead.firstName} onChange={v => update('firstName', v)} />
            <Field label="Last Name" value={lead.lastName} onChange={v => update('lastName', v)} />
            <Field label="Phone" value={lead.phone} onChange={v => update('phone', v)} />
            <Field label="Email" value={lead.email} onChange={v => update('email', v)} />
            <Field label="Address" value={lead.address} onChange={v => update('address', v)} />
            <Field label="City" value={lead.city} onChange={v => update('city', v)} />
            <Field label="State" value={lead.state} onChange={v => update('state', v)} />
            <Field label="Zip" value={lead.zip} onChange={v => update('zip', v)} />
          </div>
        )}
        {tab === 'transcript' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {transcript.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No transcript yet. Start a call to see live transcription here.</div>
            ) : transcript.map((msg, i) => {
              const isAgent = msg.speaker === 0;
              const sentColor = msg.sentiment === 'positive' ? '#4ade80' : msg.sentiment === 'negative' ? '#ef4444' : '#6b7280';
              return (
                <div key={i} style={{ display: 'flex', gap: '8px', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', background: isAgent ? 'rgba(96,165,250,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isAgent ? 'rgba(96,165,250,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: isAgent ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ color: isAgent ? '#60a5fa' : '#f59e0b', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAgent ? '🎙 Agent' : '👤 Customer'}</span>
                      {msg.sentiment && <span style={{ color: sentColor, fontSize: '9px' }}>● {msg.sentiment}</span>}
                    </div>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'debt' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Total Debt Amount ($)" value={lead.debtAmount} onChange={v => update('debtAmount', v ? Number(v) : null)} type="number" />
            <Field label="Number of Creditors" value={lead.creditorCount} onChange={v => update('creditorCount', v ? Number(v) : null)} type="number" />
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={ls}>Creditors List</label>
              <textarea value={lead.creditors || ''} onChange={e => update('creditors', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="Chase: $8,000, Capital One: $12,000, Discover: $6,000…" />
            </div>
            <div>
              <label style={ls}>Behind on Payments</label>
              <select value={lead.behindOnPayments ? 'yes' : 'no'} onChange={e => update('behindOnPayments', e.target.value === 'yes')} style={inp}>
                <option value="no">No — Current</option>
                <option value="yes">Yes — Behind</option>
              </select>
            </div>
            <Field label="Months Behind" value={lead.monthsBehind} onChange={v => update('monthsBehind', v ? Number(v) : null)} type="number" />
            <div>
              <label style={ls}>Enrolled in Program</label>
              <select value={lead.programEnrolled ? 'yes' : 'no'} onChange={e => update('programEnrolled', e.target.value === 'yes')} style={inp}>
                <option value="no">Not Enrolled</option>
                <option value="yes">Enrolled</option>
              </select>
            </div>
            <Field label="Enrollment Date" value={lead.enrollmentDate} onChange={v => update('enrollmentDate', v)} type="date" />
          </div>
        )}
        {tab === 'ledger' && <DebtLedgerTab lead={lead} update={update} />}
        {tab === 'employment' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={ls}>Employment Status</label>
              <select value={lead.employmentStatus || ''} onChange={e => update('employmentStatus', e.target.value)} style={inp}>
                <option value="">— Select —</option>
                <option value="employed">Employed</option>
                <option value="self-employed">Self-Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="retired">Retired</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <Field label="Monthly Income ($)" value={lead.monthlyIncome} onChange={v => update('monthlyIncome', v ? Number(v) : null)} type="number" />
            <Field label="Credit Score" value={lead.creditScore} onChange={v => update('creditScore', v ? Number(v) : null)} type="number" />
          </div>
        )}
        {tab === 'notes' && (
          <div>
            <label style={ls}>Notes</label>
            <textarea value={lead.notes || ''} onChange={e => update('notes', e.target.value)} rows={8} style={{ ...inp, resize: 'vertical' }} placeholder="Call notes, objections, next steps…" />
          </div>
        )}
        {tab === 'ai' && (
          <div>
            {profileData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <StatBox label="Intent Score" value={intentScore != null ? `${intentScore}/100` : '—'} color="#f472b6" />
                  <StatBox label="Animal Type" value={profileData.animalType || animalType || 'unknown'} color="#a78bfa" />
                  <StatBox label="Interest" value={profileData.overallIntentLabel || '—'} color="#4ade80" />
                </div>
                {profileData.keyObservations?.length > 0 && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Key Observations</div>
                    {profileData.keyObservations.map((o, i) => <div key={i} style={{ color: '#8a9ab8', fontSize: '12px', marginBottom: '4px' }}>• {o}</div>)}
                  </div>
                )}
                {profileData.recommendedApproach && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Recommended Approach</div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{profileData.recommendedApproach}</div>
                  </div>
                )}
                {profileData.traits && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Traits</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {Object.entries(profileData.traits).filter(([, v]) => v).map(([k]) => (
                        <span key={k} style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px', color: GOLD, fontSize: '10px' }}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</span>
                      ))}
                    </div>
                  </div>
                )}
                {profileData.lastCallSummary && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Last Call Summary</div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{profileData.lastCallSummary}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>AI profile builds automatically during the call. Start a call to see it here.</div>
            )}
          </div>
        )}
      </div>

      {/* Save bar */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={save} disabled={saving || !lead.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving || !lead.id ? 0.5 : 1 }}>
          {saving ? '⏳ Saving…' : '💾 Save Lead'}
        </button>
        {saved && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓ Saved</span>}
        {!lead.id && <span style={{ color: '#4a5568', fontSize: '11px' }}>Create lead first to save</span>}
      </div>

      {showProfile && <ClientProfileModal lead={lead} onClose={() => setShowProfile(false)} onSave={(updated) => onLeadChange(updated)} />}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label style={ls}>{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} style={inp} />
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

// ─── Debt Ledger Tab — structured creditor entries ───────────────────────────
function DebtLedgerTab({ lead, update }) {
  const GOLD = '#10b981';
  const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
  const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

  const ledger = (() => { try { return JSON.parse(lead.debtLedgerJson || '[]'); } catch { return []; } })();
  const setLedger = (newLedger) => update('debtLedgerJson', JSON.stringify(newLedger));

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ creditor: '', balance: '', interestRate: '', monthlyPayment: '', paymentSchedule: 'monthly', accountLast4: '', notes: '' });

  const addCreditor = () => {
    if (!form.creditor.trim()) return;
    const entry = {
      creditor: form.creditor.trim(),
      balance: form.balance ? Number(form.balance) : null,
      interestRate: form.interestRate ? Number(form.interestRate) : null,
      monthlyPayment: form.monthlyPayment ? Number(form.monthlyPayment) : null,
      paymentSchedule: form.paymentSchedule || 'monthly',
      accountLast4: form.accountLast4 || '',
      notes: form.notes || '',
    };
    setLedger([...ledger, entry]);
    setForm({ creditor: '', balance: '', interestRate: '', monthlyPayment: '', paymentSchedule: 'monthly', accountLast4: '', notes: '' });
    setAdding(false);
  };

  const removeCreditor = (i) => {
    const next = [...ledger]; next.splice(i, 1); setLedger(next);
  };

  const updateCreditor = (i, field, value) => {
    const next = [...ledger]; next[i] = { ...next[i], [field]: value }; setLedger(next);
  };

  const totalBalance = ledger.reduce((s, c) => s + (c.balance || 0), 0);
  const totalPayment = ledger.reduce((s, c) => s + (c.monthlyPayment || 0), 0);
  const avgRate = ledger.length > 0 ? (ledger.reduce((s, c) => s + (c.interestRate || 0), 0) / ledger.length).toFixed(1) : 0;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>${totalBalance.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Balance</div>
        </div>
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#60a5fa', fontSize: '18px', fontWeight: 'bold' }}>${totalPayment.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Monthly Payments</div>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 'bold' }}>{avgRate}%</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Avg Interest Rate</div>
        </div>
      </div>

      {/* Add creditor form */}
      {adding ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>+ Add Creditor</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={ls}>Creditor Name</label><input value={form.creditor} onChange={e => setForm(p => ({ ...p, creditor: e.target.value }))} placeholder="Chase Sapphire" style={inp} /></div>
            <div><label style={ls}>Account Last 4</label><input value={form.accountLast4} onChange={e => setForm(p => ({ ...p, accountLast4: e.target.value }))} placeholder="1234" style={inp} /></div>
            <div><label style={ls}>Balance ($)</label><input type="number" value={form.balance} onChange={e => setForm(p => ({ ...p, balance: e.target.value }))} placeholder="8500" style={inp} /></div>
            <div><label style={ls}>Interest Rate (%)</label><input type="number" step="0.01" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))} placeholder="24.99" style={inp} /></div>
            <div><label style={ls}>Monthly Payment ($)</label><input type="number" value={form.monthlyPayment} onChange={e => setForm(p => ({ ...p, monthlyPayment: e.target.value }))} placeholder="250" style={inp} /></div>
            <div><label style={ls}>Payment Schedule</label><select value={form.paymentSchedule} onChange={e => setForm(p => ({ ...p, paymentSchedule: e.target.value }))} style={inp}><option value="monthly">Monthly</option><option value="biweekly">Bi-weekly</option><option value="weekly">Weekly</option><option value="irregular">Irregular</option><option value="past_due">Past Due</option></select></div>
          </div>
          <div style={{ marginBottom: '10px' }}><label style={ls}>Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Behind 3 months, collections calls" style={inp} /></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addCreditor} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Add</button>
            <button onClick={() => setAdding(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'rgba(16,185,129,0.08)', color: GOLD, border: '1px dashed rgba(16,185,129,0.3)', borderRadius: '4px', padding: '10px', cursor: 'pointer', fontSize: '12px', marginBottom: '12px' }}>+ Add Creditor to Ledger</button>
      )}

      {/* Creditor list */}
      {ledger.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No creditors in ledger yet. Add creditors manually or they\'ll auto-populate from the live call transcript.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ledger.map((c, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <input value={c.creditor || ''} onChange={e => updateCreditor(i, 'creditor', e.target.value)} style={{ background: 'none', border: 'none', color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', outline: 'none', flex: 1 }} />
                <button onClick={() => removeCreditor(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div><label style={{ ...ls, fontSize: '8px' }}>Balance</label><input type="number" value={c.balance ?? ''} onChange={e => updateCreditor(i, 'balance', e.target.value ? Number(e.target.value) : null)} style={inp} /></div>
                <div><label style={{ ...ls, fontSize: '8px' }}>Rate (%)</label><input type="number" step="0.01" value={c.interestRate ?? ''} onChange={e => updateCreditor(i, 'interestRate', e.target.value ? Number(e.target.value) : null)} style={inp} /></div>
                <div><label style={{ ...ls, fontSize: '8px' }}>Payment</label><input type="number" value={c.monthlyPayment ?? ''} onChange={e => updateCreditor(i, 'monthlyPayment', e.target.value ? Number(e.target.value) : null)} style={inp} /></div>
                <div><label style={{ ...ls, fontSize: '8px' }}>Schedule</label><select value={c.paymentSchedule || 'monthly'} onChange={e => updateCreditor(i, 'paymentSchedule', e.target.value)} style={inp}><option value="monthly">Monthly</option><option value="biweekly">Bi-weekly</option><option value="weekly">Weekly</option><option value="irregular">Irregular</option><option value="past_due">Past Due</option></select></div>
              </div>
              {c.accountLast4 && <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>Account ending in {c.accountLast4}</div>}
              {c.notes && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>{c.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}