/**
 * MarketingCampaignsList.jsx — the Debt Call Coach marketing campaigns and
 * their progress, with pause / resume / cancel controls.
 */
import { base44 } from '@/api/base44Client';
import { fmt12 } from '@/lib/time12';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const th = { padding: '7px 10px', color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' };
const td = { padding: '8px 10px', fontSize: '12px', color: '#e8e0d0', borderBottom: '1px solid rgba(255,255,255,0.04)' };

const STATUS_COLOR = { running: GOLD, paused: '#f59e0b', completed: BLUE, cancelled: '#ef4444' };

export default function MarketingCampaignsList({ campaigns, onChanged }) {
  const setStatus = async (campaign, status) => {
    if (status === 'cancelled' && !window.confirm(`Cancel “${campaign.name}”? Emails not yet sent will be dropped.`)) return;
    await base44.entities.DebtMarketingCampaign.update(campaign.id, { status });
    onChanged?.();
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '18px' }}>
      <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
        Campaigns ({campaigns.length})
      </div>

      {campaigns.length === 0 ? (
        <div style={{ color: '#8a9ab8', fontSize: '12px' }}>No campaigns scheduled yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Campaign</th><th style={th}>Email</th><th style={th}>Window</th>
                <th style={th}>Progress</th><th style={th}>Status</th><th style={th}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const done = (c.sentCount || 0) + (c.failedCount || 0) + (c.skippedCount || 0);
                const total = c.totalSends || 0;
                const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
                return (
                  <tr key={c.id}>
                    <td style={td}>{c.name}</td>
                    <td style={td}>
                      {c.emailTemplateName || '—'}
                      {c.intro2TemplateName && <div style={{ color: '#8a9ab8', fontSize: '10px' }}>Intro 2: {c.intro2TemplateName}</div>}
                    </td>
                    <td style={td}>
                      {(c.startAt || '').slice(0, 10)} → {(c.endAt || '').slice(0, 10)}
                      <div style={{ color: '#8a9ab8', fontSize: '10px' }}>{fmt12(c.windowStart)} – {fmt12(c.windowEnd)} · every {c.intervalMinutes}m · {c.emailsPerSend}/send</div>
                    </td>
                    <td style={td}>
                      {c.sentCount || 0}/{total}
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '4px', width: '90px' }}>
                        <div style={{ height: '4px', width: `${pct}%`, background: GOLD, borderRadius: '2px' }} />
                      </div>
                      {c.failedCount > 0 && <div style={{ color: '#ef4444', fontSize: '10px' }}>{c.failedCount} failed</div>}
                    </td>
                    <td style={td}><span style={{ color: STATUS_COLOR[c.status] || '#8a9ab8', fontSize: '11px', fontWeight: 'bold' }}>{c.status}</span></td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {c.status === 'running' && <button onClick={() => setStatus(c, 'paused')} style={btn('#f59e0b')}>Pause</button>}
                        {c.status === 'paused' && <button onClick={() => setStatus(c, 'running')} style={btn(GOLD)}>Resume</button>}
                        {(c.status === 'running' || c.status === 'paused') && <button onClick={() => setStatus(c, 'cancelled')} style={btn('#ef4444')}>Cancel</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function btn(color) {
  return { background: `${color}1a`, color, border: `1px solid ${color}44`, borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' };
}