/**
 * FronterProspectTrackingTab.jsx — Welcome message & credential-link engagement for prospects.
 * Mirrors the Debt Call Coach credential/welcome tracking: the welcome message opened
 * (email open or the personal welcome audio) plus the three credential links —
 * company website, BBB and Trustpilot. Lit cells are the ones that really happened,
 * either tracked automatically by the email tracker or marked manually on the contact card.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const LED = '#22c55e';
const DIM = '#2d3748';
const BOT_FILTER_MS = 30000;

// Column order matches the request: welcome message, company website, BBB, Trustpilot
const LINKS = [
  { key: 'website', match: 'debtadvisorsofamerica.com', label: 'Company Website', icon: '🌐' },
  { key: 'bbb', match: 'bbb.org', label: 'BBB', icon: '🏛️' },
  { key: 'trustpilot', match: 'trustpilot.com', label: 'Trustpilot', icon: '⭐' },
];

const fmt = (iso) => iso
  ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '';
const ago = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};
const escapeRegex = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function FronterProspectTrackingTab({ isAdmin = false, username = '' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [leadPage, evPage] = await Promise.all([
        isAdmin || !username
          ? base44.entities.FronterLead.list('-created_date', 500)
          : base44.entities.FronterLead.filter({ assignedTo: { $regex: `^${escapeRegex(username)}$`, $options: 'i' } }, '-created_date', 500),
        base44.entities.EmailTrackingEvent.list('-trackedAt', 500),
      ]);
      const leads = leadPage.items || leadPage || [];
      const events = evPage.items || evPage || [];
      const byId = new Map(leads.map(l => [l.id, l]));
      // Ignore events younger than the bot filter so preview crawlers don't light a column
      const cutoff = Date.now() - BOT_FILTER_MS;
      const tracked = new Map();
      const entryFor = (leadId) => {
        if (!tracked.has(leadId)) tracked.set(leadId, { leadId, openedAt: null, audioAt: null, links: {} });
        return tracked.get(leadId);
      };

      for (const e of events) {
        if (!e.leadId || !byId.has(e.leadId)) continue; // tracked events for Debt Call Coach leads are ignored here
        const at = e.trackedAt || e.created_date;
        if (!at || new Date(at).getTime() > cutoff) continue;
        const entry = entryFor(e.leadId);
        if (e.eventType === 'open') { if (!entry.openedAt) entry.openedAt = at; continue; }
        if (e.eventType === 'click' && e.url) {
          const hit = LINKS.find(l => e.url.includes(l.match));
          if (hit) { if (!entry.links[hit.key]) entry.links[hit.key] = at; }
          else if (!entry.audioAt) entry.audioAt = at; // any other link in the welcome email = the personal welcome audio
        }
      }

      // Manual marks saved on the lead (contact card "+ Opened" / "+ link" buttons)
      for (const l of leads) {
        let manual = [];
        try { manual = JSON.parse(l.emailLinksClickedJson || '[]'); } catch { manual = []; }
        if (!l.emailOpenedAt && manual.length === 0) continue;
        const entry = entryFor(l.id);
        if (l.emailOpenedAt && !entry.openedAt) entry.openedAt = l.emailOpenedAt;
        for (const m of manual) {
          const hit = LINKS.find(t => (m.url || '').includes(t.match));
          if (hit && !entry.links[hit.key]) entry.links[hit.key] = m.clickedAt || l.updated_date || null;
        }
      }

      const list = [...tracked.values()]
        .map(r => {
          const lead = byId.get(r.leadId);
          const stamps = [r.openedAt, r.audioAt, ...Object.values(r.links)].filter(Boolean).map(s => new Date(s).getTime());
          return { ...r, lead, lastAt: stamps.length ? new Date(Math.max(...stamps)).toISOString() : null };
        })
        .filter(r => r.lead && (r.openedAt || r.audioAt || Object.keys(r.links).length > 0))
        .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
      setRows(list);
    } catch (e) {
      console.error('prospect tracking load', e);
      setRows([]);
    }
    setLoading(false);
  }, [isAdmin, username]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const unsub = base44.entities.EmailTrackingEvent.subscribe(() => load());
    return () => { clearInterval(t); try { unsub(); } catch { /* ignore */ } };
  }, [load]);

  const count = (fn) => rows.filter(fn).length;

  const Cell = ({ on, at, icon, label }) => on ? (
    <div title={`${label} — ${fmt(at)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: `linear-gradient(135deg,${GOLD},${LED})`, color: '#0a0f1e', border: `1px solid ${LED}`, borderRadius: '4px', padding: '5px 11px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', boxShadow: `0 0 12px rgba(16,185,129,0.55)`, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: '11px' }}>{icon}</span> true
    </div>
  ) : (
    <div title={`${label} — not yet`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', color: DIM, border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 11px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: '11px', opacity: 0.5 }}>{icon}</span> —
    </div>
  );

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📬 {isAdmin ? 'All' : 'My'} Prospects — Opened Welcome / Links</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '3px' }}>
            Prospects who opened the credentials &amp; welcome message or clicked a credential link. Opens and clicks are tracked automatically; the contact card's “+” buttons mark them by hand.
          </div>
        </div>
        <button onClick={load} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {[{ label: 'Activity', value: rows.length }, { label: '📬 Welcome', value: count(r => r.openedAt || r.audioAt) }, { label: '🌐 Website', value: count(r => r.links.website) }, { label: '🏛️ BBB', value: count(r => r.links.bbb) }, { label: '⭐ Trustpilot', value: count(r => r.links.trustpilot) }].map(m => (
          <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 10px' }}>
            <span style={{ color: '#6b7280', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{m.label}</span>
            <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', marginLeft: '6px' }}>{m.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px', fontSize: '12px' }}>Loading welcome &amp; link activity…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px', fontSize: '12px' }}>
          No prospects have opened the welcome message or clicked a credential link yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead>
              <tr>
                {['Prospect', '📬 Welcome Message', '🌐 Company Website', '🏛️ BBB', '⭐ Trustpilot', 'Last Activity'].map(h => (
                  <th key={h} style={{ textAlign: 'left', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.leadId}>
                  <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' }}>
                    <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{`${r.lead.firstName || ''} ${r.lead.lastName || ''}`.trim() || '—'}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>
                      {r.lead.phone || ''}{r.lead.assignedTo ? ` · ${r.lead.assignedTo}` : ''}{r.lead.status && r.lead.status !== 'prospect' ? ` · ${r.lead.status}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Cell on={!!(r.openedAt || r.audioAt)} at={r.openedAt || r.audioAt} icon={r.audioAt ? '🎧' : '✉️'} label={r.audioAt ? 'Welcome message audio opened' : 'Welcome message opened'} />
                  </td>
                  {LINKS.map(l => (
                    <td key={l.key} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <Cell on={!!r.links[l.key]} at={r.links[l.key]} icon={l.icon} label={l.label} />
                    </td>
                  ))}
                  <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#8a9ab8', fontSize: '10px', whiteSpace: 'nowrap' }}>{ago(r.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}