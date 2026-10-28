/**
 * ProspectPicker.jsx — step 1 alternative: build the campaign list straight from
 * the prospect pipeline instead of a CSV file.
 *
 * Reads the contact cards an agent tagged as prospects. Picking them fills the
 * exact same row shape a CSV produces, so the mapping, mailbox check and commit
 * steps that follow are unchanged — and nobody is written until the import is
 * committed.
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
  const [picked, setPicked] = useState({});

  const fetchPage = useCallback(async (next) => {
    setLoading(true);
    const page = await base44.entities.DebtLead
      .filter({ isProspect: true }, { sort: '-updated_date', limit: PAGE, ...(next ? { cursor: next } : {}) })
      .catch(() => null);
    const items = (page?.items || []).filter((lead) => !lead.deletedAt);
    setRows((prev) => {
      const seen = new Set(prev.map((row) => row.id));
      return [...prev, ...items.filter((row) => !seen.has(row.id))];
    });
    setPicked((prev) => {
      const nextPicked = next ? { ...prev } : {};
      for (const lead of items) {
        if (!lead.email) continue;
        nextPicked[lead.id] = next ? (prev[lead.id] ?? true) : true;
      }
      return nextPicked;
    });
    setCursor(page?.next_cursor || null);
    setHasMore(!!page?.has_more && !!page?.next_cursor);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPage(null); }, [fetchPage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.firstName || ''} ${row.lastName || ''} ${row.email || ''} ${row.phone || ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  const pickable = filtered.filter((row) => row.email);
  const chosen = rows.filter((row) => picked[row.id] && row.email);
  const missingEmail = rows.filter((row) => !row.email).length;

  const toggle = (row) => setPicked((prev) => ({ ...prev, [row.id]: !prev[row.id] }));

  const setVisible = (on) => setPicked((prev) => {
    const next = { ...prev };
    for (const row of pickable) next[row.id] = on;
    return next;
  });

  const allVisiblePicked = pickable.length > 0 && pickable.every((row) => picked[row.id]);

  return (
    <Card
      title="Or pick from your prospects"
      hint="Every contact card an agent tagged as a prospect. Picking them fills the list the same way a CSV would — the mailbox check and commit steps that follow stay the same."
    >
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <input
          style={{ ...inputStyle, flex: '1 1 220px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone"
        />
        <Btn tone="ghost" onClick={() => setVisible(!allVisiblePicked)} disabled={!pickable.length}>
          {allVisiblePicked ? '✕ Clear shown' : '✓ Select all shown'}
        </Btn>
        <Btn tone="gold" onClick={() => onUse(chosen)} disabled={!chosen.length}>
          Use {chosen.length.toLocaleString()} prospect{chosen.length === 1 ? '' : 's'} →
        </Btn>
      </div>

      <div style={{ color: MUTED, fontSize: '11px', marginBottom: '8px' }}>
        {loading && !rows.length ? 'Loading prospects…' : `${rows.length.toLocaleString()} prospect${rows.length === 1 ? '' : 's'} · ${chosen.length.toLocaleString()} selected`}
        {missingEmail > 0 && <span style={{ color: DIM }}> · {missingEmail} without an email address are skipped</span>}
      </div>

      <div style={{ maxHeight: '340px', overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '5px', background: SURFACE }}>
        {filtered.map((row) => {
          const disabled = !row.email;
          const on = !!picked[row.id] && !disabled;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => !disabled && toggle(row)}
              style={{
                display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '8px 11px', background: on ? 'rgba(218,184,113,0.08)' : 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.045)',
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
              }}
            >
              <span style={{
                width: '14px', height: '14px', flex: '0 0 14px', borderRadius: '3px',
                border: `1px solid ${on ? GOLD : BORDER}`, background: on ? GOLD : 'transparent',
                color: '#0a0f1e', fontSize: '10px', fontWeight: 'bold', lineHeight: '13px', textAlign: 'center',
              }}>{on ? '✓' : ''}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0, color: '#e6edf6', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email || 'Unnamed'}
                <span style={{ color: MUTED }}> · {row.email || 'no email'}</span>
              </span>
              <span style={{ color: DIM, fontSize: '10px', whiteSpace: 'nowrap' }}>
                {row.phone || '—'}{row.state ? ` · ${row.state}` : ''}
              </span>
            </button>
          );
        })}
        {!filtered.length && !loading && (
          <div style={{ padding: '16px', color: DIM, fontSize: '11px' }}>
            {rows.length ? 'No prospect matches that search.' : 'No prospects are tagged yet — tag a contact card as a prospect first, or upload a CSV.'}
          </div>
        )}
        {loading && <div style={{ padding: '10px 11px', color: MUTED, fontSize: '11px' }}>Loading…</div>}
      </div>

      {hasMore && (
        <div style={{ marginTop: '10px' }}>
          <Btn tone="ghost" onClick={() => fetchPage(cursor)} disabled={loading}>{loading ? 'Loading…' : 'Load more prospects'}</Btn>
        </div>
      )}
    </Card>
  );
}