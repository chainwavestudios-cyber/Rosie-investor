/**
 * CampaignEffectivenessTable.jsx — which email actually moves people.
 * Sent counts come from the send log, opens/clicks/qualification from the
 * tracked events, so each campaign carries its own real rates.
 */
import { C, ago } from '@/components/superadmin/kit';

const HEAD = ['Campaign', 'Email type', 'Sent', 'Engaged', 'Opened', 'Clicked', 'Welcome', 'Qual page', 'Hot', 'Avg score', 'Last'];

const pct = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : '—');

export default function CampaignEffectivenessTable({ campaigns }) {
  if (!campaigns?.length) {
    return <div style={{ color: C.dim, fontSize: '12px', padding: '18px 0', textAlign: 'center' }}>No email activity in this window yet.</div>;
  }

  // The winner: the named campaign whose engaged leads score highest, hottest breaks a tie.
  const best = [...campaigns].filter((row) => row.attributed).sort((a, b) => (b.avgScore - a.avgScore) || (b.hotLeads - a.hotLeads))[0];

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr>
              {HEAD.map((head) => (
                <th key={head} style={{ textAlign: 'left', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '6px 8px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((row) => {
              const isBest = row.key === best?.key;
              return (
                <tr key={row.key} style={{ background: isBest ? 'rgba(245,158,11,0.07)' : 'transparent' }}>
                  <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: C.ink, fontSize: '12px', fontWeight: isBest ? 'bold' : 'normal' }}>
                    {isBest && <span title="Most effective campaign" style={{ marginRight: '5px' }}>🏆</span>}
                    {row.name}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: C.muted, fontSize: '10px' }}>{row.categoryLabel || '—'}</td>
                  <td style={cell()}>{row.sent ?? '—'}</td>
                  <td style={{ ...cell(), color: C.fronter, fontWeight: 'bold' }}>{row.engagedLeads}</td>
                  <td style={cell()}>{row.uniqueOpeners} <span style={sub()}>{pct(row.uniqueOpeners, row.sent)}</span></td>
                  <td style={cell()}>{row.uniqueClickers} <span style={sub()}>{pct(row.uniqueClickers, row.sent)}</span></td>
                  <td style={cell()}>{row.welcomeViews}</td>
                  <td style={{ ...cell(), color: row.qualifyVisits ? C.purple : C.muted, fontWeight: row.qualifyVisits ? 'bold' : 'normal' }}>{row.qualifyVisits}</td>
                  <td style={{ ...cell(), color: row.hotLeads ? C.danger : C.muted, fontWeight: row.hotLeads ? 'bold' : 'normal' }}>{row.hotLeads}</td>
                  <td style={{ ...cell(), color: C.warn, fontWeight: 'bold' }}>{row.avgScore}</td>
                  <td style={{ ...cell(), color: C.muted }}>{ago(row.lastAt) || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {best && (
        <div style={{ color: C.muted, fontSize: '11px', marginTop: '9px' }}>
          🏆 Most effective: <strong style={{ color: C.ink }}>{best.name}</strong> — engaged leads averaging {best.avgScore}/100
          {best.sent ? ` across ${best.sent} sends` : ''}.
        </div>
      )}
    </div>
  );
}

function cell() {
  return { padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: C.ink, fontSize: '12px', whiteSpace: 'nowrap' };
}

function sub() {
  return { color: C.muted, fontSize: '10px', marginLeft: '3px' };
}