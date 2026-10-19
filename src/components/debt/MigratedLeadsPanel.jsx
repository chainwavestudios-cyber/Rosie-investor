/**
 * MigratedLeadsPanel.jsx — Shows DebtLeads migrated from the Fronter side.
 * Defaults to today's migrations (Eastern Time) with a date range picker.
 * Read-only list; clicking a lead opens the full ClientProfileModal.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ClientProfileModal from '@/components/debt/ClientProfileModal';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' };

function easternDateStr(d) {
  // Format YYYY-MM-DD in America/New_York
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export default function MigratedLeadsPanel({ debtCoachUser }) {
  const today = easternDateStr(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Build date range in Eastern time, converted to UTC ISO bounds
      const fromISO = new Date(`${fromDate}T00:00:00-04:00`).toISOString();
      const toEndISO = new Date(`${toDate}T23:59:59-04:00`).toISOString();
      const query = {
        migratedFromFronter: true,
        migratedAt: { $gte: fromISO, $lte: toEndISO },
      };
      if (debtCoachUser?.role === 'dialer') query.debtCoachOwner = debtCoachUser.username;
      const page = await base44.entities.DebtLead.filter(query, { sort: '-migratedAt', limit: 200, fields: ['firstName', 'lastName', 'phone', 'email', 'state', 'debtAmount', 'status', 'migratedAt', 'migratedBy', 'debtCoachOwner', 'callCount', 'intentScore', 'animalType', 'profileJson', 'leadNumber'] });
      const items = (page?.items || []).filter(l => !l.deletedAt);
      setLeads(items);
      if (items.length > 0 && !selected) setSelected(items[0]);
      else if (items.length === 0) setSelected(null);
    } catch (e) { console.warn('Migrated load failed:', e.message); }
    setLoading(false);
  }, [fromDate, toDate, debtCoachUser, selected]);

  useEffect(() => { load(); }, [fromDate, toDate]);

  const setQuickRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFromDate(easternDateStr(start));
    setToDate(easternDateStr(end));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>
      {/* List + filters */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🚀 Migrated from Fronter</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={ls}>From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inp} max={toDate} />
            </div>
            <div>
              <label style={ls}>To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inp} min={fromDate} max={today} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => { setFromDate(today); setToDate(today); }} style={{ background: fromDate === today && toDate === today ? `${GOLD}22` : 'rgba(255,255,255,0.05)', color: fromDate === today && toDate === today ? GOLD : '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>Today</button>
            <button onClick={() => setQuickRange(7)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>7 Days</button>
            <button onClick={() => setQuickRange(30)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>30 Days</button>
            <button onClick={load} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', marginLeft: 'auto' }}>↻</button>
          </div>
          <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '8px' }}>{loading ? 'Loading…' : `${leads.length} migrated lead${leads.length === 1 ? '' : 's'}`}</div>
        </div>
        <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
          ) : leads.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 16px', fontSize: '12px' }}>No leads migrated in this date range.</div>
          ) : leads.map(lead => {
            const p = lead.profileJson ? (() => { try { return JSON.parse(lead.profileJson); } catch { return null; } })() : null;
            const animal = p?.animalType || lead.animalType || 'unknown';
            const emoji = animal === 'duck' ? '🦆' : animal === 'cow' ? '🐄' : '❓';
            const migratedTime = lead.migratedAt ? new Date(lead.migratedAt).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
            return (
              <button key={lead.id} onClick={() => setSelected(lead)} style={{ width: '100%', background: selected?.id === lead.id ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ fontSize: '20px' }}>{emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{lead.firstName} {lead.lastName}</div>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>{lead.phone || 'no phone'} · {lead.state || '—'}</div>
                  <div style={{ color: '#22d3ee', fontSize: '9px', marginTop: '2px' }}>🚀 {migratedTime} · by {lead.migratedBy || 'fronter'}</div>
                </div>
                {lead.debtAmount != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>${(lead.debtAmount || 0).toLocaleString()}</div>
                    <div style={{ color: '#4a5568', fontSize: '8px' }}>DEBT</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail / profile opener */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '24px' }}>
        {!selected ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '80px 0', fontSize: '13px' }}>Select a migrated lead to view their profile.</div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, color: '#e8e0d0', fontSize: '20px', fontWeight: 'normal' }}>{selected.firstName} {selected.lastName}</h2>
                <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>{selected.phone} · {selected.email || 'no email'}</div>
                <div style={{ color: '#22d3ee', fontSize: '11px', marginTop: '6px' }}>🚀 Migrated from Fronter · {selected.migratedBy ? `by ${selected.migratedBy}` : ''}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px' }}>Open Full Profile →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
              <Stat label="Status" value={selected.status || 'new'} />
              <Stat label="Debt Amount" value={selected.debtAmount != null ? `$${Number(selected.debtAmount).toLocaleString()}` : '—'} />
              <Stat label="State" value={selected.state || '—'} />
              <Stat label="Call Count" value={selected.callCount || 0} />
              <Stat label="Intent Score" value={selected.intentScore != null ? selected.intentScore : '—'} />
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ClientProfileModal lead={selected} username={debtCoachUser?.username} onClose={() => setSelected(null)} onSave={() => load()} />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '10px 12px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>{value}</div>
    </div>
  );
}