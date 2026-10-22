/**
 * MarketingRecipientPicker.jsx — Picks the contact cards a marketing email goes
 * to: search, select all/none, and each row shows when it last received it.
 */
import { format } from 'date-fns';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' };
const btn = { background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' };

const when = (iso) => {
  try { return format(new Date(iso), 'MMM d, h:mm a'); } catch { return ''; }
};

export default function MarketingRecipientPicker({ contacts, total, selected, lastSent, query, onQuery, onToggle, onSelectAll, onClear }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Contacts · {contacts.length} of {total} shown
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onSelectAll} style={btn}>Select all shown</button>
          <button onClick={onClear} style={btn}>Clear</button>
        </div>
      </div>

      <input value={query} onChange={e => onQuery(e.target.value)} placeholder="Search by name, email or phone…" style={{ ...inp, marginBottom: '12px' }} />

      {contacts.length === 0 ? (
        <div style={{ color: '#4a5568', fontSize: '12px', padding: '20px', textAlign: 'center' }}>
          No contact cards with an email address match this search.
        </div>
      ) : (
        <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {contacts.map(c => {
            const isSelected = selected.includes(c.id);
            const sentAt = lastSent[c.id];
            return (
              <label
                key={c.id}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '4px', cursor: 'pointer', background: isSelected ? `${GOLD}14` : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? `${GOLD}44` : 'transparent'}` }}
              >
                <input type="checkbox" checked={isSelected} onChange={() => onToggle(c.id)} style={{ accentColor: GOLD, cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>
                    {`${c.firstName || ''} ${c.lastName || ''}`.trim() || '(no name)'}
                    <span style={{ color: '#6b7280', fontWeight: 'normal', marginLeft: '8px', fontSize: '10px', textTransform: 'uppercase' }}>{c.status || 'prospect'}</span>
                  </div>
                  <div style={{ color: '#8a9ab8', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                </div>
                <div style={{ color: sentAt ? GOLD : '#4a5568', fontSize: '10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {sentAt ? `✓ Sent ${when(sentAt)}` : 'Not sent yet'}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}