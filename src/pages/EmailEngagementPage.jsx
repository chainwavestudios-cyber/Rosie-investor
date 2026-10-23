/**
 * EmailEngagementPage.jsx — the engagement console of the Super Admin / Assistant
 * command centers, and a tab inside the Debt Call Coach.
 *
 * Two systems, switched at the top and never mixed:
 *   • Debt Call Coach — credentials & welcome, cold introduction, follow-up
 *     introduction, appointment reminders, notice, Steph, Golden Boy. Scores here
 *     sit on Debt Call Coach contact cards.
 *   • Fronter — the prospecting workspace's own tracked outreach, which drives
 *     prospect → lead promotion and the migrate decision.
 *
 * The hot cue at the top is live only and clears itself; every lead who crosses into
 * hot is written to the permanent record below, so nothing is lost when it clears.
 */
import { useState, useEffect, useRef } from 'react';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import useEngagementReport from '@/hooks/useEngagementReport';
import EngagementKpis from '@/components/engagement/EngagementKpis';
import CampaignEffectivenessTable from '@/components/engagement/CampaignEffectivenessTable';
import EngagedLeadList from '@/components/engagement/EngagedLeadList';
import EngagementFeed from '@/components/engagement/EngagementFeed';
import HotLeadBanner from '@/components/engagement/HotLeadBanner';
import HotLeadRecord from '@/components/engagement/HotLeadRecord';
import HotLeadToast from '@/components/engagement/HotLeadToast';
import EngagementContactCard from '@/components/engagement/EngagementContactCard';
import { C } from '@/components/superadmin/kit';
import { SYSTEM_META } from '@/lib/engagementTiers';

const WINDOWS = [7, 30, 90];
const SYSTEMS = ['coach', 'fronter'];
const SOUND_KEY = 'engagement_hot_alert_sound';

