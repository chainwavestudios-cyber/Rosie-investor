/**
 * MarketingCampaignBuilder.jsx — schedules a Debt Call Coach marketing
 * campaign: when it starts, when it finishes, the daily window, how often it
 * sends, how many addresses per send, and which saved email goes out.
 * The schedule is computed first, so the lead count the campaign needs is
 * visible before anything is created.
 */
import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { buildSchedule, scheduleSummary, slotsPerDay } from '@/lib/debtMarketingSchedule';
import { detectWelcomeLink } from '@/lib/welcomeLink';
import Time12Picker from '@/components/shared/Time12Picker';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' };

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function MarketingCampaignBuilder({ availableLeads, templates, username, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    templateId: '',
    intro2TemplateId: '',
    welcomeLinkUrl: '',
    startDate: today(),
    startTime: '09:00',
    endDate: plusDays(7),
    endTime: '20:00',
    windowStart: '09:00',
    windowEnd: '17:00',
    intervalMinutes: 10,
    emailsPerSend: 1,
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const template = templates.find((t) => t.id === form.templateId);
  const intro2 = templates.find((t) => t.id === form.intro2TemplateId);

  // Picking the email also finds its welcome / personal message link.
  const chooseTemplate = (id) => {
    const chosen = templates.find((t) => t.id === id);
    setForm((prev) => ({
      ...prev,
      templateId: id,
      welcomeLinkUrl: chosen ? (detectWelcomeLink(chosen.bodyHtml) || prev.welcomeLinkUrl) : '',
    }));
  };

  const { times, summary } = useMemo(() => {
    const built = buildSchedule({
      startAt: `${form.startDate}T${form.startTime}`,
      endAt: `${form.endDate}T${form.endTime}`,
      windowStart: form.windowStart,
      windowEnd: form.windowEnd,
      intervalMinutes: form.intervalMinutes,
      emailsPerSend: form.emailsPerSend,
    });
    return { times: built, summary: scheduleSummary(built) };
  }, [form]);

  const days = Math.max(1, Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1);
  const perDay = slotsPerDay(form.windowStart, form.windowEnd, form.intervalMinutes) * Math.max(1, Number(form.emailsPerSend) || 1);
  const toSend = Math.min(times.length, availableLeads.length);
  const shortBy = Math.max(0, times.length - availableLeads.length);

  const create = async () => {
    if (saving) return;
    if (!form.name.trim()) { alert('Give the campaign a name.'); return; }
    if (!template) { alert('Choose the saved email to send.'); return; }
    if (!form.intro2TemplateId) { alert('Choose the Introduction 2 email — that is what goes out automatically when a lead watches the welcome message and clicks 2 of the 3 links.'); return; }
    if (toSend === 0) { alert('No emails can be scheduled — check the dates, window and the leads available in the group.'); return; }
    setSaving(true);
    try {
      const campaign = await base44.entities.DebtMarketingCampaign.create({
        name: form.name.trim(),
        emailTemplateId: template.id,
        emailTemplateName: template.name || '',
        intro2TemplateId: form.intro2TemplateId,
        intro2TemplateName: intro2?.name || '',
        welcomeLinkUrl: form.welcomeLinkUrl.trim(),
        subject: template.subject || '',
        startAt: `${form.startDate}T${form.startTime}:00`,
        endAt: `${form.endDate}T${form.endTime}:00`,
        windowStart: form.windowStart,
        windowEnd: form.windowEnd,
        intervalMinutes: Math.max(5, Number(form.intervalMinutes) || 5),
        emailsPerSend: Math.max(1, Number(form.emailsPerSend) || 1),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        leadsNeeded: times.length,
        totalSends: toSend,
        status: 'running',
        createdBy: username || 'admin',
      });

      const picks = availableLeads.slice(0, toSend);
      const rows = picks.map((lead, i) => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        vaultEntryId: lead.id,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        email: lead.email || '',
        state: lead.state || '',
        sendAt: times[i],
        status: 'pending',
      }));
      for (let i = 0; i < rows.length; i += 400) {
        await base44.entities.DebtMarketingSend.bulkCreate(rows.slice(i, i + 400));
      }
      const stampedAt = new Date().toISOString();
      await base44.entities.LeadVaultEntry.bulkUpdate(picks.map((lead) => ({ id: lead.id, marketingCampaignId: campaign.id, marketingAssignedAt: stampedAt })));

      setResult({ campaign: campaign.name, scheduled: rows.length, shortBy });
      setForm((prev) => ({ ...prev, name: '' }));
      onCreated?.();
    } catch (e) {
      alert('Could not schedule the campaign: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '18px' }}>
      <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Build an automated email campaign
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '10px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={ls}>Campaign name</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Rate drop follow-up — November" style={inp} />
        </div>
        <div>
          <label style={ls}>Start date</label>
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Start time</label>
          <Time12Picker value={form.startTime} onChange={(v) => set('startTime', v)} inputStyle={inp} />
        </div>
        <div>
          <label style={ls}>Finish date</label>
          <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Finish time</label>
          <Time12Picker value={form.endTime} onChange={(v) => set('endTime', v)} inputStyle={inp} />
        </div>
        <div>
          <label style={ls}>Window start (daily)</label>
          <Time12Picker value={form.windowStart} onChange={(v) => set('windowStart', v)} inputStyle={inp} />
        </div>
        <div>
          <label style={ls}>Window stop (daily)</label>
          <Time12Picker value={form.windowEnd} onChange={(v) => set('windowEnd', v)} inputStyle={inp} />
        </div>
        <div>
          <label style={ls}>Minutes between sends</label>
          <input type="number" min="5" value={form.intervalMinutes} onChange={(e) => set('intervalMinutes', e.target.value)} style={inp} />
        </div>
        <div>
          <label style={ls}>Addresses per send</label>
          <input type="number" min="1" value={form.emailsPerSend} onChange={(e) => set('emailsPerSend', e.target.value)} style={inp} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={ls}>Saved email from Debt Call Coach</label>
          <select value={form.templateId} onChange={(e) => chooseTemplate(e.target.value)} style={inp}>
            <option value="">— Select a saved email —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={ls}>Welcome message link (where “listen to my welcome message” points)</label>
          <input value={form.welcomeLinkUrl} onChange={(e) => set('welcomeLinkUrl', e.target.value)} placeholder="https://…" style={inp} />
          <div style={{ color: '#8a9ab8', fontSize: '10px', marginTop: '4px' }}>A click on this link is what counts as watching the welcome message.</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={ls}>Introduction 2 email (auto-sent when the welcome message is watched + 2 of the 3 links are clicked)</label>
          <select value={form.intro2TemplateId} onChange={(e) => set('intro2TemplateId', e.target.value)} style={inp}>
            <option value="">— Select the Introduction 2 email —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '12px', background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', fontSize: '12px', color: '#e8e0d0', lineHeight: 1.6 }}>
        <div><strong style={{ color: BLUE }}>{times.length}</strong> emails across <strong>{summary.days}</strong> day(s) — about <strong>{perDay}</strong> per day in the window ({days} calendar day(s) available).</div>
        <div style={{ marginTop: '4px' }}>
          This campaign needs <strong style={{ color: GOLD }}>{times.length}</strong> leads; the group has <strong>{availableLeads.length}</strong> available →
          {' '}<strong>{toSend}</strong> will be scheduled{shortBy > 0 ? ` (short by ${shortBy} leads)` : ''}.
        </div>
        <div style={{ marginTop: '4px' }}>
          Auto-chain: {intro2
            ? <><strong style={{ color: GOLD }}>{intro2.name}</strong> goes out when the welcome message is watched + 2 of the 3 links are clicked, then a call event is booked 4 hours later (or 12:30pm the next day).</>
            : <span style={{ color: '#f59e0b' }}>choose an Introduction 2 email to switch the auto-send on.</span>}
        </div>
      </div>

      <button onClick={create} disabled={saving} style={{ width: '100%', marginTop: '12px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '12px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: saving ? 0.6 : 1 }}>
        {saving ? '⏳ Scheduling…' : `📅 Schedule ${toSend} emails`}
      </button>

      {result && (
        <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(16,185,129,0.08)', borderRadius: '4px', color: GOLD, fontSize: '11px' }}>
          ✓ “{result.campaign}” scheduled with {result.scheduled} emails.
          {result.shortBy > 0 && <span style={{ color: '#f59e0b' }}> · {result.shortBy} more leads are needed to fill the whole window — distribute more to DCC Marketing.</span>}
        </div>
      )}
    </div>
  );
}