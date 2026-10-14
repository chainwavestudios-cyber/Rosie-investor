/**
 * AIAgentDialer.jsx — Lead dialer for the AI Fronting Agent.
 * Upload a CSV of leads (or enter a manual number for testing), and the AI
 * agent dials through them one by one. Each lead gets a prospect contact card
 * created automatically.
 */
import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { checkCallCutoff, getTzLabel, getLocalTimeString } from '@/lib/phoneTimeZone';
import callError from '@/components/fronter/callError';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const GREEN = '#4ade80';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function AIAgentDialer({ adminUsername }) {
  const [queue, setQueue] = useState([]);
  const [dialing, setDialing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState({ firstName: '', lastName: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [overrideCutoff, setOverrideCutoff] = useState(false);
  const fileRef = useRef(null);

  // ── CSV parsing ──
  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const leads = [];
    // Check if first line is a header
    const firstParts = lines[0].split(',').map(p => p.trim().toLowerCase());
    const hasHeader = firstParts.some(p => p.includes('name') || p.includes('phone') || p.includes('first'));
    const startIdx = hasHeader ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length >= 1 && parts[0]) {
        leads.push({
          firstName: parts[0] || '',
          lastName: parts[1] || '',
          phone: parts[2] || '',
          city: parts[3] || '',
          state: parts[4] || '',
          debtAmount: parts[5] ? parseFloat(parts[5].replace(/[^0-9.]/g, '')) || 0 : 0,
          status: 'pending',
        });
      }
    }
    return leads;
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const leads = parseCSV(text);
      if (leads.length === 0) { setError('No leads found in file.'); return; }
      setQueue(leads);
      setStatus(`Loaded ${leads.length} leads from ${file.name}. Click "Start Dialing" to begin.`);
    } catch (e) { setError('Failed to parse file: ' + (e?.message || String(e))); }
  };

  // ── Manual dial ──
  const manualDial = async () => {
    if (!manualPhone.trim()) return;
    setError(''); 
    // Pre-check 8pm cutoff before dialing (unless override is on)
    if (!overrideCutoff) {
      const cutoff = checkCallCutoff(manualPhone.trim());
      if (cutoff.blocked) {
        setError(cutoff.localHour >= 20
          ? `🚫 ${cutoff.localTime} ${cutoff.tzLabel} — past 8pm in this number's time zone. No calls after 8pm.`
          : `🚫 ${cutoff.localTime} ${cutoff.tzLabel} — before 8am in this number's time zone.`);
        return;
      }
    }
    setStatus('Dialing...');
    try {
      const res = await base44.functions.invoke('aiAgentDial', {
        action: 'startDial',
        phone: manualPhone.trim(),
        firstName: manualName.firstName || 'Test',
        lastName: manualName.lastName || 'Lead',
        adminUsername,
        overrideCutoff,
      });
      const data = res?.data || res;
      if (data?.ok) {
        setStatus(`✓ Call initiated to ${manualPhone} (Call SID: ${data.callSid?.slice(0, 12)}…)`);
        setQueue(prev => [...prev, {
          firstName: manualName.firstName || 'Test',
          lastName: manualName.lastName || 'Lead',
          phone: manualPhone,
          status: 'dialing',
          callSid: data.callSid,
          leadId: data.leadId,
        }]);
      } else {
        setError(data?.error || 'Dial failed');
        setStatus('');
      }
    } catch (e) { setError('Dial failed: ' + callError(e)); setStatus(''); }
  };

  // ── Sequential dialing ──
  const startDialing = async () => {
    if (queue.length === 0) return;
    setDialing(true);
    setError('');

    for (let i = 0; i < queue.length; i++) {
      const lead = queue[i];
      if (!lead.phone) continue;

      // Pre-check 8pm cutoff — skip blocked numbers
      const cutoff = checkCallCutoff(lead.phone);
      if (cutoff.blocked) {
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'blocked', error: `${cutoff.localTime} ${cutoff.tzLabel} — past 8pm` } : q));
        continue;
      }

      setCurrentIdx(i);
      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'dialing' } : q));
      setStatus(`Dialing ${lead.firstName} ${lead.lastName} at ${lead.phone}…`);

      try {
        const res = await base44.functions.invoke('aiAgentDial', {
          action: 'startDial',
          phone: lead.phone,
          firstName: lead.firstName,
          lastName: lead.lastName,
          city: lead.city,
          state: lead.state,
          debtAmount: lead.debtAmount,
          adminUsername,
        });
        const data = res?.data || res;
        if (data?.ok) {
          setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'dialed', callSid: data.callSid, leadId: data.leadId } : q));
        } else {
          setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed', error: data?.error || 'Unknown' } : q));
        }
      } catch (e) {
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed', error: callError(e) } : q));
      }

      // Wait between calls to avoid rate limits (5 seconds)
      if (i < queue.length - 1) {
        setStatus('Waiting 5s before next call…');
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    setDialing(false);
    setCurrentIdx(-1);
    setStatus('✓ Dialing queue complete.');
  };

  const stopDialing = () => {
    setDialing(false);
    setCurrentIdx(-1);
    setStatus('Dialing stopped.');
  };

  const clearQueue = () => {
    if (dialing) return;
    setQueue([]);
    setStatus('');
  };

  const stats = {
    total: queue.length,
    pending: queue.filter(q => q.status === 'pending').length,
    dialing: queue.filter(q => q.status === 'dialing').length,
    dialed: queue.filter(q => q.status === 'dialed').length,
    failed: queue.filter(q => q.status === 'failed').length,
    blocked: queue.filter(q => q.status === 'blocked').length,
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
      <label style={{ display: 'block', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
        📞 AI Agent Lead Dialer
      </label>

      {/* Manual dial section */}
      <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '14px' }}>
        <div style={{ color: BLUE, fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Manual Dial (Testing)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
          <div>
            <label style={ls}>First Name</label>
            <input value={manualName.firstName} onChange={e => setManualName(p => ({ ...p, firstName: e.target.value }))} placeholder="Test" style={inp} />
          </div>
          <div>
            <label style={ls}>Last Name</label>
            <input value={manualName.lastName} onChange={e => setManualName(p => ({ ...p, lastName: e.target.value }))} placeholder="Lead" style={inp} />
          </div>
          <div>
            <label style={ls}>Phone Number</label>
            <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="555-123-4567" style={inp} onKeyDown={e => { if (e.key === 'Enter') manualDial(); }} />
          </div>
          <button onClick={manualDial} disabled={!manualPhone.trim()} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: manualPhone.trim() ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: manualPhone.trim() ? 1 : 0.5 }}>
            📞 Dial Now
          </button>
        </div>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setOverrideCutoff(p => !p)} style={{ background: overrideCutoff ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', color: overrideCutoff ? AMBER : '#6b7280', border: `1px solid ${overrideCutoff ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {overrideCutoff ? '⚠ Override ON' : '🔒 Override 8pm Cutoff'}
          </button>
          {overrideCutoff && <span style={{ color: AMBER, fontSize: '10px' }}>Bypasses time zone check — use for test calls to your own number only.</span>}
        </div>
      </div>

      {/* CSV upload section */}
      <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '14px' }}>
        <div style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Bulk Lead Upload (CSV)</div>
        <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '8px' }}>
          Format: <span style={{ color: GOLD, fontFamily: 'monospace' }}>First Name, Last Name, Phone, City, State, Debt Amount</span> — one lead per line. A prospect contact card is created for each lead automatically.
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
          📁 Upload CSV
        </button>
      </div>

      {/* Queue stats + controls */}
      {queue.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
            <span style={{ color: '#8a9ab8' }}>Total: <b style={{ color: '#e8e0d0' }}>{stats.total}</b></span>
            <span style={{ color: '#8a9ab8' }}>Dialing: <b style={{ color: AMBER }}>{stats.dialing}</b></span>
            <span style={{ color: '#8a9ab8' }}>Dialed: <b style={{ color: GREEN }}>{stats.dialed}</b></span>
            <span style={{ color: '#8a9ab8' }}>Failed: <b style={{ color: RED }}>{stats.failed}</b></span>
            {stats.blocked > 0 && <span style={{ color: '#8a9ab8' }}>Blocked (8pm): <b style={{ color: RED }}>{stats.blocked}</b></span>}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {!dialing ? (
              <button onClick={startDialing} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                ▶ Start Dialing ({stats.pending} pending)
              </button>
            ) : (
              <button onClick={stopDialing} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                ⏹ Stop
              </button>
            )}
            {!dialing && (
              <button onClick={clearQueue} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>
                Clear Queue
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status message */}
      {status && <div style={{ marginBottom: '8px', padding: '6px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', color: GOLD, fontSize: '11px' }}>{status}</div>}
      {error && <div style={{ marginBottom: '8px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: RED, fontSize: '11px' }}>⚠ {error}</div>}

      {/* Queue list */}
      {queue.length > 0 && (
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px' }}>
          {queue.map((q, i) => {
            const isCurrent = i === currentIdx;
            const statusColor = q.status === 'dialed' ? GREEN : q.status === 'dialing' ? AMBER : q.status === 'failed' ? RED : q.status === 'blocked' ? RED : '#6b7280';
            const tzLabel = getTzLabel(q.phone);
            const localTime = getLocalTimeString(q.phone);
            return (
              <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isCurrent ? 'rgba(245,158,11,0.08)' : 'transparent' }}>
                <div>
                  <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{q.firstName} {q.lastName}</span>
                  <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>{q.phone}</span>
                  <span style={{ color: '#60a5fa', fontSize: '10px', marginLeft: '6px' }}>{tzLabel} {localTime}</span>
                  {q.city && <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '6px' }}>{q.city}, {q.state}</span>}
                  {q.debtAmount > 0 && <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '6px' }}>${q.debtAmount.toLocaleString()}</span>}
                  {q.error && <div style={{ color: RED, fontSize: '11px', marginTop: '4px' }}>{q.error}</div>}
                </div>
                <span style={{ color: statusColor, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {q.status === 'dialed' ? '✓ Dialed' : q.status === 'dialing' ? '⏳ Dialing…' : q.status === 'failed' ? '✗ Failed' : q.status === 'blocked' ? '🚫 Past 8pm' : '○ Pending'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}