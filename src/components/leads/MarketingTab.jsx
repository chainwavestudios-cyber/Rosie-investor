import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const inp = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '2px',
  padding: '8px 14px',
  color: '#e8e0d0',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'Georgia, serif',
};

export default function MarketingTab() {
  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(new Set());
  const [sending, setSending]     = useState(false);
  const [sendMsg, setSendMsg]     = useState('');
  const [search, setSearch]       = useState('');

  useEffect(() => { loadUncontactedLeads(); }, []);

  const loadUncontactedLeads = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Lead.list('-created_date', 3000);
      // Leads that have never been emailed = no intro_email_sent, no opened_intro_email status,
      // no emailLog record — we filter by status not in [intro_email_sent, opened_intro_email]
      // and not migrated/converted
      const uncontacted = all.filter(l =>
        !l.migratedToPortal &&
        !l.convertedToInvestorUserId &&
        l.status !== 'intro_email_sent' &&
        l.status !== 'opened_intro_email' &&
        l.status !== 'not_interested' &&
        l.email  // must have an email
      );
      setLeads(uncontacted);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filteredLeads = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${l.firstName} ${l.lastName} ${l.email} ${l.state}`.toLowerCase().includes(q);
  });

  const toggleSelect = (id) => {
    if (selected.has(id)) {
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      if (selected.size >= 10) {
        setSendMsg('⚠️ Maximum 10 leads can be selected at once.');
        setTimeout(() => setSendMsg(''), 3000);
        return;
      }
      setSelected(prev => new Set(prev).add(id));
    }
  };

  const toggleAll = () => {
    if (selected.size > 0) {
      setSelected(new Set());
    } else {
      const first10 = filteredLeads.slice(0, 10).map(l => l.id);
      setSelected(new Set(first10));
    }
  };

  const handleSendIntroEmail = async () => {
    if (selected.size === 0) { setSendMsg('Select at least one lead.'); return; }

    const missingEmail = [...selected].map(id => leads.find(l => l.id === id)).filter(l => !l?.email);
    if (missingEmail.length > 0) {
      setSendMsg(`⚠️ ${missingEmail.length} selected lead(s) have no email address.`);
      return;
    }

    setSending(true); setSendMsg('');
    try {
      const result = await base44.functions.invoke('sendIntroEmail', {
        leadIds: [...selected],
      });
      const { sent, total } = result?.data || result || {};
      setSendMsg(`✅ Sent intro email to ${sent ?? selected.size} of ${total ?? selected.size} leads!`);
      setSelected(new Set());
      await loadUncontactedLeads();
    } catch (e) {
      setSendMsg('Error: ' + (e.response?.data?.error || e.message));
    }
    setSending(false);
    setTimeout(() => setSendMsg(''), 6000);
  };

  const statusColor = {
    lead: '#60a5fa', prospect: '#a78bfa', not_available: '#8a9ab8',
    callback_later: '#a78bfa', converted: '#4ade80', abandoned: '#ef4444',
  };

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#e8e0d0', margin: '0 0 4px', fontSize: '22px', fontWeight: 'normal' }}>
          📣 Marketing
        </h2>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
          Leads that have <strong style={{ color: GOLD }}>never received an intro email</strong>. Select up to 10 and send template #7961149.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Uncontacted Leads', value: leads.length, color: '#60a5fa', icon: '📋' },
          { label: 'With Email', value: leads.filter(l => l.email).length, color: '#4ade80', icon: '✉️' },
          { label: 'Selected', value: selected.size, color: GOLD, icon: '☑️' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: '4px', padding: '12px 18px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>{icon}</span>
            <div>
              <div style={{ color, fontSize: '22px', fontWeight: 'bold', lineHeight: 1 }}>{value}</div>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, state…"
          style={{ ...inp, width: '260px', boxSizing: 'border-box' }}
        />
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <span style={{ color: GOLD, fontSize: '12px' }}>
            {selected.size} lead{selected.size > 1 ? 's' : ''} selected
            {selected.size === 10 && <span style={{ color: '#f59e0b', marginLeft: '6px' }}>(max)</span>}
          </span>
        )}
        <button
          onClick={handleSendIntroEmail}
          disabled={sending || selected.size === 0}
          style={{
            background: (sending || selected.size === 0)
              ? 'rgba(96,165,250,0.2)'
              : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            color: selected.size === 0 ? '#4a5568' : '#fff',
            border: `1px solid ${selected.size === 0 ? 'rgba(255,255,255,0.1)' : '#3b82f6'}`,
            borderRadius: '4px',
            padding: '10px 22px',
            cursor: (sending || selected.size === 0) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s',
          }}
        >
          {sending ? (
            <><span style={{ fontSize: '16px' }}>⏳</span> Sending…</>
          ) : (
            <><span style={{ fontSize: '16px' }}>✉️</span> Send Opening Email</>
          )}
        </button>
      </div>

      {sendMsg && (
        <div style={{
          background: sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${sendMsg.startsWith('✅') ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: '4px', padding: '12px 16px',
          color: sendMsg.startsWith('✅') ? '#4ade80' : '#ef4444',
          fontSize: '13px', marginBottom: '16px',
        }}>
          {sendMsg}
        </div>
      )}

      {/* Template info banner */}
      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#8a9ab8', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '18px' }}>ℹ️</span>
        <div>
          <strong style={{ color: '#60a5fa' }}>Template #7961149</strong> · Variable <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '2px' }}>{'{{var:state}}'}</code> is automatically populated from the lead's state field.
          Leads without an email address are excluded.
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>Loading uncontacted leads…</div>
      ) : filteredLeads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
          <div style={{ color: '#4a5568', fontSize: '14px' }}>
            {leads.length === 0
              ? 'All leads have been contacted or there are no leads with email addresses yet.'
              : 'No leads match your search.'}
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(184,147,58,0.3)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}>
                  <button
                    onClick={toggleAll}
                    title={selected.size > 0 ? 'Deselect all' : 'Select first 10'}
                    style={{ background: selected.size > 0 ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${selected.size > 0 ? GOLD : 'rgba(255,255,255,0.15)'}`, borderRadius: '3px', width: '20px', height: '20px', cursor: 'pointer', color: selected.size > 0 ? GOLD : '#6b7280', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}
                  >
                    {selected.size > 0 ? '✓' : ''}
                  </button>
                </th>
                {['Status', 'Name', 'Email', 'State', 'Score', 'Added'].map(h => (
                  <th key={h} style={{ color: GOLD, padding: '10px 12px', textAlign: 'left', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => {
                const isSelected = selected.has(lead.id);
                const sc = statusColor[lead.status] || '#8a9ab8';
                return (
                  <tr
                    key={lead.id}
                    onClick={() => toggleSelect(lead.id)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(184,147,58,0.07)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(184,147,58,0.03)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '3px', margin: 'auto',
                        background: isSelected ? GOLD : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isSelected ? GOLD : 'rgba(255,255,255,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: DARK, fontSize: '11px', fontWeight: 'bold',
                      }}>
                        {isSelected ? '✓' : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: `${sc}22`, color: sc, border: `1px solid ${sc}55`, padding: '3px 9px', borderRadius: '2px', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {(lead.status || 'lead').replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{lead.firstName} {lead.lastName}</div>
                      {lead.phone && <div style={{ color: '#4a5568', fontSize: '11px', fontFamily: 'monospace' }}>{lead.phone}</div>}
                    </td>
                    <td style={{ padding: '12px', color: '#8a9ab8', fontSize: '12px' }}>
                      {lead.email || <span style={{ color: '#ef4444', fontSize: '11px' }}>⚠ No email</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {lead.state ? (
                        <span style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px' }}>
                          {lead.state}
                        </span>
                      ) : <span style={{ color: '#4a5568' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {lead.engagementScore > 0 ? (
                        <span style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, border: '1px solid rgba(184,147,58,0.25)', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>
                          ⭐ {lead.engagementScore}
                        </span>
                      ) : <span style={{ color: '#4a5568', fontSize: '11px' }}>0</span>}
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280', fontSize: '11px' }}>
                      {lead.created_date ? new Date(lead.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredLeads.length > 0 && (
        <div style={{ marginTop: '12px', color: '#4a5568', fontSize: '11px', textAlign: 'right' }}>
          {filteredLeads.length} uncontacted lead{filteredLeads.length !== 1 ? 's' : ''} with email addresses
        </div>
      )}
    </div>
  );
}