/**
 * ClientProfileModal.jsx — Full client profile panel with tabs:
 * Overview | Debt (credit report + utilization) | Bills (monthly expenses + income) | Calculator
 * Floating, draggable, resizable (8-way) via usePopOutPanel — opens from the lead card.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import DoNothingCalculator from '@/components/debt/DoNothingCalculator';
import NextCallBriefing from '@/components/debt/NextCallBriefing';
import CallAnalysisDiagram from '@/components/debt/CallAnalysisDiagram';
import ClosingTab from '@/components/debt/closing/ClosingTab';
import { setProfileTimer, cancelProfileTimer, getActiveTimer } from '@/components/debt/ProfileTimerWatcher';
import LeadActivityTab from '@/components/debt/LeadActivityTab';
import DebtCallBar from '@/components/debt/DebtCallBar';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const BILL_CATEGORIES = [
  { key: 'rent', label: 'Rent / Mortgage', icon: '🏠' },
  { key: 'auto', label: 'Auto Payment', icon: '🚗' },
  { key: 'autoInsurance', label: 'Auto Insurance', icon: '🛡️' },
  { key: 'gas', label: 'Gas', icon: '⛽' },
  { key: 'groceries', label: 'Groceries', icon: '🛒' },
  { key: 'utilities', label: 'Utilities', icon: '💡' },
  { key: 'phone', label: 'Phone', icon: '📱' },
  { key: 'internet', label: 'Internet', icon: '🌐' },
  { key: 'studentLoans', label: 'Student Loans', icon: '🎓' },
  { key: 'healthInsurance', label: 'Health Insurance', icon: '⚕️' },
  { key: 'childcare', label: 'Childcare', icon: '👶' },
  { key: 'misc', label: 'Miscellaneous', icon: '📦' },
];

const TABS = [
  { id: 'overview', label: '📋 Overview' },
  { id: 'activity', label: '📋 Activity' },
  { id: 'debt', label: '💳 Debt' },
  { id: 'bills', label: '🧾 Bills' },
  { id: 'insights', label: '🔍 Insights' },
  { id: 'cosigners', label: '👥 Co-Signers' },
  { id: 'hardship', label: '⚠️ Hardship' },
  { id: 'qa', label: '❓ Q&A' },
  { id: 'transcripts', label: '📝 Transcripts' },
  { id: 'credit_report', label: '📷 Credit Report' },
  { id: 'closing', label: '🏁 Closing' },
  { id: 'calculator', label: '📊 Calculator' },
];

export default function ClientProfileModal({ lead, username, onClose, onSave }) {
  const [tab, setTab] = useState('overview');
  const [local, setLocal] = useState(lead || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [timerInput, setTimerInput] = useState({ hours: 0, minutes: 30 });
  const [activeTimer, setActiveTimer] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [qaHistory, setQaHistory] = useState([]);
  const [creditPhotoUrl, setCreditPhotoUrl] = useState(null);
  const [creditPhotoLoading, setCreditPhotoLoading] = useState(false);
  const [callTranscripts, setCallTranscripts] = useState([]);
  const [expandedTranscript, setExpandedTranscript] = useState(null);
  const [showLiveTranscript, setShowLiveTranscript] = useState(true);
  const [insights, setInsights] = useState([]);
  const [expandedInsight, setExpandedInsight] = useState(null);
  const [locationResearch, setLocationResearch] = useState(null);
  const [locationResearching, setLocationResearching] = useState(false);
  const [dobResearch, setDobResearch] = useState(null);
  const [dobResearching, setDobResearching] = useState(false);
  const panel = usePopOutPanel('client_profile', { width: 900, height: 700 }, username, 15000);

  // Load Q&A history for this lead
  useEffect(() => {
    if (!lead?.id) { setQaHistory([]); return; }
    base44.entities.DebtQAHistory.filter({ leadId: lead.id }, '-askedAt', 200)
      .then(rows => setQaHistory(rows || []))
      .catch(() => setQaHistory([]));
  }, [lead?.id]);

  // Load all call transcripts for this lead
  useEffect(() => {
    if (!lead?.id) { setCallTranscripts([]); return; }
    base44.entities.DebtCallTranscript.filter({ leadId: lead.id }, '-callDate', 100)
      .then(rows => setCallTranscripts(rows || []))
      .catch(() => setCallTranscripts([]));
  }, [lead?.id]);

  // Load customer insights for this lead
  useEffect(() => {
    if (!lead?.id) { setInsights([]); return; }
    base44.entities.CustomerInsight.filter({ leadId: lead.id }, '-created_date', 200)
      .then(rows => setInsights(rows || []))
      .catch(() => setInsights([]));
  }, [lead?.id]);

  // Parse the auto-saved live transcript from the lead record
  const liveTranscriptLines = useMemo(() => {
    if (!lead?.transcriptJson) return [];
    try { return JSON.parse(lead.transcriptJson); } catch { return []; }
  }, [lead?.transcriptJson]);

  // Load credit report photo signed URL
  useEffect(() => {
    if (!lead?.creditReportPhotoUri) { setCreditPhotoUrl(null); return; }
    setCreditPhotoLoading(true);
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: lead.creditReportPhotoUri, expires_in: 3600 })
      .then(res => setCreditPhotoUrl(res?.signed_url || null))
      .catch(() => setCreditPhotoUrl(null))
      .finally(() => setCreditPhotoLoading(false));
  }, [lead?.creditReportPhotoUri]);

  useEffect(() => { setLocal(lead || {}); }, [lead]);

  // Load active timer for this lead
  useEffect(() => {
    if (!lead?.id) return;
    const check = () => setActiveTimer(getActiveTimer(username, lead.id));
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [lead?.id]);

  // Tick for countdown display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSetTimer = () => {
    if (!local.id) return;
    if (setProfileTimer(username, local, timerInput.hours, timerInput.minutes)) {
      setActiveTimer(getActiveTimer(username, local.id));
    } else {
      alert('Please set at least 1 minute.');
    }
  };

  const handleCancelTimer = () => {
    if (local.id) { cancelProfileTimer(username, local.id); setActiveTimer(null); }
  };

  const update = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  const handleLocationResearch = async () => {
    const loc = [local.city, local.state].filter(Boolean).join(', ');
    if (!loc) return;
    setLocationResearching(true);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { mode: 'research_insight', insightType: 'location', insightText: loc });
      setLocationResearch(res?.research || res?.data?.research || null);
    } catch { setLocationResearch(null); }
    setLocationResearching(false);
  };

  const dobResearchedRef = useRef(null);
  const handleDobResearch = async () => {
    if (!local.dateOfBirth) return;
    const birthYear = new Date(local.dateOfBirth).getFullYear();
    if (!birthYear) return;
    dobResearchedRef.current = local.dateOfBirth;
    setDobResearching(true);
    try {
      const res = await base44.functions.invoke('liveAssistantAI', { mode: 'birth_year_research', birthYear });
      setDobResearch(res?.research || res?.data?.research || null);
    } catch { setDobResearch(null); }
    setDobResearching(false);
  };

  useEffect(() => {
    if (local.dateOfBirth && dobResearchedRef.current !== local.dateOfBirth && !dobResearching) {
      handleDobResearch();
    }
  }, [local.dateOfBirth]);

  const ledger = useMemo(() => { try { return JSON.parse(local.debtLedgerJson || '[]'); } catch { return []; } }, [local]);
  const bills = useMemo(() => { try { return JSON.parse(local.billsJson || '{}'); } catch { return {}; } }, [local]);

  // Credit utilization
  const totalBalance = ledger.reduce((s, c) => s + (c.balance || 0), 0);
  const totalLimit = ledger.reduce((s, c) => s + (c.creditLimit || 0), 0);
  const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
  const totalMonthlyPayments = ledger.reduce((s, c) => s + (c.monthlyPayment || 0), 0);
  const totalBills = Object.values(bills).reduce((s, v) => s + (Number(v) || 0), 0);
  const monthlyIncome = local.monthlyIncome || 0;
  const disposableIncome = monthlyIncome - totalBills - totalMonthlyPayments;

  // Debt-to-Income ratio (monthly debt payments / monthly income)
  const dti = monthlyIncome > 0 ? (totalMonthlyPayments / monthlyIncome) * 100 : 0;

  // Annual interest charges on total debt owed
  const annualInterest = ledger.reduce((s, c) => s + ((c.balance || 0) * ((c.interestRate || 0) / 100)), 0);
  const monthlyInterest = annualInterest / 12;
  // Payment needed each month to cover interest AND lower principal by the minimum payment amount
  const paymentToLowerPrincipal = monthlyInterest + totalMonthlyPayments;

  const save = async () => {
    if (!local.id) return;
    setSaving(true);
    try {
      await base44.entities.DebtLead.update(local.id, {
        firstName: local.firstName, lastName: local.lastName, phone: local.phone, email: local.email,
        address: local.address, city: local.city, state: local.state, zip: local.zip, dateOfBirth: local.dateOfBirth,
        debtAmount: local.debtAmount, creditorCount: local.creditorCount, creditors: local.creditors,
        debtLedgerJson: local.debtLedgerJson, billsJson: local.billsJson,
        employmentStatus: local.employmentStatus, monthlyIncome: local.monthlyIncome,
        creditScore: local.creditScore, behindOnPayments: local.behindOnPayments,
        monthsBehind: local.monthsBehind, notes: local.notes,
        hardshipWhen: local.hardshipWhen, hardshipWhy: local.hardshipWhy, hardshipHow: local.hardshipHow,
        cosignersJson: local.cosignersJson,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onSave?.(local);
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  return (
    <div style={{ ...panel.floatingStyle, background: '#0a0f1e', border: `1px solid ${GOLD}44`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}>
      {/* Header — draggable */}
      <div onMouseDown={panel.onDragStart} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `linear-gradient(135deg,${GOLD},#22c55e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0f1e', fontSize: '15px', fontWeight: 'bold', flexShrink: 0, textTransform: 'uppercase' }}>
            {(local.firstName?.[0] || '?')}{(local.lastName?.[0] || '')}
          </div>
          <div>
            <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>{local.firstName || 'New'} {local.lastName || 'Lead'}</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ padding: '1px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', background: local.status === 'enrolled' ? 'rgba(16,185,129,0.15)' : local.status === 'qualified' ? 'rgba(96,165,250,0.15)' : local.status === 'declined' ? 'rgba(239,68,68,0.15)' : 'rgba(138,154,184,0.15)', color: local.status === 'enrolled' ? GOLD : local.status === 'qualified' ? '#60a5fa' : local.status === 'declined' ? '#ef4444' : '#8a9ab8' }}>{local.status || 'new'}</span>
              {local.leadNumber && <span style={{ color: '#6b7280', fontSize: '10px' }}>{local.leadNumber}</span>}
              {local.callCount > 0 && <span style={{ color: '#6b7280', fontSize: '10px' }}>· {local.callCount} call{local.callCount !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={save} disabled={saving || !local.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '7px 16px', cursor: saving || !local.id ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: saving || !local.id ? 0.5 : 1 }}>
            {saving ? '⏳' : '💾 Save'}
          </button>
          {saved && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Timer + Call bar — compact single row */}
      <div style={{ padding: '6px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', background: 'rgba(0,0,0,0.15)' }}>
        <span style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>⏰</span>
        {activeTimer ? (
          <>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold' }}>{Math.floor((activeTimer.fireAt - now) / 60000)}m {Math.floor(((activeTimer.fireAt - now) % 60000) / 1000)}s</span>
            <button onClick={handleCancelTimer} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>Cancel</button>
          </>
        ) : (
          <>
            <input type="number" min="0" max="23" value={timerInput.hours} onChange={e => setTimerInput(p => ({ ...p, hours: Number(e.target.value) }))} style={{ width: '34px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '3px 4px', color: '#e8e0d0', fontSize: '11px', outline: 'none', textAlign: 'center' }} />
            <span style={{ color: '#6b7280', fontSize: '10px' }}>h</span>
            <input type="number" min="0" max="59" value={timerInput.minutes} onChange={e => setTimerInput(p => ({ ...p, minutes: Number(e.target.value) }))} style={{ width: '34px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '3px 4px', color: '#e8e0d0', fontSize: '11px', outline: 'none', textAlign: 'center' }} />
            <span style={{ color: '#6b7280', fontSize: '10px' }}>m</span>
            <button onClick={handleSetTimer} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>Set</button>
          </>
        )}
        <div style={{ flex: 1, minWidth: '120px' }}>
          <DebtCallBar lead={local} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {tab === 'activity' && <LeadActivityTab lead={local} />}

        {tab === 'hardship' && (
          <div>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>⚠️ Hardship Details</div>
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px' }}>
              Document the financial hardship that led this customer to seek debt settlement. This auto-populates from the call transcript when the customer discusses their situation.
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={ls}>When did the hardship start?</label>
              <textarea value={local.hardshipWhen || ''} onChange={e => update('hardshipWhen', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="e.g., Lost my job 6 months ago, medical emergency in January, divorce finalized last year..." />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={ls}>Why did it happen?</label>
              <textarea value={local.hardshipWhy || ''} onChange={e => update('hardshipWhy', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="e.g., Company downsized and I was laid off, unexpected medical bills from a surgery, went through a divorce and lost my spouse's income..." />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={ls}>How did it impact their finances?</label>
              <textarea value={local.hardshipHow || ''} onChange={e => update('hardshipHow', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="e.g., Fell behind on credit card payments, had to use savings to cover rent, credit score dropped 100 points, started getting collection calls..." />
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <div>
            {/* Contact Info */}
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Contact Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div><label style={ls}>First Name</label><input value={local.firstName || ''} onChange={e => update('firstName', e.target.value)} style={inp} /></div>
              <div><label style={ls}>Last Name</label><input value={local.lastName || ''} onChange={e => update('lastName', e.target.value)} style={inp} /></div>
              <div><label style={ls}>Phone</label><input value={local.phone || ''} onChange={e => update('phone', e.target.value)} style={inp} /></div>
              <div><label style={ls}>Email</label><input value={local.email || ''} onChange={e => update('email', e.target.value)} style={inp} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={ls}>Address</label><input value={local.address || ''} onChange={e => update('address', e.target.value)} style={inp} /></div>
              <div><label style={ls}>City</label><input value={local.city || ''} onChange={e => update('city', e.target.value)} style={inp} /></div>
              <div><label style={ls}>State</label><input value={local.state || ''} onChange={e => update('state', e.target.value)} style={inp} /></div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}><label style={ls}>Zip</label><input value={local.zip || ''} onChange={e => update('zip', e.target.value)} style={inp} /></div>
                <button onClick={handleLocationResearch} disabled={!local.city || locationResearching} title="Search the internet for landmarks, restaurants, sports teams near this city" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: (!local.city || locationResearching) ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: (!local.city || locationResearching) ? 0.5 : 1 }}>
                  {locationResearching ? '⏳' : '🔍 More Info'}
                </button>
              </div>
              <div><label style={ls}>Date of Birth</label><input type="date" value={local.dateOfBirth || ''} onChange={e => update('dateOfBirth', e.target.value)} style={inp} /></div>
            </div>

            {/* Location Research Results */}
            {locationResearch && (
              <div style={{ marginBottom: '16px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>🔍 {local.city}, {local.state} — Area Research</div>
                <ResearchDisplay research={locationResearch} />
              </div>
            )}

            {/* DOB Research Results */}
            {(dobResearch || dobResearching) && local.dateOfBirth && (
              <div style={{ marginBottom: '16px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ color: '#a78bfa', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>🎂 Born in {new Date(local.dateOfBirth).getFullYear()} — Birth Year Research</div>
                {dobResearching ? <div style={{ color: '#6b7280', fontSize: '12px' }}>⏳ Searching the internet for {new Date(local.dateOfBirth).getFullYear()} facts…</div> : <ResearchDisplay research={dobResearch} />}
              </div>
            )}

            {/* Financial Info */}
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Financial Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={ls}>Employment Status</label>
                <select value={local.employmentStatus || ''} onChange={e => update('employmentStatus', e.target.value)} style={inp}>
                  <option value="">—</option>
                  <option value="employed">Employed</option>
                  <option value="self-employed">Self-Employed</option>
                  <option value="unemployed">Unemployed</option>
                  <option value="retired">Retired</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div><label style={ls}>Monthly Income ($)</label><input type="number" value={local.monthlyIncome ?? ''} onChange={e => update('monthlyIncome', e.target.value ? Number(e.target.value) : null)} style={inp} /></div>
              <div><label style={ls}>Credit Score</label><input type="number" value={local.creditScore ?? ''} onChange={e => update('creditScore', e.target.value ? Number(e.target.value) : null)} style={inp} /></div>
              <div>
                <label style={ls}>Behind on Payments</label>
                <select value={local.behindOnPayments ? 'yes' : 'no'} onChange={e => update('behindOnPayments', e.target.value === 'yes')} style={inp}>
                  <option value="no">No — Current</option>
                  <option value="yes">Yes — Behind</option>
                </select>
              </div>
              <div><label style={ls}>Months Behind</label><input type="number" value={local.monthsBehind ?? ''} onChange={e => update('monthsBehind', e.target.value ? Number(e.target.value) : null)} style={inp} /></div>
              <div><label style={ls}>Total Debt ($)</label><input type="number" value={local.debtAmount ?? ''} onChange={e => update('debtAmount', e.target.value ? Number(e.target.value) : null)} style={inp} /></div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
              <StatBox label="Mo. Payments" value={`$${totalMonthlyPayments.toLocaleString()}`} color="#60a5fa" />
              <StatBox label="Mo. Bills" value={`$${totalBills.toLocaleString()}`} color="#f59e0b" />
              <StatBox label="Disposable" value={`$${Math.round(disposableIncome).toLocaleString()}`} color={disposableIncome > 0 ? '#4ade80' : '#ef4444'} />
              <StatBox label="DTI Ratio" value={monthlyIncome > 0 ? `${dti.toFixed(1)}%` : '—'} color={dti > 43 ? '#ef4444' : dti > 36 ? '#f59e0b' : '#4ade80'} />
            </div>

            {/* Notes */}
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Notes</div>
            <textarea value={local.notes || ''} onChange={e => update('notes', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="Add notes about this client..." />
          </div>
        )}

        {tab === 'insights' && (
          <InsightsTab insights={insights} expandedInsight={expandedInsight} setExpandedInsight={setExpandedInsight} lead={local} />
        )}

        {tab === 'cosigners' && <CosignersTab local={local} update={update} />}

        {tab === 'debt' && (
          <DebtTab ledger={ledger} totalBalance={totalBalance} totalLimit={totalLimit} utilization={utilization} totalMonthlyPayments={totalMonthlyPayments} annualInterest={annualInterest} monthlyInterest={monthlyInterest} paymentToLowerPrincipal={paymentToLowerPrincipal} local={local} update={update} />
        )}

        {tab === 'bills' && (
          <BillsTab bills={bills} local={local} update={update} totalBills={totalBills} totalMonthlyPayments={totalMonthlyPayments} disposableIncome={disposableIncome} />
        )}

        {tab === 'qa' && (
          <div>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>❓ Q&A History — {qaHistory.length} questions</div>
            {qaHistory.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No Q&A history for this customer yet. Questions asked during calls will appear here with timestamps.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {qaHistory.map((h, i) => (
                  <div key={h.id || i} style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: h.answer ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{ color: '#60a5fa', fontSize: '8px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '3px', padding: '1px 6px', textTransform: 'uppercase', fontWeight: 'bold', flexShrink: 0 }}>{h.source || 'auto'}</span>
                      <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0 }}>{h.askedAt ? new Date(h.askedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                      <span style={{ color: '#e8e0d0', fontSize: '12px', flex: 1, lineHeight: 1.4 }}>{h.question}</span>
                    </div>
                    {h.answer && <div style={{ padding: '8px 12px', color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>💡 {h.answer}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'transcripts' && (
          <div>
            {/* Auto-saved live transcript from the lead record */}
            {liveTranscriptLines.length > 0 && (
              <div style={{ marginBottom: '16px', background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                <button onClick={() => setShowLiveTranscript(p => !p)} style={{ width: '100%', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>{lead.lastCallAt ? new Date(lead.lastCallAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '2px', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0 }}>Latest Live</span>
                  <span style={{ color: '#6b7280', fontSize: '11px', flexShrink: 0 }}>{liveTranscriptLines.length} lines</span>
                  <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: 'auto' }}>{showLiveTranscript ? '−' : '+'}</span>
                </button>
                {showLiveTranscript && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px 14px' }}>
                      {liveTranscriptLines.map((msg, j) => {
                        const isAgent = msg.speaker === 0;
                        return (
                          <div key={j} style={{ marginBottom: '6px', display: 'flex', gap: '8px' }}>
                            <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0, minWidth: '50px' }}>{msg.time ? new Date(msg.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                            <span style={{ color: isAgent ? '#60a5fa' : '#10b981', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '60px' }}>{isAgent ? 'Agent' : 'Customer'}</span>
                            <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{msg.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📝 Saved Call Transcripts — {callTranscripts.length} calls</div>
            {callTranscripts.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No saved call transcripts yet. Transcripts are saved as a permanent record when a call ends properly.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {callTranscripts.map((ct, i) => {
                  const isOpen = expandedTranscript === ct.id;
                  let lines = [];
                  try { lines = JSON.parse(ct.transcriptJson || '[]'); } catch { lines = []; }
                  const duration = ct.durationSeconds ? `${Math.floor(ct.durationSeconds / 60)}m ${ct.durationSeconds % 60}s` : '—';
                  return (
                    <div key={ct.id || i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                      <button onClick={() => setExpandedTranscript(isOpen ? null : ct.id)} style={{ width: '100%', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>{ct.callDate ? new Date(ct.callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '2px', background: ct.callMode === 'close' ? 'rgba(16,185,129,0.12)' : 'rgba(96,165,250,0.12)', color: ct.callMode === 'close' ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0 }}>{ct.callMode || 'open'}</span>
                        <span style={{ color: '#6b7280', fontSize: '11px', flexShrink: 0 }}>{duration}</span>
                        {ct.intentScore != null && <span style={{ color: '#f472b6', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>Intent: {ct.intentScore}</span>}
                        <span style={{ color: '#4a5568', fontSize: '11px', flexShrink: 0 }}>{ct.transcriptLineCount || lines.length} lines</span>
                        <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: 'auto' }}>{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          {lines.length === 0 ? (
                            <div style={{ padding: '16px', color: '#4a5568', fontSize: '12px', textAlign: 'center' }}>No transcript lines recorded.</div>
                          ) : (
                            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px 14px' }}>
                              {lines.map((msg, j) => {
                                const isAgent = msg.speaker === 0;
                                return (
                                  <div key={j} style={{ marginBottom: '6px', display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0, minWidth: '50px' }}>{msg.time ? new Date(msg.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                                    <span style={{ color: isAgent ? '#60a5fa' : '#10b981', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '60px' }}>{isAgent ? 'Agent' : 'Customer'}</span>
                                    <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{msg.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {ct.callAnalysisJson && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 14px' }}>
                              <CallAnalysisDiagram analysisJson={ct.callAnalysisJson} durationSeconds={ct.durationSeconds} />
                            </div>
                          )}
                          {ct.followUpReport && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 14px', background: 'rgba(0,0,0,0.15)' }}>
                              <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📋 Follow-Up Report</div>
                              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ct.followUpReport}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'credit_report' && (
          <div>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📷 Credit Report Photo</div>
            {creditPhotoLoading ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>Loading credit report photo…</div>
            ) : creditPhotoUrl ? (
              <div>
                <img src={creditPhotoUrl} alt="Credit Report" style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                {local.creditReportAnalyzedAt && (
                  <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '8px' }}>Analyzed: {new Date(local.creditReportAnalyzedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                )}
              </div>
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>
                No credit report photo uploaded yet.
                <br /><br />
                <a href="/credit" style={{ color: GOLD, textDecoration: 'underline' }}>Upload one here →</a>
              </div>
            )}
          </div>
        )}

        {tab === 'closing' && (
          <ClosingTab lead={local} update={update} username={username} />
        )}

        {tab === 'calculator' && (
          <DoNothingCalculator lead={local} mode="close" />
        )}
      </div>
      {panel.resizeHandles}
    </div>
  );
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────
function InsightsTab({ insights, expandedInsight, setExpandedInsight, lead }) {
  const INSIGHT_TYPES = [
    { id: 'location', label: '📍 Location', color: '#60a5fa' },
    { id: 'occupation', label: '💼 Occupation', color: '#34d399' },
    { id: 'hobby', label: '🎯 Hobby', color: '#f472b6' },
    { id: 'family', label: '👨‍👩‍👧 Family', color: '#f59e0b' },
    { id: 'life_event', label: '🎉 Life Event', color: '#a78bfa' },
    { id: 'other', label: '📌 Other', color: '#8a9ab8' },
  ];

  const importantInsights = insights.filter(i => i.isImportant);
  const researchedInsights = insights.filter(i => i.isResearched);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🔍 Customer Insights — {insights.length} captured</div>
        <NextCallBriefing lead={lead} compact />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
          <div style={{ color: '#60a5fa', fontSize: '18px', fontWeight: 'bold' }}>{insights.length}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Insights</div>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
          <div style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 'bold' }}>{importantInsights.length}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Marked Important</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>{researchedInsights.length}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Researched</div>
        </div>
      </div>

      {/* Important insights first */}
      {importantInsights.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>★ Important Reminders</div>
          {importantInsights.map(ins => (
            <InsightRow key={ins.id} insight={ins} INSIGHT_TYPES={INSIGHT_TYPES} expanded={expandedInsight === ins.id} onToggle={() => setExpandedInsight(expandedInsight === ins.id ? null : ins.id)} />
          ))}
        </div>
      )}

      {/* All insights */}
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>All Insights</div>
      {insights.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>
          No insights captured yet. During a live call, the Customer Stats popup auto-detects personal details the customer mentions. You can also add insights manually from the popup.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {insights.map(ins => (
            <InsightRow key={ins.id} insight={ins} INSIGHT_TYPES={INSIGHT_TYPES} expanded={expandedInsight === ins.id} onToggle={() => setExpandedInsight(expandedInsight === ins.id ? null : ins.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightRow({ insight, INSIGHT_TYPES, expanded, onToggle }) {
  const typeInfo = INSIGHT_TYPES.find(t => t.id === insight.insightType) || INSIGHT_TYPES.find(t => t.id === 'other');
  const research = insight.researchJson ? (() => { try { return JSON.parse(insight.researchJson); } catch { return null; } })() : null;
  const smallTalk = insight.smallTalkQuestionsJson ? (() => { try { return JSON.parse(insight.smallTalkQuestionsJson); } catch { return []; } })() : [];
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${insight.isImportant ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <span style={{ padding: '2px 6px', borderRadius: '3px', background: `${typeInfo.color}18`, color: typeInfo.color, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0 }}>{typeInfo.label.split(' ')[1]}</span>
        {insight.isImportant && <span style={{ color: '#f59e0b', fontSize: '12px', flexShrink: 0 }}>★</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{insight.insightText}</div>
          <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>
            {insight.transcriptTimestamp ? new Date(insight.transcriptTimestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
            {insight.isResearched && ' · ✓ Researched'}
            {insight.createdBy && ` · by ${insight.createdBy}`}
          </div>
        </div>
        <span style={{ color: '#6b7280', fontSize: '12px', flexShrink: 0 }}>{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
          {/* Transcript link */}
          {insight.transcriptSnippet && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>💬 From Transcript</div>
              <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, fontStyle: 'italic', background: 'rgba(96,165,250,0.06)', padding: '6px 10px', borderRadius: '3px', border: '1px solid rgba(96,165,250,0.15)' }}>"{insight.transcriptSnippet}"</div>
            </div>
          )}
          {/* Research */}
          {research ? (
            <div>
              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>🔍 AI Research</div>
              {research.summary && <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, marginBottom: '8px' }}>{research.summary}</div>}
              {research.neighboringCities?.length > 0 && <InsightField label="Neighboring Cities" items={research.neighboringCities} color="#60a5fa" />}
              {research.landmarks?.length > 0 && <InsightField label="Landmarks" items={research.landmarks} color="#34d399" />}
              {research.famousRestaurants?.length > 0 && <InsightField label="Famous Restaurants" items={research.famousRestaurants} color="#f472b6" />}
              {research.population && <div style={{ marginBottom: '4px' }}><span style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Population: </span><span style={{ color: '#c4cdd8', fontSize: '11px' }}>{research.population}</span></div>}
              {research.sportsTeams?.length > 0 && <InsightField label="Sports Teams" items={research.sportsTeams} color="#f59e0b" />}
              {research.lastChampionship && <div style={{ marginBottom: '4px' }}><span style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Last Championship: </span><span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>{research.lastChampionship}</span></div>}
              {research.funFacts?.length > 0 && <InsightField label="Fun Facts" items={research.funFacts} color="#a78bfa" />}
              {research.conversationStarters?.length > 0 && <InsightField label="Conversation Starters" items={research.conversationStarters} color={GOLD} />}
              {research.commonChallenges?.length > 0 && <InsightField label="Common Challenges" items={research.commonChallenges} color="#ef4444" />}
              {research.relatedTopics?.length > 0 && <InsightField label="Related Topics" items={research.relatedTopics} color="#8a9ab8" />}
            </div>
          ) : (
            <div style={{ color: '#4a5568', fontSize: '11px' }}>Not researched yet. Use "Get More Info" in the Customer Stats popup during a call to research this insight.</div>
          )}
          {/* Small talk questions */}
          {smallTalk.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>💬 Small Talk Questions</div>
              {smallTalk.map((q, i) => <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, paddingLeft: '12px', position: 'relative' }}><span style={{ position: 'absolute', left: 0, color: GOLD }}>•</span> {q}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InsightField({ label, items, color }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
      {items.map((item, i) => (
        <div key={i} style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4, paddingLeft: '10px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, color }}>•</span> {item}
        </div>
      ))}
    </div>
  );
}

// ─── Co-Signers Tab ────────────────────────────────────────────────────────────
function CosignersTab({ local, update }) {
  const cosigners = (() => { try { return JSON.parse(local.cosignersJson || '[]'); } catch { return []; } })();
  const setCosigners = (next) => update('cosignersJson', JSON.stringify(next));

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', relationship: '', phone: '', email: '', accounts: '', employed: '', notes: '' });

  const addCosigner = () => {
    if (!form.name.trim()) return;
    setCosigners([...cosigners, { ...form, name: form.name.trim() }]);
    setForm({ name: '', relationship: '', phone: '', email: '', accounts: '', employed: '', notes: '' });
    setAdding(false);
  };

  const removeCosigner = (i) => { const next = [...cosigners]; next.splice(i, 1); setCosigners(next); };
  const updateCosigner = (i, field, val) => { const next = [...cosigners]; next[i] = { ...next[i], [field]: val }; setCosigners(next); };

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>👥 Co-Signers</div>
      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px' }}>
        Co-signers on the customer's accounts. These auto-populate from the call transcript when mentioned. Co-signers may need to be involved in the enrollment process.
      </div>

      {adding ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ color: '#60a5fa', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>+ Add Co-Signer</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={{ ...ls, fontSize: '8px' }}>Name</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" style={{ ...inp, fontSize: '12px' }} /></div>
            <div><label style={{ ...ls, fontSize: '8px' }}>Relationship</label><input value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} placeholder="Spouse, Parent, Sibling..." style={{ ...inp, fontSize: '12px' }} /></div>
            <div><label style={{ ...ls, fontSize: '8px' }}>Phone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" style={{ ...inp, fontSize: '12px' }} /></div>
            <div><label style={{ ...ls, fontSize: '8px' }}>Email</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@email.com" style={{ ...inp, fontSize: '12px' }} /></div>
            <div><label style={{ ...ls, fontSize: '8px' }}>Accounts Co-Signed</label><input value={form.accounts} onChange={e => setForm(p => ({ ...p, accounts: e.target.value }))} placeholder="Chase, Discover, Capital One..." style={{ ...inp, fontSize: '12px' }} /></div>
            <div><label style={{ ...ls, fontSize: '8px' }}>Employed?</label><input value={form.employed} onChange={e => setForm(p => ({ ...p, employed: e.target.value }))} placeholder="Yes — works at..., No, Retired..." style={{ ...inp, fontSize: '12px' }} /></div>
          </div>
          <div style={{ marginBottom: '10px' }}><label style={{ ...ls, fontSize: '8px' }}>Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="May need to be on the call for enrollment..." style={{ ...inp, fontSize: '12px' }} /></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addCosigner} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Add</button>
            <button onClick={() => setAdding(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: '1px dashed rgba(96,165,250,0.3)', borderRadius: '4px', padding: '10px', cursor: 'pointer', fontSize: '12px', marginBottom: '12px' }}>+ Add Co-Signer</button>
      )}

      {cosigners.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No co-signers recorded yet. They'll auto-populate from the call transcript when the customer mentions them.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {cosigners.map((c, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '4px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <input value={c.name || ''} onChange={e => updateCosigner(i, 'name', e.target.value)} style={{ background: 'none', border: 'none', color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', outline: 'none', flex: 1 }} />
                <button onClick={() => removeCosigner(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div><label style={{ ...ls, fontSize: '8px' }}>Relationship</label><input value={c.relationship || ''} onChange={e => updateCosigner(i, 'relationship', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                <div><label style={{ ...ls, fontSize: '8px' }}>Phone</label><input value={c.phone || ''} onChange={e => updateCosigner(i, 'phone', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                <div><label style={{ ...ls, fontSize: '8px' }}>Email</label><input value={c.email || ''} onChange={e => updateCosigner(i, 'email', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ ...ls, fontSize: '8px' }}>Accounts Co-Signed</label><input value={c.accounts || ''} onChange={e => updateCosigner(i, 'accounts', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                <div><label style={{ ...ls, fontSize: '8px' }}>Employed</label><input value={c.employed || ''} onChange={e => updateCosigner(i, 'employed', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ ...ls, fontSize: '8px' }}>Notes</label><input value={c.notes || ''} onChange={e => updateCosigner(i, 'notes', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Debt Tab ─────────────────────────────────────────────────────────────────
function DebtTab({ ledger, totalBalance, totalLimit, utilization, totalMonthlyPayments, annualInterest, monthlyInterest, paymentToLowerPrincipal, local, update }) {
  const setLedger = (newLedger) => update('debtLedgerJson', JSON.stringify(newLedger));

  const updateCreditor = (i, field, value) => {
    const next = [...ledger]; next[i] = { ...next[i], [field]: value }; setLedger(next);
  };
  const addCreditor = () => setLedger([...ledger, { creditor: 'New Creditor', balance: 0, creditLimit: 0, interestRate: 0, monthlyPayment: 0 }]);
  const removeCreditor = (i) => { const next = [...ledger]; next.splice(i, 1); setLedger(next); };

  const utilColor = utilization > 50 ? '#ef4444' : utilization > 30 ? '#f59e0b' : '#4ade80';

  return (
    <div>
      {/* Credit Utilization */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
          <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: 'bold' }}>${totalBalance.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Balance</div>
        </div>
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
          <div style={{ color: '#60a5fa', fontSize: '20px', fontWeight: 'bold' }}>${totalLimit.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Credit Limit</div>
        </div>
        <div style={{ background: `${utilColor}11`, border: `1px solid ${utilColor}33`, borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
          <div style={{ color: utilColor, fontSize: '20px', fontWeight: 'bold' }}>{utilization.toFixed(1)}%</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Credit Utilization</div>
          {totalLimit > 0 && (
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, utilization)}%`, height: '100%', background: utilColor, borderRadius: '2px' }} />
            </div>
          )}
        </div>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>${totalMonthlyPayments.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Monthly Payments</div>
        </div>
      </div>

      {/* Interest & principal-lowering calculations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '14px' }}>
          <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: 'bold' }}>${Math.round(annualInterest).toLocaleString()}<span style={{ fontSize: '12px', color: '#8a9ab8' }}> / yr</span></div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Annual Interest Charges</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '6px' }}>${Math.round(monthlyInterest).toLocaleString()}/mo in interest alone — principal barely moves</div>
        </div>
        <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '14px' }}>
          <div style={{ color: '#60a5fa', fontSize: '20px', fontWeight: 'bold' }}>${Math.round(paymentToLowerPrincipal).toLocaleString()}<span style={{ fontSize: '12px', color: '#8a9ab8' }}> / mo</span></div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Payment to Lower Principal</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '6px' }}>Covers interest + drops principal by ${totalMonthlyPayments.toLocaleString()}/mo</div>
        </div>
      </div>

      {/* Creditor list from credit report */}
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>💳 Credit Report — All Debts</div>
      {ledger.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No debts recorded yet. Debts auto-populate from the call transcript or add manually.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ledger.map((c, i) => {
            const cUtil = c.creditLimit > 0 ? ((c.balance / c.creditLimit) * 100).toFixed(0) : '—';
            const cUtilColor = c.creditLimit > 0 ? (c.balance / c.creditLimit > 0.5 ? '#ef4444' : '#4ade80') : '#6b7280';
            return (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <input value={c.creditor || ''} onChange={e => updateCreditor(i, 'creditor', e.target.value)} style={{ background: 'none', border: 'none', color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', outline: 'none', flex: 1 }} />
                  <span style={{ color: cUtilColor, fontSize: '11px', fontWeight: 'bold', marginRight: '8px' }}>{cUtil}% util</span>
                  <button onClick={() => removeCreditor(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  <div><label style={{ ...ls, fontSize: '8px' }}>Balance</label><input type="number" value={c.balance ?? ''} onChange={e => updateCreditor(i, 'balance', e.target.value ? Number(e.target.value) : null)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                  <div><label style={{ ...ls, fontSize: '8px' }}>Credit Limit</label><input type="number" value={c.creditLimit ?? ''} onChange={e => updateCreditor(i, 'creditLimit', e.target.value ? Number(e.target.value) : null)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                  <div><label style={{ ...ls, fontSize: '8px' }}>Rate (%)</label><input type="number" step="0.01" value={c.interestRate ?? ''} onChange={e => updateCreditor(i, 'interestRate', e.target.value ? Number(e.target.value) : null)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                  <div><label style={{ ...ls, fontSize: '8px' }}>Min Payment</label><input type="number" value={c.monthlyPayment ?? ''} onChange={e => updateCreditor(i, 'monthlyPayment', e.target.value ? Number(e.target.value) : null)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                  <div><label style={{ ...ls, fontSize: '8px' }}>Last 4</label><input value={c.accountLast4 || ''} onChange={e => updateCreditor(i, 'accountLast4', e.target.value)} style={{ ...inp, fontSize: '12px', padding: '6px 8px' }} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button onClick={addCreditor} style={{ width: '100%', marginTop: '10px', background: 'rgba(16,185,129,0.08)', color: GOLD, border: '1px dashed rgba(16,185,129,0.3)', borderRadius: '4px', padding: '10px', cursor: 'pointer', fontSize: '12px' }}>+ Add Debt from Credit Report</button>
    </div>
  );
}

// ─── Bills Tab ───────────────────────────────────────────────────────────────
function BillsTab({ bills, local, update, totalBills, totalMonthlyPayments, disposableIncome }) {
  const setBills = (key, val) => update('billsJson', JSON.stringify({ ...bills, [key]: val ? Number(val) : 0 }));

  return (
    <div>
      {/* Income summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
          <div style={{ color: '#4ade80', fontSize: '20px', fontWeight: 'bold' }}>${(local.monthlyIncome || 0).toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Monthly Income</div>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
          <div style={{ color: '#f59e0b', fontSize: '20px', fontWeight: 'bold' }}>${totalBills.toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Total Monthly Bills</div>
        </div>
        <div style={{ background: `${disposableIncome > 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)'}`, border: `1px solid ${disposableIncome > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
          <div style={{ color: disposableIncome > 0 ? GOLD : '#ef4444', fontSize: '20px', fontWeight: 'bold' }}>${Math.round(disposableIncome).toLocaleString()}</div>
          <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Disposable Income</div>
          <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '4px' }}>after bills + debt payments</div>
        </div>
      </div>

      {/* Income input */}
      <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={ls}>Monthly Income (After Tax) ($)</label>
          <input type="number" value={local.monthlyIncome ?? ''} onChange={e => update('monthlyIncome', e.target.value ? Number(e.target.value) : null)} style={inp} placeholder="3500" />
        </div>
        <div>
          <label style={ls}>Employment Status</label>
          <select value={local.employmentStatus || ''} onChange={e => update('employmentStatus', e.target.value)} style={inp}>
            <option value="">— Select —</option>
            <option value="employed">Employed</option>
            <option value="self-employed">Self-Employed</option>
            <option value="unemployed">Unemployed</option>
            <option value="retired">Retired</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Bill categories */}
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>🧾 Monthly Bills / Expenses</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        {BILL_CATEGORIES.map(cat => (
          <div key={cat.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '10px' }}>
            <label style={{ ...ls, marginBottom: '4px' }}>{cat.icon} {cat.label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>$</span>
              <input type="number" value={bills[cat.key] ?? ''} onChange={e => setBills(cat.key, e.target.value)} style={{ ...inp, fontSize: '13px', padding: '6px 8px' }} placeholder="0" />
            </div>
          </div>
        ))}
        {/* Custom bill fields — AI can create these from the transcript */}
        {Object.keys(bills).filter(k => !BILL_CATEGORIES.some(c => c.key === k)).map(customKey => (
          <div key={customKey} style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '10px' }}>
            <label style={{ ...ls, marginBottom: '4px', color: '#a78bfa' }}>📦 {customKey.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>$</span>
              <input type="number" value={bills[customKey] ?? ''} onChange={e => setBills(customKey, e.target.value)} style={{ ...inp, fontSize: '13px', padding: '6px 8px' }} placeholder="0" />
              <button onClick={() => { const next = { ...bills }; delete next[customKey]; update('billsJson', JSON.stringify(next)); }} title="Remove custom field" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add custom bill field */}
      <AddCustomBillField bills={bills} update={update} />

      <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', color: '#6b7280', fontSize: '11px' }}>
        💡 Bills auto-populate from the call transcript when the agent reviews expenses with the customer. Custom bill types the customer mentions are auto-created by AI.
      </div>
    </div>
  );
}

// ─── Add Custom Bill Field ────────────────────────────────────────────────────
function AddCustomBillField({ bills, update }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const add = () => {
    if (!name.trim()) return;
    const key = name.trim().replace(/[^a-zA-Z0-9]/g, '').replace(/^./, c => c.toLowerCase());
    if (!key || bills[key] !== undefined) { setAdding(false); setName(''); setAmount(''); return; }
    const next = { ...bills, [key]: amount ? Number(amount) : 0 };
    update('billsJson', JSON.stringify(next));
    setAdding(false); setName(''); setAmount('');
  };

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} style={{ width: '100%', marginTop: '10px', background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px dashed rgba(167,139,250,0.3)', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '11px' }}>+ Add Custom Bill</button>
    );
  }
  return (
    <div style={{ marginTop: '10px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Bill name (e.g. Gym, Storage, Alimony)" style={{ ...inp, fontSize: '12px', flex: 1 }} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: '#6b7280', fontSize: '13px' }}>$</span>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ ...inp, fontSize: '12px', width: '80px', padding: '6px 8px' }} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
      </div>
      <button onClick={add} style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Add</button>
      <button onClick={() => { setAdding(false); setName(''); setAmount(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px' }}>✕</button>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function ResearchDisplay({ research }) {
  if (!research) return null;
  const List = ({ label, items }) => items && items.length > 0 ? (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: '16px' }}>
        {items.map((item, i) => <li key={i} style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{item}</li>)}
      </ul>
    </div>
  ) : null;
  const Field = ({ label, value }) => value ? (
    <div style={{ marginBottom: '4px' }}>
      <span style={{ color: '#8a9ab8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}: </span>
      <span style={{ color: '#c4cdd8', fontSize: '12px' }}>{value}</span>
    </div>
  ) : null;
  return (
    <div>
      {research.summary && <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.6, marginBottom: '8px', fontStyle: 'italic' }}>{research.summary}</div>}
      <Field label="President" value={research.president} />
      {research.wasElectionYear !== undefined && <Field label="Election Year" value={research.wasElectionYear ? 'Yes' : 'No'} />}
      <Field label="Population" value={research.population} />
      <Field label="Last Championship" value={research.lastChampionship} />
      <List label="Inventions" items={research.inventions} />
      <List label="Major Events" items={research.majorEvents} />
      <List label="Pop Culture" items={research.popCulture} />
      <List label="Landmarks" items={research.landmarks} />
      <List label="Famous Restaurants" items={research.famousRestaurants} />
      <List label="Sports Teams" items={research.sportsTeams} />
      <List label="Neighboring Cities" items={research.neighboringCities} />
      <List label="Fun Facts" items={research.funFacts} />
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}