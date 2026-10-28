/**
 * ProspectPicker.jsx — step 1 alternative: build the campaign list straight from
 * the contact cards already in the system instead of a CSV file.
 *
 * Shows every contact card that has an email address (a card without one can
 * never receive an email), with a one-click switch to the prospect pipeline.
 * Picking fills the exact row shape a CSV produces, so the mapping, mailbox
 * check and commit steps that follow are unchanged — and nothing is written
 * until the import is committed.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, GOLD, MUTED, SURFACE, BORDER, inputStyle } from './kit';

const PAGE = 200;

export default function ProspectPicker({ onUse }) {
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all');
  const [picked, setPicked] = useState({});

  const fetchPage = useCallback(async (next) => {
    setLoading(true);
    const page = await base44.entities.DebtLead
      .filter({}, { sort: '-updated_date', limit: PAGE, ...(next ? { cursor: next } : {}) })
      .catch(() => null);
    const items = (page?.items || []).filter((lead) => !lead.deletedAt && lead.email);
    setRows((prev) => {
      const seen = new Set(prev.map((row) => row.id));
      return [...prev, ...items.filter((row) => !seen.has(row.id))];
    });
    setPicked((prev) => {
      const nextPicked = next ? { ...prev } : {};
      for (const lead of items) nextPicked[lead.id] = next ? (prev[lead.id] ?? true) : true;
      return nextPicked;
    });
    setCursor(page?.next_cursor || null);
    setHasMore(!!page?.has_more && !!page?.next_cursor);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPage(null); }, [fetchPage]);

  const prospectCount = rows.filter((row) => row.isProspect).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (scope === 'prospects' && !row.isProspect) return false;
      if (!q) return true;
      return `${row.firstName || ''} ${row.lastName || ''} ${row.email || ''} ${row.phone || ''}`.toLowerCase().includes(q);
    });
  }, [rows, search, scope]);

  const chosen = rows.filter((row) => picked[row.id]);
  const allVisiblePicked = filtered.length > 0 && filtered.every((row) => picked[row.id]);

  const toggle = (row) => setPicked((prev) => ({ ...prev, [row.id]: !prev[row.id] }));

  const setVisible = (on) => setPicked((prev) => {
    const next = { ...prev };
    for (const row of filtered) next[row.id] = on;
    return next;
  });

  return (
    <Card
      title="Or pick from your contact cards"
      hint="Every card that has an email address. Picking them fills the list the same way a CSV would — the mailbox check and commit steps that follow stay the same, and cards that already exist are only filled in, never replaced."
    >
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <Btn tone={scope === 'all' ? 'gold' : 'ghost'} onClick={() => setScope('all')}>All contacts ({rows.length.toLocaleString()})</Btn>
        <Btn tone={scope === 'prospects' ? 'gold' : 'ghost'} onClick={() => setScope('prospects')}>Prospects only ({prospectCount.toLocaleString()})</Btn>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <input
          style={{ ...inputStyle, flex: '1 1 220px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone"
        />
        <Btn tone="ghost" onClick={() => setVisible(!allVisiblePicked)} disabled={!filtered.length}>
          {allVisiblePicked ? '✕ Clear shown' : '✓ Select all shown'}
        </Btn>
        <Btn tone="gold" onClick={() => onUse(chosen)} disabled={!chosen.length}>
          Use {chosen.length.toLocaleString()} contact{chosen.length === 1 ? '' : 's'} →
        </Btn>
      </div>

      <div style={{ color: MUTED, fontSize: '11px', marginBottom: '8px' }}>
        {loading && !rows.length ? 'Loading contact cards…' : `${chosen.length.toLocaleString()} of ${filtered.length.toLocaleString()} shown selected`}
        {hasMore ? <span style={{ color: DIM }}> · newest {rows.length.toLocaleString()} loaded</span> : null}
      </div>

      <div style={{ maxHeight: '340px', overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '5px', background: SURFACE }}>
        {filtered.map((row) => {
          const on = !!picked[row.id];
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => toggle(row)}
              style={{
                display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '8px 11px', background: on ? 'rgba(218,184,113,0.08)' : 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.045)', cursor: 'pointer',
              }}
            >
              <span style={{
                width: '14px', height: '14px', flex: '0 0 14px', borderRadius: '3px',
                border: `1px solid ${on ? GOLD : BORDER}`, background: on ? GOLD : 'transparent',
                color: '#0a0f1e', fontSize: '10px', fontWeight: 'bold', lineHeight: '13px', textAlign: 'center',
              }}>{on ? '✓' : ''}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0, color: '#e6edf6', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email}
                <span style={{ color: MUTED }}> · {row.email}</span>
              </span>
              {row.isProspect && (
                <span style={{ color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '3px', padding: '1px 6px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prospect</span>
              )}
              <span style={{ color: DIM, fontSize: '10px', whiteSpace: 'nowrap' }}>
                {row.phone || '—'}{row.state ? ` · ${row.state}` : ''}
              </span>
            </button>
          );
        })}
        {!filtered.length && !loading && (
          <div style={{ padding: '16px', color: DIM, fontSize: '11px' }}>
            {scope === 'prospects'
              ? 'No contact card is tagged as a prospect yet — switch to All contacts, or tag a card as a prospect first.'
              : 'No contact card with an email address matches that search — upload a CSV instead.'}
          </div>
        )}
        {loading && <div style={{ padding: '10px 11px', color: MUTED, fontSize: '11px' }}>Loading…</div>}
      </div>

      {hasMore && (
        <div style={{ marginTop: '10px' }}>
          <Btn tone="ghost" onClick={() => fetchPage(cursor)} disabled={loading}>{loading ? 'Loading…' : 'Load more contacts'}</Btn>
        </div>
      )}
    </Card>
  );
}