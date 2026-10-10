/**
 * FronterEmailTrackingBadges.jsx — Shows email open + link click badges on the contact card.
 * Auto-tracked events are filtered by a 30-second bot filter.
 * Manual override buttons let the fronter mark opens/clicks when the client is on the phone.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';

const TRACKED_LINKS = [
  { match: 'trustpilot.com', url: 'https://www.trustpilot.com/review/debtadvisorsofamerica.com', label: 'Trustpilot', icon: '⭐' },
  { match: 'bbb.org', url: 'https://www.bbb.org/us/ca/san-diego/profile/debt-relief-services/debt-advisors-of-america-1126-1000064078', label: 'BBB', icon: '🏆' },
  { match: 'debtadvisorsofamerica.com', url: 'https://www.debtadvisorsofamerica.com/', label: 'Website', icon: '🌐' },
];

export default function FronterEmailTrackingBadges({ lead, username, onManualUpdate }) {
  const [events, setEvents] = useState([]);
  const [manualLinks, setManualLinks] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!lead?.id) return;
    let mounted = true;
    const load = async () => {
      try {
        const raw = await base44.entities.EmailTrackingEvent.filter({ leadId: lead.id }, '-trackedAt', 50);
        if (mounted) setEvents(Array.isArray(raw) ? raw : (raw?.items || []));
      } catch {}
    };
    load();
    const unsub = base44.entities.EmailTrackingEvent.subscribe((event) => {
      if (event?.data?.leadId === lead.id) load();
    });
    return () => { mounted = false; try { unsub(); } catch {} };
  }, [lead?.id]);

  useEffect(() => {
    try { setManualLinks(JSON.parse(lead?.emailLinksClickedJson || '[]')); } catch { setManualLinks([]); }
  }, [lead?.emailLinksClickedJson]);

  // Re-render every 5s so the 30s bot filter updates badges in real time
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const confirmedEvents = events.filter(e => now - new Date(e.trackedAt).getTime() > 30000);

  const hasOpen = confirmedEvents.some(e => e.eventType === 'open') || !!lead?.emailOpenedAt;
  const clickedUrls = new Set();
  confirmedEvents.filter(e => e.eventType === 'click' && e.url).forEach(e => clickedUrls.add(e.url));
  manualLinks.forEach(l => { if (l.url) clickedUrls.add(l.url); });

  const isLinkClicked = (match) => [...clickedUrls].some(u => u.includes(match));

  const manualMarkOpened = async () => {
    if (!lead?.id) return;
    try {
      const ts = new Date().toISOString();
      await base44.entities.FronterLead.update(lead.id, { emailOpenedAt: ts });
      onManualUpdate?.({ emailOpenedAt: ts });
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const manualMarkLinkClicked = async (link) => {
    if (!lead?.id) return;
    const next = [...manualLinks, { url: link.url, clickedAt: new Date().toISOString(), manual: true }];
    try {
      await base44.entities.FronterLead.update(lead.id, { emailLinksClickedJson: JSON.stringify(next) });
      onManualUpdate?.({ emailLinksClickedJson: JSON.stringify(next) });
      setManualLinks(next);
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  return (
    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
      {hasOpen ? (
        <span style={{ padding: '3px 10px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: GOLD, border: `1px solid ${GOLD}44`, fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>📧 Email Opened</span>
      ) : (
        <button onClick={manualMarkOpened} title="Manually mark email as opened" style={{ padding: '3px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ 📧 Opened</button>
      )}
      {TRACKED_LINKS.map(t => {
        const clicked = isLinkClicked(t.match);
        return clicked ? (
          <span key={t.label} style={{ padding: '3px 10px', borderRadius: '10px', background: 'rgba(96,165,250,0.15)', color: BLUE, border: `1px solid ${BLUE}44`, fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{t.icon} {t.label}</span>
        ) : (
          <button key={t.label} onClick={() => manualMarkLinkClicked(t)} title={`Manually mark ${t.label} link as clicked`} style={{ padding: '3px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ {t.icon} {t.label}</button>
        );
      })}
    </div>
  );
}