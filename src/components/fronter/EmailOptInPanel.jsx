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

export default function EmailOptInPanel({ username }) {
  const [counts, setCounts] = useState({ total: 0, confirmed: 0, pending: 0, onList: 0 });
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const formUrl = `${window.location.origin}/email-optin`;

  const load = useCallback(async () => {
    try {
      const [total, confirmed, pending, onList, page] = await Promise.all([
        base44.entities.EmailOptIn.count({}),
        base44.entities.EmailOptIn.count({ status: 'confirmed' }),
        base44.entities.EmailOptIn.count({ status: 'pending' }),
        base44.entities.EmailOptIn.count({ status: 'confirmed', listSubscribedAt: { $ne: null } }),
        base44.entities.EmailOptIn.list('-optedInAt', 12),
      ]);
      setCounts({ total, confirmed, pending, onList });
      setRows(page?.items || page || []);
    } catch { /* list unavailable */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!confirm('Log an email opt-in for every lead on file (vault list and lead records) that has an email and no opt-in yet?')) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('emailOptIn', { action: 'generate', vault: true, fronterLeads: true, loggedBy: username });
      if (res?.data?.error) throw new Error(res.data.error);
      setResult(`✓ Logged ${res?.data?.created ?? 0} verbal opt-in${res?.data?.created === 1 ? '' : 's'}.`);
      await load();
    } catch (e) {
      setResult('⚠ ' + (e?.response?.data?.error || e?.message || 'Could not generate opt-ins.'));
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
          <button onClick={generate} disabled={busy} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '7px 14px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: busy ? 0.6 : 1 }}>{busy ? '⏳ Working…' : '⚡ Log Verbal Opt-Ins For Current Leads'}</button>
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
      </div>

      {result && <div style={{ color: result.startsWith('✓') ? GOLD : '#f59e0b', fontSize: '12px', marginBottom: '10px' }}>{result}</div>}

      {rows.length === 0 ? (
        <div style={{ color: '#4a5568', fontSize: '12px', padding: '10px 0' }}>No opt-ins yet.</div>
      ) : (
        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
                  <div style={{ color: '#4a5568', fontSize: '10px' }}>Opted in {fmt(r.optedInAt)}{r.confirmedAt ? ` · confirmed ${fmt(r.confirmedAt)}` : ''}{r.batchLabel ? ` · ${r.batchLabel}` : ''}</div>
                </div>
                <span style={{ color: src.color, fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{src.label}</span>
                <span style={{ color: st.color, fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}