export default function EmailEngagementPage() {
  const { user } = useDebtCoachAuth();
  const [days, setDays] = useState(30);
  const [system, setSystem] = useState('coach');
  const { report, loading, error, refresh, markHandled, handlingId } = useEngagementReport(days);
  const [card, setCard] = useState(null);
  const [arrivals, setArrivals] = useState([]);
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
  });
  const seenAt = useRef({});
  const recordRef = useRef(null);
  const meta = SYSTEM_META[system];
  const data = report?.systems?.[system];
  const recorded = data?.hotHistory?.length || 0;

  // A lead that enters the hot list since the last read gets announced — the record keeps it either way.
  useEffect(() => {
    const stamp = report?.generatedAt;
    const rows = report?.systems?.[system]?.hotHistory;
    if (!stamp || !rows) return;
    const baseline = seenAt.current[system];
    if (!baseline) { seenAt.current[system] = stamp; return; }
    const fresh = rows.filter((row) => row.lastEnteredAt && row.lastEnteredAt > baseline && !row.handledAt);
    seenAt.current[system] = stamp;
    if (!fresh.length) return;
    setArrivals((prev) => {
      const seen = new Set(prev.map((row) => row.id));
      return [...fresh.filter((row) => !seen.has(row.id)), ...prev].slice(0, 6);
    });
  }, [report, system]);

  useEffect(() => {
    if (!arrivals.length) return;
    const timer = setTimeout(() => setArrivals([]), 45000);
    return () => clearTimeout(timer);
  }, [arrivals]);

  const toggleSound = () => setSoundOn((prev) => {
    const next = !prev;
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* preference only */ }
    return next;
  });

  const openLead = (target) => { if (target?.leadId) setCard(target); };
  const viewRecord = () => recordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div style={{ fontFamily: 'Georgia, serif', background: C.bg, color: C.ink, minHeight: '100vh', padding: '4px 0 40px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div>
          <div style={{ color: C.fronter, fontSize: '17px', fontWeight: 'bold' }}>📈 Email Engagement</div>
          <div style={{ color: C.muted, fontSize: '11px' }}>
            Every tracked open, link click and qualification-page visit — scored per lead and per email.
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          {WINDOWS.map((value) => (
            <button key={value} onClick={() => setDays(value)} style={{
              background: days === value ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
              color: days === value ? C.fronter : C.muted,
              border: `1px solid ${days === value ? `${C.fronter}55` : C.border}`,
              borderRadius: '4px', padding: '5px 11px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
            }}>{value}d</button>
          ))}
        </div>
        <button onClick={refresh} style={{ background: `${C.fronter}18`, color: C.fronter, border: `1px solid ${C.fronter}44`, borderRadius: '4px', padding: '5px 11px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>↻ Refresh</button>
        {report?.generatedAt && <span style={{ color: C.dim, fontSize: '10px' }}>updated {new Date(report.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
      </div>

      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {SYSTEMS.map((key) => {
          const option = SYSTEM_META[key];
          const active = key === system;
          const tone = key === 'coach' ? C.coach : C.fronter;
          return (
            <button key={key} onClick={() => setSystem(key)} style={{
              background: active ? `${tone}1f` : 'rgba(255,255,255,0.04)',
              color: active ? tone : C.muted,
              border: `1px solid ${active ? `${tone}66` : C.border}`,
              borderLeft: `3px solid ${tone}`,
              borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
            }}>{option.icon} {option.label}</button>
          );
        })}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '9px 12px', color: C.muted, fontSize: '11px', marginBottom: '12px' }}>
        {meta.note} Click any name to open that contact card.
      </div>

      {loading && <div style={{ color: C.muted, fontSize: '12px', padding: '26px 0' }}>Scoring email activity…</div>}
      {!loading && error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.danger}44`, borderRadius: '6px', padding: '14px', color: C.danger, fontSize: '12px' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <HotLeadToast
            arrivals={arrivals}
            system={system}
            soundOn={soundOn}
            onOpenLead={openLead}
            onDismiss={() => setArrivals([])}
          />

          <HotLeadBanner
            hot={data.hot}
            leads={data.leads}
            system={system}
            recorded={recorded}
            onOpenLead={openLead}
            onViewRecord={viewRecord}
          />

          <EngagementKpis summary={data.summary} system={system} />

          <div ref={recordRef}>
            <HotLeadRecord
              history={data.hotHistory}
              system={system}
              onOpenLead={openLead}
              onHandle={(row, handled) => markHandled(row.id, handled, system)}
              handlingId={handlingId}
              soundOn={soundOn}
              onToggleSound={toggleSound}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(430px, 100%), 1fr))', gap: '14px', marginTop: '14px', alignItems: 'start' }}>
            <Panel title="🏆 Email effectiveness" hint={`Which ${meta.label} email is actually moving people — sends from the send log, engagement from the tracker.`}>
              <CampaignEffectivenessTable campaigns={data.campaigns} />
            </Panel>

            <Panel title="📬 Latest tracked activity" hint="Newest first, straight from the tracker — name and phone, click the name for the card.">
              <EngagementFeed recent={data.recent} onOpenLead={openLead} />
            </Panel>

            <Panel
              title={system === 'coach' ? '🎯 Leads to follow up with' : '🎯 Prospects to work'}
              hint={system === 'coach'
                ? 'Ranked by Debt Call Coach score — the hotter the lead, the sooner the call.'
                : 'Ranked by fronter score — this is the promotion and migrate shortlist.'}
            >
              <EngagedLeadList leads={data.leads} system={system} onOpenLead={openLead} />
            </Panel>
          </div>

          {(report.truncated?.events || report.truncated?.sends) && (
            <div style={{ color: C.dim, fontSize: '10px', marginTop: '12px' }}>
              Showing the most recent {report.truncated.events ? '1,000 tracked events' : 'sends'} in this window — narrow the window for an exact count.
            </div>
          )}
        </>
      )}

      <EngagementContactCard target={card} username={user?.username} onClose={() => setCard(null)} />
    </div>
  );
}

function Panel({ title, hint, children }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '14px 16px', minWidth: 0 }}>
      <div style={{ color: C.ink, fontSize: '13px', fontWeight: 'bold' }}>{title}</div>
      <div style={{ color: C.muted, fontSize: '11px', margin: '3px 0 11px' }}>{hint}</div>
      {children}
    </section>
  );
}