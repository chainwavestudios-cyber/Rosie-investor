import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

const NB_TEMPLATE_IDS = ['8032819', '8036170', '8036171', '8036172'];
const NB_TEMPLATE_LABELS = {
  '8032819': 'NB Tech 1',
  '8036170': 'NB Tech 2',
  '8036171': 'NB Tech 3',
  '8036172': 'NB Tech 4',
  'custom':  'Custom NB',
};

const STATUS_COLOR = {
  sent: '#60a5fa', delivered: '#4ade80', opened: '#4ade80',
  clicked: '#f59e0b', bounced: '#ef4444', spam: '#ef4444',
};
const STATUS_ICON = {
  sent: '📤', delivered: '✉️', opened: '📬', clicked: '🔗', bounced: '⚠️', spam: '🚫',
};

function fmtDT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function NbEmailActivityTab() {
  const [logs, setLogs] = useState([]);
  const [leads, setLeads] = useState({});  // id → lead
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTemplate, setFilterTemplate] = useState('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all email logs
      const allLogs = await base44.entities.EmailLog.list('-sentAt', 5000);

      // Filter to NB Tech template emails + custom NB emails
      const nbLogs = (allLogs || []).filter(log =>
        NB_TEMPLATE_IDS.includes(String(log.templateId)) ||
        (log.isCustomEmail && log.fromEmail && log.fromEmail.includes('nbtecha'))
      );

      setLogs(nbLogs);

      // Load lead names for all unique leadIds
      const leadIds = [...new Set(nbLogs.map(l => l.leadId).filter(Boolean))];
      if (leadIds.length > 0) {
        const leadMap = {};
        // Fetch in batches to avoid huge queries
        for (let i = 0; i < leadIds.length; i += 50) {
          const batch = leadIds.slice(i, i + 50);
          const results = await Promise.all(
            batch.map(id => base44.entities.Lead.filter({ id }).catch(() => []))
          );
          results.forEach(res => { if (res?.[0]) leadMap[res[0].id] = res[0]; });
        }
        setLeads(leadMap);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    const lead = leads[log.leadId] || {};
    const name = `${lead.firstName || ''} ${lead.lastName || ''} ${log.toEmail || ''} ${log.toName || ''}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (filterTemplate !== 'all') {
      if (filterTemplate === 'custom' && log.templateId !== 'custom') return false;
      if (filterTemplate !== 'custom' && String(log.templateId) !== filterTemplate) return false;
    }
    return true;
  });

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleAll = () => {
    if (selected.size === filteredLogs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const handleDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} email log record(s)? This cannot be undone.`)) return;
    setDeleting(true); setDeleteMsg('');
    let deleted = 0;
    for (const id of selected) {
      try { await base44.entities.EmailLog.delete(id); deleted++; } catch {}
    }
    setDeleteMsg(`✅ Deleted ${deleted} record(s).`);
    setSelected(new Set());
    await loadData();
    setDeleting(false);
    setTimeout(() => setDeleteMsg(''), 4000);
  };

  // Stats
  const statCounts = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
  logs.forEach(l => { if (statCounts[l.status] !== undefined) statCounts[l.status]++; });

  const inp = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' };

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <h3 style={{ color: '#e8e0d0', margin: '0 0 4px', fontSize: '18px', fontWeight: 'normal' }}>
        💡 NB Tech Email Activity
      </h3>
      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 16px' }}>
        All NB Tech template emails (templates 1–4) and custom NB emails. Track sent, delivered, opened, and clicked.
      </p>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {[
          { label: 'Total', value: logs.length, color: '#60a5fa' },
          { label: 'Delivered', value: statCounts.delivered, color: '#4ade80' },
          { label: 'Opened', value: statCounts.opened, color: '#4ade80' },
          { label: 'Clicked', value: statCounts.clicked, color: '#f59e0b' },
          { label: 'Bounced', value: statCounts.bounced, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}25`, borderRadius: '4px', padding: '8px 14px', textAlign: 'center', minWidth: '64px' }}>
            <div style={{ color, fontSize: '20px', fontWeight: 'bold', lineHeight: 1 }}>{value}</div>
            <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          style={{ ...inp, width: '220px', boxSizing: 'border-box' }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
          <option value="all">All Statuses</option>
          {['sent','delivered','opened','clicked','bounced','spam'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
          <option value="all">All Templates</option>
          {NB_TEMPLATE_IDS.map(id => (
            <option key={id} value={id}>{NB_TEMPLATE_LABELS[id]} (#{id})</option>
          ))}
          <option value="custom">Custom NB</option>
        </select>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <button onClick={handleDelete} disabled={deleting}
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', padding: '7px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {deleting ? '⏳ Deleting…' : `🗑 Delete ${selected.size} selected`}
          </button>
        )}
        <button onClick={loadData} style={{ ...inp, cursor: 'pointer', color: '#8a9ab8', padding: '7px 12px', width: 'auto', boxSizing: 'border-box' }}>🔄 Refresh</button>
      </div>

      {deleteMsg && (
        <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '4px', padding: '8px 14px', color: '#4ade80', fontSize: '12px', marginBottom: '10px' }}>
          {deleteMsg}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '48px' }}>Loading…</div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>📭</div>
          No NB Tech email records found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(184,147,58,0.3)' }}>
                <th style={{ padding: '8px 10px', width: '36px', textAlign: 'center' }}>
                  <button onClick={toggleAll}
                    style={{ background: selected.size === filteredLogs.length && filteredLogs.length > 0 ? 'rgba(184,147,58,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${selected.size === filteredLogs.length && filteredLogs.length > 0 ? GOLD : 'rgba(255,255,255,0.15)'}`, borderRadius: '3px', width: '18px', height: '18px', cursor: 'pointer', color: GOLD, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>
                    {selected.size === filteredLogs.length && filteredLogs.length > 0 ? '✓' : ''}
                  </button>
                </th>
                {['Status', 'Recipient', 'Template', 'Sent By', 'Sent At', 'Opened', 'Clicked', 'Badges'].map(h => (
                  <th key={h} style={{ color: GOLD, padding: '8px 10px', textAlign: 'left', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const lead = leads[log.leadId] || {};
                const displayName = log.toName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—';
                const sc = STATUS_COLOR[log.status] || '#8a9ab8';
                const si = STATUS_ICON[log.status] || '✉️';
                const tLabel = NB_TEMPLATE_LABELS[String(log.templateId)] || (log.templateId ? `#${log.templateId}` : '—');
                const isSelected = selected.has(log.id);
                return (
                  <tr key={log.id}
                    onClick={() => toggleSelect(log.id)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(184,147,58,0.07)' : 'transparent' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(184,147,58,0.07)' : 'transparent'; }}>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '3px', margin: 'auto', background: isSelected ? GOLD : 'rgba(255,255,255,0.05)', border: `1px solid ${isSelected ? GOLD : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0f1e', fontSize: '10px', fontWeight: 'bold' }}>
                        {isSelected ? '✓' : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <span style={{ marginRight: '5px' }}>{si}</span>
                      <span style={{ color: sc, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.5px' }}>{log.status}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ color: '#e8e0d0', fontWeight: 'bold', fontSize: '12px' }}>{displayName}</div>
                      <div style={{ color: '#4a5568', fontSize: '10px', fontFamily: 'monospace' }}>{log.toEmail}</div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)', borderRadius: '10px', padding: '2px 8px', fontSize: '10px', whiteSpace: 'nowrap' }}>{tLabel}</span>
                    </td>
                    <td style={{ padding: '10px', color: '#8a9ab8', fontSize: '11px', whiteSpace: 'nowrap' }}>{log.sentBy || '—'}</td>
                    <td style={{ padding: '10px', color: '#6b7280', fontSize: '10px', whiteSpace: 'nowrap' }}>{fmtDT(log.sentAt)}</td>
                    <td style={{ padding: '10px', color: '#4ade80', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      {log.openedAt ? fmtDT(log.openedAt) : <span style={{ color: '#374151' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px', color: '#f59e0b', fontSize: '10px' }}>
                      {log.clickedAt ? (
                        <div>
                          <div style={{ whiteSpace: 'nowrap' }}>{fmtDT(log.clickedAt)}</div>
                          {log.clickedUrl && <div style={{ color: '#60a5fa', fontSize: '9px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↗ {log.clickedUrl}</div>}
                        </div>
                      ) : <span style={{ color: '#374151' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {lead.badgeDataRoomRequest && (
                          <span title="Data Room Requested" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '1px 6px', fontSize: '9px', whiteSpace: 'nowrap' }}>🔐 Data Room</span>
                        )}
                        {lead.badgeSmsOptIn && (
                          <span title="SMS Opted In" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '10px', padding: '1px 6px', fontSize: '9px', whiteSpace: 'nowrap' }}>📱 SMS Opt-In</span>
                        )}
                        {lead.badgeEmailOpened && (
                          <span title="Email Opened" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '10px', padding: '1px 6px', fontSize: '9px', whiteSpace: 'nowrap' }}>📬 Opened</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '10px', textAlign: 'right' }}>
            {filteredLogs.length} record{filteredLogs.length !== 1 ? 's' : ''} · {selected.size} selected
          </div>
        </div>
      )}
    </div>
  );
}