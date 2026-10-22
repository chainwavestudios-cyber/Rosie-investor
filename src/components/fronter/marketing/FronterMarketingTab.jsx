/**
 * FronterMarketingTab.jsx — The Marketing section inside the fronter portal.
 *
 * Holds the Stephani live video-review email: pick the contact cards it goes to,
 * send in one tap, and watch opens and link clicks land on those cards.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import VideoReviewEmailCard from './VideoReviewEmailCard';
import MarketingRecipientPicker from './MarketingRecipientPicker';

const GOLD = '#10b981';
const RED = '#ef4444';
const VIDEO_TEMPLATE = /stephani|video review/i;
const BATCH_SIZE = 25;
const SKIP_STATUSES = ['removed', 'migrated'];

export default function FronterMarketingTab({ username }) {
  const [template, setTemplate] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [lastSent, setLastSent] = useState({});
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templates, leadPage] = await Promise.all([
        base44.entities.FronterEmailTemplate.list('sortOrder', 100).catch(() => []),
        base44.entities.FronterLead.filter({ email: { $ne: null } }, { sort: '-updated_date', limit: 200 }).catch(() => ({ items: [] })),
      ]);
      const list = Array.isArray(templates) ? templates : (templates?.items || []);
      const tpl = list.find(t => VIDEO_TEMPLATE.test(t.label || '')) || null;
      setTemplate(tpl);
      setContacts(
        (leadPage?.items || [])
          .filter(c => (c.email || '').trim())
          .filter(c => !SKIP_STATUSES.includes(c.status))
      );

      if (tpl?.id) {
        const logs = await base44.entities.EmailLog.filter({ templateId: tpl.id }, '-sentAt', 200).catch(() => []);
        const rows = Array.isArray(logs) ? logs : (logs?.items || []);
        const map = {};
        rows.forEach(r => { if (r.leadId && !map[r.leadId]) map[r.leadId] = r.sentAt; });
        setLastSent(map);
      } else {
        setLastSent({});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  }, [contacts, query]);

  const toggle = (leadId) => setSelected(prev => (prev.includes(leadId) ? prev.filter(i => i !== leadId) : [...prev, leadId]));

  const send = async () => {
    if (!template?.id || !selected.length || sending) return;
    setSending(true);
    setResult(null);
    let sent = 0;
    const failures = [];
    try {
      for (let i = 0; i < selected.length; i += BATCH_SIZE) {
        const res = await base44.functions.invoke('sendFronterMarketingEmail', {
          templateId: template.id,
          leadIds: selected.slice(i, i + BATCH_SIZE),
          sentBy: username,
        });
        const data = res?.data || res;
        if (data?.error) throw new Error(data.error);
        sent += (data?.sent || []).length;
        failures.push(...(data?.failed || []));
      }
      setResult({ sent, failures });
      setSelected([]);
      await load();
    } catch (e) {
      setResult({ error: e?.message || String(e) });
    }
    setSending(false);
  };

  const disabled = !template?.id || !selected.length || sending;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📣 Marketing</div>
        <div style={{ color: '#8a9ab8', fontSize: '12px', marginTop: '4px' }}>
          Stephani's live video review — email a contact and they can meet Stephani on camera, then talk to a specialist on the phone.
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', padding: '40px', textAlign: 'center', fontSize: '13px' }}>Loading contacts…</div>
      ) : (
        <>
          <VideoReviewEmailCard template={template} />

          <MarketingRecipientPicker
            contacts={visible}
            total={contacts.length}
            selected={selected}
            lastSent={lastSent}
            query={query}
            onQuery={setQuery}
            onToggle={toggle}
            onSelectAll={() => setSelected(visible.map(c => c.id))}
            onClear={() => setSelected([])}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={send}
              disabled={disabled}
              style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '10px 22px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: disabled ? 0.5 : 1 }}
            >
              {sending ? '⏳ Sending…' : `📧 Send to ${selected.length} selected`}
            </button>
            {!!result?.error && <span style={{ color: RED, fontSize: '12px' }}>Send failed: {result.error}</span>}
            {!!result?.sent && (
              <span style={{ color: GOLD, fontSize: '12px' }}>
                ✓ Sent to {result.sent} contact{result.sent === 1 ? '' : 's'}
                {result.failures?.length ? ` · ${result.failures.length} skipped` : ''}
              </span>
            )}
          </div>

          {!!result?.failures?.length && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '10px 14px', color: '#fca5a5', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {result.failures.map(f => <div key={f.leadId}>{f.error}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}