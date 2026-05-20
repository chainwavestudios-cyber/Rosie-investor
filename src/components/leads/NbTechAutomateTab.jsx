import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { usePortalAuth } from '@/lib/PortalAuthContext';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const NB_TECH_TEMPLATES = [
  { id: 8032819, label: 'NB Tech 1' },
  { id: 8036170, label: 'NB Tech 2' },
  { id: 8036171, label: 'NB Tech 3' },
  { id: 8036172, label: 'NB Tech 4' },
];

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_COLORS = {
  active:    { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80',  border: 'rgba(74,222,128,0.3)'  },
  paused:    { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b',  border: 'rgba(245,158,11,0.3)'  },
  completed: { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa',  border: 'rgba(96,165,250,0.3)'  },
  cancelled: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444',  border: 'rgba(239,68,68,0.3)'   },
  draft:     { bg: 'rgba(255,255,255,0.06)', color: '#8a9ab8',  border: 'rgba(255,255,255,0.15)' },
};

const inp = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '12px',
  outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box',
};

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function ProgressBar({ value, max, color = '#818cf8' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '20px', height: '6px', overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '20px', transition: 'width 0.4s' }} />
    </div>
  );
}

// ─── Create Campaign Form ─────────────────────────────────────────────────────
function CreateCampaignForm({ onCreated, currentUsername }) {
  const [contactLists, setContactLists] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const [form, setForm] = useState({
    name: '',
    templateId: 8032819,
    contactListId: '',
    emailsPerSend: 2,
    frequencyMinutes: 30,
    startHour: 8,
    endHour: 17,
    durationDays: 7,
    daysOfWeek: [0,1,2,3,4,5,6],
  });

  const [previewLeads, setPreviewLeads] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    base44.entities.ContactList.list('-created_date', 100).then(setContactLists).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.contactListId) { setPreviewLeads([]); return; }
    setLoadingLeads(true);
    const load = async () => {
      try {
        const filtered = await base44.entities.Lead.filter({ contactListId: form.contactListId });
        const eligible = (filtered || []).filter(l => l.email && !l.badgeNbtechEmail && !l.migratedToPortal && !l.convertedToInvestorUserId && l.status !== 'not_interested');
        setPreviewLeads(eligible);
        setAllLeads(eligible);
      } catch {}
      setLoadingLeads(false);
    };
    load();
  }, [form.contactListId]);

  const toggleDay = (d) => {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d].sort(),
    }));
  };

  const totalSends = previewLeads.length > 0 && form.emailsPerSend > 0
    ? Math.ceil(previewLeads.length / form.emailsPerSend)
    : 0;

  // Estimate time to complete (approximate)
  const estimateHours = totalSends > 0 ? ((totalSends * form.frequencyMinutes) / 60).toFixed(1) : 0;

  const handleCreate = async () => {
    if (!form.name.trim()) { setMsg('⚠️ Campaign name required.'); return; }
    if (!form.contactListId) { setMsg('⚠️ Select a contact list.'); return; }
    if (previewLeads.length === 0) { setMsg('⚠️ No eligible leads found in this list.'); return; }
    if (form.daysOfWeek.length === 0) { setMsg('⚠️ Select at least one day.'); return; }

    setSaving(true); setMsg('');
    try {
      const templateLabel = NB_TECH_TEMPLATES.find(t => t.id === form.templateId)?.label || '';
      const list = contactLists.find(l => l.id === form.contactListId);
      const leadIds = previewLeads.map(l => l.id);

      // Calculate end date
      const endsAt = new Date(Date.now() + form.durationDays * 24 * 60 * 60 * 1000).toISOString();

      await base44.entities.EmailCampaign.create({
        name: form.name.trim(),
        templateId: form.templateId,
        templateLabel,
        contactListId: form.contactListId,
        contactListName: list?.name || '',
        totalLeads: leadIds.length,
        leadIds: JSON.stringify(leadIds),
        sentLeadIds: JSON.stringify([]),
        emailsPerSend: form.emailsPerSend,
        frequencyMinutes: form.frequencyMinutes,
        startHour: form.startHour,
        endHour: form.endHour,
        durationDays: form.durationDays,
        daysOfWeek: JSON.stringify(form.daysOfWeek),
        status: 'draft',
        endsAt,
        totalSent: 0,
        createdBy: currentUsername,
      });

      setMsg('✅ Campaign created! Activate it below to start sending.');
      setForm({ name: '', templateId: 8032819, contactListId: '', emailsPerSend: 2, frequencyMinutes: 30, startHour: 8, endHour: 17, durationDays: 7, daysOfWeek: [0,1,2,3,4,5,6] });
      setPreviewLeads([]);
      onCreated();
    } catch (e) {
      setMsg('❌ Error: ' + e.message);
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 6000);
  };

  return (
    <div style={{ background: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '6px', padding: '20px 24px', marginBottom: '28px' }}>
      <div style={{ color: '#818cf8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '18px' }}>🛠 Create Automated Campaign</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
        {/* Name */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Campaign Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. NB Tech 1 — May Wave" style={{ ...inp, width: '100%' }} />
        </div>

        {/* Template */}
        <div>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Template</label>
          <select value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: Number(e.target.value) }))}
            style={{ ...inp, width: '100%', cursor: 'pointer', colorScheme: 'dark', border: '1px solid rgba(129,140,248,0.4)', color: '#818cf8' }}>
            {NB_TECH_TEMPLATES.map(t => <option key={t.id} value={t.id} style={{ background: '#0d1b2a' }}>{t.label} (#{t.id})</option>)}
          </select>
        </div>

        {/* Contact List */}
        <div>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Contact List</label>
          <select value={form.contactListId} onChange={e => setForm(f => ({ ...f, contactListId: e.target.value }))}
            style={{ ...inp, width: '100%', cursor: 'pointer', colorScheme: 'dark' }}>
            <option value="">— Select a list —</option>
            {contactLists.map(l => <option key={l.id} value={l.id} style={{ background: '#0d1b2a' }}>{l.name} ({l.leadCount || 0})</option>)}
          </select>
          {loadingLeads && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>Loading leads…</div>}
          {previewLeads.length > 0 && <div style={{ color: '#4ade80', fontSize: '10px', marginTop: '4px' }}>✓ {previewLeads.length} eligible leads with email</div>}
        </div>

        {/* Emails per send */}
        <div>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Emails Per Send</label>
          <input type="number" min="1" max="50" value={form.emailsPerSend} onChange={e => setForm(f => ({ ...f, emailsPerSend: Math.max(1, Number(e.target.value)) }))}
            style={{ ...inp, width: '100%' }} />
        </div>

        {/* Frequency */}
        <div>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Frequency (minutes between sends)</label>
          <select value={form.frequencyMinutes} onChange={e => setForm(f => ({ ...f, frequencyMinutes: Number(e.target.value) }))}
            style={{ ...inp, width: '100%', cursor: 'pointer', colorScheme: 'dark' }}>
            {[5, 10, 15, 20, 30, 45, 60, 90, 120].map(m => <option key={m} value={m} style={{ background: '#0d1b2a' }}>Every {m} min</option>)}
          </select>
        </div>

        {/* Start / End Hour */}
        <div>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Start Time (ET)</label>
          <select value={form.startHour} onChange={e => setForm(f => ({ ...f, startHour: Number(e.target.value) }))}
            style={{ ...inp, width: '100%', cursor: 'pointer', colorScheme: 'dark' }}>
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i} style={{ background: '#0d1b2a' }}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>End Time (ET)</label>
          <select value={form.endHour} onChange={e => setForm(f => ({ ...f, endHour: Number(e.target.value) }))}
            style={{ ...inp, width: '100%', cursor: 'pointer', colorScheme: 'dark' }}>
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i} style={{ background: '#0d1b2a' }}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}</option>)}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Campaign Duration (days)</label>
          <input type="number" min="1" max="365" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: Math.max(1, Number(e.target.value)) }))}
            style={{ ...inp, width: '100%' }} />
        </div>

        {/* Days of week */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Days of Week</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                style={{
                  padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'Georgia, serif',
                  background: form.daysOfWeek.includes(i) ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${form.daysOfWeek.includes(i) ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: form.daysOfWeek.includes(i) ? '#818cf8' : '#6b7280',
                  fontWeight: form.daysOfWeek.includes(i) ? 'bold' : 'normal',
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary preview */}
      {previewLeads.length > 0 && form.emailsPerSend > 0 && (
        <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '12px 16px', fontSize: '12px', color: '#8a9ab8' }}>
          <span style={{ color: GOLD, fontWeight: 'bold' }}>📋 Summary: </span>
          <span style={{ color: '#818cf8', fontWeight: 'bold' }}>{previewLeads.length} leads</span>
          {' → '}
          <span>{form.emailsPerSend} emails every {form.frequencyMinutes} min, {form.startHour}:00–{form.endHour}:00 ET</span>
          {' → '}
          <span style={{ color: '#4ade80' }}>{totalSends} total send batches (~{estimateHours}h of active sending)</span>
          {' → '}
          <span>over {form.durationDays} day{form.durationDays !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={handleCreate} disabled={saving}
          style={{
            background: saving ? 'rgba(129,140,248,0.2)' : 'linear-gradient(135deg, #4f46e5, #818cf8)',
            color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 24px',
            cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px',
          }}>
          {saving ? '⏳ Creating…' : '✚ Create Campaign'}
        </button>
        {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#4ade80' : msg.startsWith('⚠️') ? '#f59e0b' : '#ef4444' }}>{msg}</span>}
      </div>
    </div>
  );
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────
function CampaignCard({ campaign, onRefresh }) {
  const [acting, setActing] = useState(false);

  let remaining = 0;
  try { remaining = JSON.parse(campaign.leadIds || '[]').length; } catch {}
  const total = campaign.totalLeads || 0;
  const sent = campaign.totalSent || 0;
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  const sc = STATUS_COLORS[campaign.status] || STATUS_COLORS.draft;

  let allowedDays = [0,1,2,3,4,5,6];
  try { allowedDays = JSON.parse(campaign.daysOfWeek || '[0,1,2,3,4,5,6]'); } catch {}

  const act = async (action) => {
    setActing(true);
    try {
      if (action === 'activate') {
        const nextSend = new Date().toISOString(); // fire immediately on first activation
        await base44.entities.EmailCampaign.update(campaign.id, {
          status: 'active',
          startedAt: campaign.startedAt || new Date().toISOString(),
          nextSendAt: nextSend,
        });
      } else if (action === 'pause') {
        await base44.entities.EmailCampaign.update(campaign.id, { status: 'paused' });
      } else if (action === 'resume') {
        await base44.entities.EmailCampaign.update(campaign.id, { status: 'active', nextSendAt: new Date().toISOString() });
      } else if (action === 'cancel') {
        if (!window.confirm('Cancel this campaign? Leads already sent will keep their badge.')) { setActing(false); return; }
        await base44.entities.EmailCampaign.update(campaign.id, { status: 'cancelled' });
      } else if (action === 'delete') {
        if (!window.confirm('Delete this campaign record?')) { setActing(false); return; }
        await base44.entities.EmailCampaign.delete(campaign.id);
      }
      onRefresh();
    } catch {}
    setActing(false);
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${sc.border}`, borderRadius: '6px', padding: '16px 20px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
            <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{campaign.name}</span>
            <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '20px', padding: '2px 10px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
              {campaign.status}
            </span>
            <span style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)', borderRadius: '4px', padding: '2px 8px', fontSize: '10px' }}>
              💡 {campaign.templateLabel || `#${campaign.templateId}`}
            </span>
          </div>
          <div style={{ color: '#6b7280', fontSize: '11px' }}>
            📁 {campaign.contactListName || 'Unknown list'} · {campaign.emailsPerSend} emails every {campaign.frequencyMinutes}min · {campaign.startHour}:00–{campaign.endHour}:00 ET · {allowedDays.map(d => DAYS[d]).join(', ')}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
          {campaign.status === 'draft' && (
            <button onClick={() => act('activate')} disabled={acting}
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)', borderRadius: '4px', padding: '5px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              ▶ Activate
            </button>
          )}
          {campaign.status === 'active' && (
            <button onClick={() => act('pause')} disabled={acting}
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '5px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              ⏸ Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button onClick={() => act('resume')} disabled={acting}
              style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '4px', padding: '5px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              ▶ Resume
            </button>
          )}
          {['draft','active','paused'].includes(campaign.status) && (
            <button onClick={() => act('cancel')} disabled={acting}
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px' }}>
              ✕ Cancel
            </button>
          )}
          {['completed','cancelled'].includes(campaign.status) && (
            <button onClick={() => act('delete')} disabled={acting}
              style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px' }}>
              🗑 Delete
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ color: '#8a9ab8', fontSize: '11px' }}>{sent} sent of {total} total ({pct}%)</span>
          <span style={{ color: '#4a5568', fontSize: '11px' }}>{remaining} remaining</span>
        </div>
        <ProgressBar value={sent} max={total} color={sc.color} />
      </div>

      {/* Timing info */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '10px', color: '#4a5568' }}>
        {campaign.lastSentAt && <span>Last sent: <span style={{ color: '#8a9ab8' }}>{fmtTime(campaign.lastSentAt)}</span></span>}
        {campaign.nextSendAt && campaign.status === 'active' && <span>Next send: <span style={{ color: '#f59e0b' }}>{fmtTime(campaign.nextSendAt)}</span></span>}
        {campaign.endsAt && <span>Expires: <span style={{ color: '#8a9ab8' }}>{fmtTime(campaign.endsAt)}</span></span>}
        {campaign.createdBy && <span>By: <span style={{ color: '#8a9ab8' }}>{campaign.createdBy}</span></span>}
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export default function NbTechAutomateTab() {
  const { portalUser } = usePortalAuth();
  const currentUsername = portalUser?.username || 'admin';
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.EmailCampaign.list('-created_date', 100);
      setCampaigns(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all' ? campaigns : campaigns.filter(c => c.status === statusFilter);
  const activeCnt = campaigns.filter(c => c.status === 'active').length;
  const totalSentAll = campaigns.reduce((a, c) => a + (c.totalSent || 0), 0);

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#e8e0d0', margin: '0 0 4px', fontSize: '18px', fontWeight: 'normal' }}>⚙️ Automated NB Tech Campaigns</h3>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
          Set up drip campaigns across all 4 NB Tech templates. Emails are sent in small batches on your schedule — never all at once.
          The automation runs every 5 minutes to check what's due.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Active Campaigns', value: activeCnt, color: '#4ade80', icon: '▶' },
          { label: 'Total Campaigns', value: campaigns.length, color: '#818cf8', icon: '📋' },
          { label: 'All-Time Sent', value: totalSentAll, color: GOLD, icon: '📧' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: '4px', padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color, fontSize: '18px' }}>{icon}</span>
            <div>
              <div style={{ color, fontSize: '20px', fontWeight: 'bold', lineHeight: 1 }}>{value}</div>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '10px 14px', marginBottom: '20px', fontSize: '11px', color: '#8a9ab8', display: 'flex', gap: '8px' }}>
        <span>⏱</span>
        <div>Campaigns fire every <strong style={{ color: '#f59e0b' }}>5 minutes</strong> (platform minimum). Set frequency to 30 min and it will skip until 30 min have passed. Sending window is in <strong style={{ color: '#f59e0b' }}>Eastern Time</strong>. Once all leads are sent, the campaign auto-completes.</div>
      </div>

      <CreateCampaignForm onCreated={load} currentUsername={currentUsername} />

      {/* Campaign List */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>Campaigns</span>
        <div style={{ flex: 1 }} />
        {['all','draft','active','paused','completed','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{
              background: statusFilter === s ? 'rgba(184,147,58,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${statusFilter === s ? 'rgba(184,147,58,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: statusFilter === s ? GOLD : '#6b7280', borderRadius: '20px',
              padding: '3px 10px', cursor: 'pointer', fontSize: '10px',
            }}>
            {s}
          </button>
        ))}
        <button onClick={load} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', fontSize: '14px' }} title="Refresh">🔄</button>
      </div>

      {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading campaigns…</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '12px' }}>
          {campaigns.length === 0 ? 'No campaigns yet. Create one above.' : `No ${statusFilter} campaigns.`}
        </div>
      )}
      {filtered.map(c => <CampaignCard key={c.id} campaign={c} onRefresh={load} />)}
    </div>
  );
}