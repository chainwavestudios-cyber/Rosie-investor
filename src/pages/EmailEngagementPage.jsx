/**
 * EmailEngagementPage.jsx — the engagement console of the Super Admin / Assistant
 * command centers.
 *
 * Two systems, switched at the top and never mixed:
 *   • Debt Call Coach — credentials & welcome, cold introduction, follow-up
 *     introduction, appointment reminders, notice, Steph, Golden Boy. Scores here
 *     sit on Debt Call Coach contact cards.
 *   • Fronter — the prospecting workspace's own tracked outreach, which drives
 *     prospect → lead promotion and the migrate decision.
 */
import { useState } from 'react';
import useEngagementReport from '@/hooks/useEngagementReport';
import EngagementKpis from '@/components/engagement/EngagementKpis';
import CampaignEffectivenessTable from '@/components/engagement/CampaignEffectivenessTable';
import EngagedLeadList from '@/components/engagement/EngagedLeadList';
import EngagementFeed from '@/components/engagement/EngagementFeed';
import HotLeadBanner from '@/components/engagement/HotLeadBanner';
import { C } from '@/components/superadmin/kit';
import { SYSTEM_META } from '@/lib/engagementTiers';

const WINDOWS = [7, 30, 90];
const SYSTEMS = ['coach', 'fronter'];

export default function EmailEngagementPage() {
  const [days, setDays] = useState(30);
  const [system, setSystem] = useState('coach');
  const { report, loading, error, refresh } = useEngagementReport(days);
  const meta = SYSTEM_META[system];
  const data = report?.systems?.[system];

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
        {meta.note}
      </div>

      {loading && <div style={{ color: C.muted, fontSize: '12px', padding: '26px 0' }}>Scoring email activity…</div>}
      {!loading && error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.danger}44`, borderRadius: '6px', padding: '14px', color: C.danger, fontSize: '12px' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <HotLeadBanner hot={data.hot} leads={data.leads} system={system} />
          <EngagementKpis summary={data.summary} system={system} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(430px, 100%), 1fr))', gap: '14px', marginTop: '14px', alignItems: 'start' }}>
            <Panel title="🏆 Email effectiveness" hint={`Which ${meta.label} email is actually moving people — sends from the send log, engagement from the tracker.`}>
              <CampaignEffectivenessTable campaigns={data.campaigns} />
            </Panel>

            <Panel title="📬 Latest tracked activity" hint="Newest first, straight from the tracker.">
              <EngagementFeed recent={data.recent} />
            </Panel>

            <Panel
              title={system === 'coach' ? '🎯 Leads to follow up with' : '🎯 Prospects to work'}
              hint={system === 'coach'
                ? 'Ranked by Debt Call Coach score — the hotter the lead, the sooner the call.'
                : 'Ranked by fronter score — this is the promotion and migrate shortlist.'}
            >
              <EngagedLeadList leads={data.leads} system={system} />
            </Panel>
          </div>

          {(report.truncated?.events || report.truncated?.sends) && (
            <div style={{ color: C.dim, fontSize: '10px', marginTop: '12px' }}>
              Showing the most recent {report.truncated.events ? '1,000 tracked events' : 'sends'} in this window — narrow the window for an exact count.
            </div>
          )}
        </>
      )}
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