import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Quick "Create Lead" mini form
function CreateLeadForm({ phone, onCreated, onClose }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: phone || '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' };

  const save = async () => {
    if (!form.firstName) return;
    setSaving(true);
    try {
      const lead = await base44.entities.Lead.create({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
        status: 'lead',
      });
      // Log this inbound call in history
      await base44.entities.LeadHistory.create({
        leadId: lead.id,
        type: 'call',
        content: `📲 Inbound call — lead created during live call`,
        createdBy: 'admin',
      });
      onCreated(lead);
    } catch(e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  return (
    <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '8px', padding: '14px' }}>
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>+ Create New Lead</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
        <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="First Name *" style={inp} />
        <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Last Name" style={inp} />
        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" style={inp} />
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" style={inp} />
      </div>
      <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" style={{ ...inp, marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={save} disabled={saving || !form.firstName}
          style={{ flex: 1, background: 'linear-gradient(135deg,#b8933a,#d4aa50)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px', cursor: form.firstName ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', opacity: form.firstName ? 1 : 0.5 }}>
          {saving ? '⏳ Saving…' : '💾 Save & Open Card'}
        </button>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '11px' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ActiveInboundCallBar({ call, from, lead, onOpenCard, onCreateLead, onClose }) {
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState('active'); // 'active' | 'disconnected'
  const [showCreateLead, setShowCreateLead] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!call) return;
    const onDisconnect = () => {
      setStatus('disconnected');
      clearInterval(timerRef.current);
    };
    call.on('disconnect', onDisconnect);
    call.on('error', onDisconnect);
    return () => {
      try { call.off('disconnect', onDisconnect); } catch {}
      try { call.off('error', onDisconnect); } catch {}
    };
  }, [call]);

  const handleMute = () => {
    try { call.mute(!muted); } catch {}
    setMuted(m => !m);
  };

  const handleHangup = () => {
    try { call.disconnect(); } catch {}
    setStatus('disconnected');
    clearInterval(timerRef.current);
  };

  const handleRedial = async () => {
    // Just log — redial not possible from inbound call object, user re-dials from lead card
    if (lead && onOpenCard) onOpenCard(lead);
  };

  const handleLeadCreated = (newLead) => {
    setShowCreateLead(false);
    onCreateLead && onCreateLead(newLead);
  };

  const isInvestor = lead && lead.username !== undefined;
  const name = lead
    ? (isInvestor ? lead.name : `${lead.firstName || ''} ${lead.lastName || ''}`.trim())
    : from || 'Unknown Caller';

  return (
    <>
      <style>{`
        @keyframes pulse-green { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '70px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        width: '420px',
        background: '#0d1b2a',
        border: `2px solid ${status === 'disconnected' ? 'rgba(239,68,68,0.5)' : 'rgba(74,222,128,0.4)'}`,
        borderRadius: '12px',
        padding: '16px 20px',
        fontFamily: 'Georgia, serif',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {status === 'active' ? (
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'pulse-green 1.2s infinite' }} />
            ) : (
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
            )}
            <span style={{ color: status === 'active' ? '#4ade80' : '#ef4444', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              {status === 'active' ? '📲 In Call' : '📵 Call Ended'}
            </span>
          </div>
          {/* Timer */}
          <div style={{ color: GOLD, fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '2px' }}>
            {formatDuration(duration)}
          </div>
        </div>

        {/* Caller info */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{name}</div>
          <div style={{ color: '#60a5fa', fontSize: '12px', fontFamily: 'monospace' }}>{from || lead?.phone || '—'}</div>
          {lead && (
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '3px' }}>
              {isInvestor ? '✅ Investor' : (lead.leadType === 'nb_tech' ? '💡 NB Tech Lead' : '🔵 Standard Lead')}
              {lead.status && ` · ${lead.status}`}
            </div>
          )}
        </div>

        {/* Call controls */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          {/* Mute */}
          <button onClick={handleMute} disabled={status === 'disconnected'}
            style={{ flex: 1, background: muted ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: muted ? '#f59e0b' : '#8a9ab8', border: `1px solid ${muted ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '6px', padding: '9px', cursor: status === 'active' ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', opacity: status === 'disconnected' ? 0.4 : 1 }}>
            {muted ? '🔇 Unmute' : '🎤 Mute'}
          </button>

          {/* Hang up / Redial */}
          {status === 'active' ? (
            <button onClick={handleHangup}
              style={{ flex: 1, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              📵 Hang Up
            </button>
          ) : (
            <button onClick={handleRedial}
              style={{ flex: 1, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.35)', borderRadius: '6px', padding: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              🔄 Redial
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {lead && onOpenCard && (
            <button onClick={() => onOpenCard(lead)}
              style={{ flex: 1, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', padding: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              📋 Open Card
            </button>
          )}
          {!lead && (
            <button onClick={() => setShowCreateLead(v => !v)}
              style={{ flex: 1, background: showCreateLead ? 'rgba(184,147,58,0.2)' : 'rgba(184,147,58,0.08)', color: GOLD, border: `1px solid rgba(184,147,58,${showCreateLead ? '0.5' : '0.25'})`, borderRadius: '6px', padding: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              ➕ Create Lead
            </button>
          )}
          {lead && (
            <button onClick={() => setShowCreateLead(v => !v)}
              style={{ flex: 1, background: showCreateLead ? 'rgba(184,147,58,0.2)' : 'rgba(184,147,58,0.08)', color: GOLD, border: `1px solid rgba(184,147,58,${showCreateLead ? '0.5' : '0.25'})`, borderRadius: '6px', padding: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              ➕ New Lead
            </button>
          )}
          {(status === 'disconnected') && (
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer', fontSize: '11px' }}>
              ✕ Close
            </button>
          )}
        </div>

        {/* Create Lead form */}
        {showCreateLead && (
          <CreateLeadForm
            phone={from || lead?.phone || ''}
            onCreated={handleLeadCreated}
            onClose={() => setShowCreateLead(false)}
          />
        )}
      </div>
    </>
  );
}