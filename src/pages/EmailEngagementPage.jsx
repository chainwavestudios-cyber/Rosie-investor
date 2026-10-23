/**
 * EmailEngagementPage.jsx — the special engagement page of the Super Admin /
 * Assistant command centers: every fronter email activity in one place, scored.
 *
 *   • what the emails did (KPIs)
 *   • which campaign is most effective
 *   • which leads are most engaged, to follow up with
 *   • the live open / click / qualification tail
 */
import { useState } from 'react';
import useEngagementReport from '@/hooks/useEngagementReport';
import EngagementKpis from '@/components/engagement/EngagementKpis';
import CampaignEffectivenessTable from '@/components/engagement/CampaignEffectivenessTable';
import EngagedLeadList from '@/components/engagement/EngagedLeadList';
import EngagementFeed from '@/components/engagement/EngagementFeed';
import { C } from '@/components/superadmin/kit';

const WINDOWS = [7, 30, 90];

export default function EmailEngagementPage() {
  const [days, setDays] = useState(30);
  const { report, loading, error, refresh } = useEngagementReport(days);

  return (
    <div style={{ fontFamily: 'Georgia, serif', background: C.bg, color: C.ink, minHeight: '100vh', padding: '4px 0 40px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <div style={{ color: C.fronter, fontSize: '17px', fontWeight: 'bold' }}>📈 Email Engagement</div>
          <div style={{ color: C.muted, fontSize: '11px' }}>
            Every tracked open, link click and qualification-page visit — scored per lead and per campaign.
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

      {loading && <div style={{ color: C.muted, fontSize: '12px', padding: '26px 0' }}>Scoring email activity…</div>}
      {!loading && error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.danger}44`, borderRadius: '6px', padding: '14px', color: C.danger, fontSize: '12px' }}>
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <>
          <EngagementKpis summary={report.summary} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(430px, 100%), 1fr))', gap: '14px', marginTop: '14px', alignItems: 'start' }}>
            <Panel title="🏆 Campaign effectiveness" hint="Which email is actually moving people — sends from the email log, engagement from the tracker.">
              <CampaignEffectivenessTable campaigns={report.campaigns} />
            </Panel>

            <Panel title="📬 Latest tracked activity" hint="Newest first, straight from the tracker.">
              <EngagementFeed recent={report.recent} />
            </Panel>

            <Panel title="🎯 Leads to follow up with" hint="Ranked by engagement score — the hotter the lead, the sooner the call.">
              <EngagedLeadList leads={report.leads} />
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