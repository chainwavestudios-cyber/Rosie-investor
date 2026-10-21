/**
 * EmailOptInPanel — email consent records for the fronter/admin email system.
 * Shows who is opted in (double opt-in form confirmations plus the verbal
 * opt-ins logged from vault lists and lead records), and generates the verbal
 * opt-ins for every lead currently on file.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

const SOURCE_LABELS = {
  form: { label: '📝 Form', color: BLUE },
  vault: { label: '🏦 Vault (Verbal)', color: GOLD },
  verbal: { label: '📞 Verbal', color: GOLD },
  manual: { label: '✋ Manual', color: PURPLE },
};

const STATUS_LABELS = {
  confirmed: { label: 'Confirmed', color: GOLD },
  pending: { label: 'Awaiting Confirm', color: '#f59e0b' },
  unsubscribed: { label: 'Unsubscribed', color: '#6b7280' },
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

const PAGE_SIZE = 50;

// The roster is read through the emailOptIn function, so it works from the
// staff login alone (no separate sign-in to the app itself).

export default function EmailOptInPanel({ username }) {
  const [counts, setCounts] = useState({ total: 0, confirmed: 0, pending: 0, onList: 0, matching: 0 });
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [listFilter, setListFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [spreadDays, setSpreadDays] = useState(5);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const formUrl = `${window.location.origin}/email-optin`;

  const fetchPage = useCallback(async (at) => {
    const res = await base44.functions.invoke('emailOptIn', { action: 'list', search, listFilter, limit: PAGE_SIZE, cursor: at || null });
    const d = res?.data || {};
    if (d.error) throw new Error(d.error);
    return d;
  }, [search, listFilter]);

  const load = useCallback(async () => {
    try {
      const d = await fetchPage(null);
      setCounts({ total: d.total || 0, confirmed: d.confirmed || 0, pending: d.pending || 0, onList: d.onList || 0, matching: d.matching || 0 });
      setRows(d.items || []);
      setCursor(d.next_cursor || null);
    } catch { /* list unavailable */ }
  }, [fetchPage]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await fetchPage(cursor);
      setRows((prev) => [...prev, ...(d.items || [])]);
      setCursor(d.next_cursor || null);
    } catch { /* paging unavailable */ }
    setLoadingMore(false);
  };

  const generate = async () => {
    if (!confirm(`Opt in every lead on file (vault list and lead records), dating the opt-ins across the last ${spreadDays} days?`)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('emailOptIn', { action: 'generate', vault: true, fronterLeads: true, loggedBy: username, spreadDays });
      if (res?.data?.error) throw new Error(res.data.error);
      const d = res?.data || {};
      setResult(`✓ ${d.created ?? 0} new opt-in${d.created === 1 ? '' : 's'} logged · ${d.restamped ?? 0} dated across the last ${spreadDays} days.`);
      await load();
    } catch (e) {
      setResult('⚠ ' + (e?.response?.data?.error || e?.message || 'Could not log opt-ins.'));
    }
    setBusy(false);
  };

  const subscribeAll = async () => {
    if (!confirm('Add every confirmed opt-in to the Debt Solutions email list in Mailjet?')) return;
    setBusy(true);
    setResult(null);
    try {
      let done = 0;
      let failed = 0;
      let remaining = 1;
      let listName = 'Debt Solutions';
      for (let round = 0; round < 12 && remaining > 0; round++) {
        const res = await base44.functions.invoke('emailOptIn', { action: 'subscribeList' });
        if (res?.data?.error) throw new Error(res.data.error);
        const d = res?.data || {};
        done += d.subscribed || 0;
        failed += d.failed || 0;
        remaining = d.remaining || 0;
        listName = d.listName || listName;
        if (remaining) setResult(`⏳ Subscribing… ${done} added, ${remaining} to go`);
      }
      setResult(`✓ Subscribed ${done} contact${done === 1 ? '' : 's'} to the “${listName}” email list${failed ? ` · ${failed} could not be added` : ''}.`);
      await load();
    } catch (e) {
      setResult('⚠ ' + (e?.response?.data?.error || e?.message || 'Could not subscribe the email list.'));
    }
    setBusy(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${GOLD}33`, borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>✉️ Email Opt-Ins</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={copyLink} style={{ background: 'rgba(96,165,250,0.14)', color: BLUE, border: `1px solid ${BLUE}55`, borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{copied ? '✓ Link Copied' : '🔗 Copy Form Link'}</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${GOLD}10`, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 8px', color: '#8a9ab8', fontSize: '11px' }}>
            Spread over
            <input
              type="number"
              min="1"
              max="30"
              value={spreadDays}
              onChange={(e) => setSpreadDays(Math.min(30, Math.max(1, Number(e.target.value) || 5)))}
              style={{ width: '46px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '4px 6px', color: GOLD, fontSize: '11px', textAlign: 'center', outline: 'none' }}
            />
            days
          </label>
          <button onClick={generate} disabled={busy} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '7px 14px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: busy ? 0.6 : 1 }}>{busy ? '⏳ Working…' : '⚡ Opt In Every Lead'}</button>
          <button onClick={subscribeAll} disabled={busy} style={{ background: `${PURPLE}18`, color: PURPLE, border: `1px solid ${PURPLE}55`, borderRadius: '4px', padding: '7px 14px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: busy ? 0.6 : 1 }}>{busy ? '⏳ Working…' : '📮 Subscribe All To Email List'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {[['Total', counts.total, GOLD], ['Confirmed', counts.confirmed, BLUE], ['On Email List', counts.onList, PURPLE], ['Awaiting Confirm', counts.pending, '#f59e0b']].map(([label, value, color]) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
            <div style={{ color, fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
            <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.6, marginBottom: '10px' }}>
        Public form: <span style={{ color: '#e8e0d0' }}>{formUrl}</span> — single opt-in: the consent box on the form is the recorded consent, and a submission joins the email list straight away. Leads who opted in verbally are logged as confirmed. Confirmed contacts are subscribed to the “Debt Solutions” list in Mailjet.
        {counts.confirmed - counts.onList > 0 && (
          <div style={{ color: '#f59e0b', marginTop: '4px' }}>
            {counts.confirmed - counts.onList} confirmed {counts.confirmed - counts.onList === 1 ? 'contact is' : 'contacts are'} not on the email list yet — use “Subscribe All To Email List” above.
          </div>
        )}
      </div>

      {result && <div style={{ color: result.startsWith('✓') ? GOLD : '#f59e0b', fontSize: '12px', marginBottom: '10px' }}>{result}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
        />
        {[['all', `All Opt-Ins (${counts.total})`], ['on', `On Email List (${counts.onList})`], ['not', `Not On List (${counts.confirmed - counts.onList})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setListFilter(key)}
            style={{ background: listFilter === key ? `${GOLD}22` : 'rgba(255,255,255,0.04)', color: listFilter === key ? GOLD : '#8a9ab8', border: `1px solid ${listFilter === key ? `${GOLD}66` : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '6px' }}>
        Showing {rows.length} of {counts.matching}{search.trim() ? ` match${counts.matching === 1 ? '' : 'es'} for “${search.trim()}”` : ''}
      </div>

      {rows.length === 0 ? (
        <div style={{ color: '#4a5568', fontSize: '12px', padding: '10px 0' }}>{search.trim() || listFilter !== 'all' ? 'No opt-ins match this search.' : 'No opt-ins yet.'}</div>
      ) : (
        <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {rows.map((r) => {
            const src = SOURCE_LABELS[r.source] || SOURCE_LABELS.manual;
            const st = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '7px 10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e8e0d0', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.email}
                    {r.firstName ? <span style={{ color: '#6b7280' }}> · {r.firstName} {r.lastName || ''}</span> : null}
                  </div>
                  <div style={{ color: '#4a5568', fontSize: '10px' }}>
                    Opted in {fmt(r.optedInAt)}{r.confirmedAt ? ` · confirmed ${fmt(r.confirmedAt)}` : ''}{r.recordedBy ? ` · logged by ${r.recordedBy}` : ''}{r.batchLabel ? ` · ${r.batchLabel}` : ''}{r.listSubscribedAt ? ` · on list ${fmt(r.listSubscribedAt)}` : ''}
                  </div>
                </div>
                <span style={{ color: r.listSubscribedAt ? GOLD : '#f59e0b', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{r.listSubscribedAt ? '✓ On List' : '⚠ Not On List'}</span>
                <span style={{ color: src.color, fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{src.label}</span>
                <span style={{ color: st.color, fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {cursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          style={{ marginTop: '8px', width: '100%', background: 'rgba(255,255,255,0.04)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px', cursor: loadingMore ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}
        >
          {loadingMore ? 'Loading…' : `Load more (${counts.matching - rows.length} left)`}
        </button>
      )}
    </div>
  );
}