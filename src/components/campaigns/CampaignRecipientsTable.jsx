/**
 * CampaignRecipientsTable.jsx — the recipient rows of a campaign.
 *
 * Read-only in the monitor; in the launch step the same table is the approval
 * list, so a recipient can be taken out before anything is queued.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, BORDER, DIM, GOLD, MUTED, SURFACE, inputStyle } from './kit';

const PAGE = 200;
const TONE = { pending: '#60a5fa', sent: '#10b981', failed: '#ef4444', skipped: '#f59e0b' };
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
  { id: 'skipped', label: 'Skipped' },
];

export default function CampaignRecipientsTable({ campaignId, refreshKey, selectable = false, excluded, onToggle, engagement, hiddenStatuses = [] }) {
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (reset = true) => {
    setLoading(true);
    const query = filter === 'all' ? { campaignId } : { campaignId, status: filter };
    const page = await base44.entities.EmailCampaignRecipient
      .filter(query, { sort: 'created_date', limit: PAGE, ...(reset || !cursor ? {} : { cursor }) })
      .catch(() => null);
    const items = page?.items || [];
    setRows((prev) => (reset ? items : [...prev, ...items]));
    setCursor(page?.next_cursor || null);
    setHasMore(!!page?.has_more);
    setLoading(false);
  }, [campaignId, filter, cursor]);

  useEffect(() => { setCursor(null); load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [campaignId, filter, refreshKey]);

  const visible = rows.filter((row) => !hiddenStatuses.includes(row.status));
  const stamp = (value) => (value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            style={{
              background: filter === option.id ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.04)',
              color: filter === option.id ? '#10b981' : MUTED,
              border: `1px solid ${filter === option.id ? 'rgba(16,185,129,0.4)' : BORDER}`,
              borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold',
            }}
          >
            {option.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Btn tone="ghost" onClick={() => load(true)} disabled={loading}>{loading ? 'Loading…' : '↻ Refresh'}</Btn>
      </div>

      {selectable && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn tone="ghost" onClick={() => visible.filter((r) => r.status === 'pending').forEach((r) => !excluded.has(r.id) && onToggle(r.id, false))}>Take all pending out</Btn>
          <Btn tone="ghost" onClick={() => [...excluded].forEach((id) => onToggle(id, true))}>Put them all back</Btn>
          <span style={{ color: DIM, fontSize: '11px' }}>
            {excluded.size ? `${excluded.size} taken out — they will be recorded as skipped` : 'Everyone eligible is in'}
          </span>
        </div>
      )}

      <div style={{ maxHeight: '440px', overflow: 'auto', border: `1px solid ${BORDER}`, borderRadius: '5px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: SURFACE, position: 'sticky', top: 0 }}>
              {selectable && <th style={{ padding: '7px 9px', borderBottom: `1px solid ${BORDER}` }} />}
              <th style={{ textAlign: 'left', padding: '7px 9px', color: '#10b981', borderBottom: `1px solid ${BORDER}` }}>Recipient</th>
              <th style={{ textAlign: 'left', padding: '7px 9px', color: '#10b981', borderBottom: `1px solid ${BORDER}` }}>Status</th>
              <th style={{ textAlign: 'left', padding: '7px 9px', color: '#10b981', borderBottom: `1px solid ${BORDER}` }}>Sent</th>
              <th style={{ textAlign: 'left', padding: '7px 9px', color: '#10b981', borderBottom: `1px solid ${BORDER}` }}>Engagement</th>
              <th style={{ textAlign: 'left', padding: '7px 9px', color: '#10b981', borderBottom: `1px solid ${BORDER}` }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const tone = TONE[row.status] || MUTED;
              const seen = engagement?.[row.sendId] || null;
              const opens = seen?.opens ?? Number(row.openCount || 0);
              const clicks = seen?.clicks ?? (() => { try { return JSON.parse(row.clickedUrlsJson || '[]').length; } catch { return 0; } })();
              const visited = !!seen?.visited || !!row.qualifyVisitAt;
              return (
                <tr key={row.id}>
                  {selectable && (
                    <td style={{ padding: '5px 9px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <input
                        type="checkbox"
                        checked={row.status === 'pending' ? !excluded.has(row.id) : false}
                        disabled={row.status !== 'pending'}
                        onChange={(e) => onToggle(row.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td style={{ padding: '5px 9px', color: '#c4cdd8', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>{`${row.firstName || ''} ${row.lastName || ''}`.trim() || '—'}</div>
                    <div style={{ color: DIM, fontSize: '10px' }}>{row.email}</div>
                    {(row.debtAmount > 0 || row.leadDate) && (
                      <div style={{ color: GOLD, fontSize: '10px' }}>
                        {row.debtAmount > 0 ? `$${Number(row.debtAmount).toLocaleString()}` : ''}
                        {row.debtAmount > 0 && row.leadDate ? ' · ' : ''}
                        {row.leadDate || ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '5px 9px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: tone, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>{row.status}</span>
                  </td>
                  <td style={{ padding: '5px 9px', color: MUTED, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{stamp(row.sentAt)}</td>
                  <td style={{ padding: '5px 9px', color: MUTED, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {opens ? `👁 ${opens}× ` : ''}
                    {clicks ? `🔗 ${clicks} click${clicks === 1 ? '' : 's'}` : ''}
                    {visited ? ' · opened the invitation page' : ''}
                    {!opens && !clicks && !visited ? '—' : ''}
                  </td>
                  <td style={{ padding: '5px 9px', color: row.error || row.reason ? '#f59e0b' : DIM, borderBottom: '1px solid rgba(255,255,255,0.04)', maxWidth: '260px' }}>
                    {row.error || row.reason || '—'}
                  </td>
                </tr>
              );
            })}
            {!visible.length && !loading && (
              <tr><td colSpan={selectable ? 6 : 5} style={{ padding: '14px', color: DIM, textAlign: 'center' }}>Nothing here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div style={{ marginTop: '10px' }}>
          <Btn tone="ghost" onClick={() => load(false)} disabled={loading}>{loading ? 'Loading…' : 'Load more recipients'}</Btn>
        </div>
      )}
      <div style={{ color: DIM, fontSize: '10px', marginTop: '8px' }}>
        Showing {visible.length} of this page's rows. Every status change below is written to the recipient's own record.
      </div>
    </div>
  );
}