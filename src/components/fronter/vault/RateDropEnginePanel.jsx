/**
 * RateDropEnginePanel.jsx — The Rate Drop Engine, inside the Lead Vault.
 *
 * Left: the mailer's copy + the field map that binds every mailer slot to a
 * contact-card field. Right: pick an available lead and preview the exact
 * mailer that will be generated and stored. Saving makes it the template every
 * future digital mailer uses.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

const COPY_FIELDS = [
  { key: 'name', label: 'Template Name', rows: 1 },
  { key: 'documentTitle', label: 'Masthead Title (black band)', rows: 1 },
  { key: 'noticeTitle', label: 'Notice Title', rows: 1 },
  { key: 'deadlineTime', label: 'Response Deadline Time', rows: 1 },
  { key: 'addresseeStatus', label: 'Account Status (addressee box)', rows: 2 },
  { key: 'overviewText', label: 'Notice Details & Program Overview (Paragraph 1)', rows: 5 },
  { key: 'qualifyText', label: 'Notice Details & Program Overview (Paragraph 2)', rows: 4 },
  { key: 'nextStepsText', label: 'Required Next Steps (intro line)', rows: 3 },
  { key: 'disclaimerText', label: 'Confidentiality & Disclaimer (small print)', rows: 5 },
];

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '4px', padding: '7px 9px', color: '#e8e0d0', fontSize: '12px', fontFamily: 'Georgia, serif',
};

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || '');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export default function RateDropEnginePanel({ adminUsername }) {
  const [tpl, setTpl] = useState(null);
  const [slots, setSlots] = useState([]);
  const [sources, setSources] = useState([]);
  const [inboundPhone, setInboundPhone] = useState('');
  const [leads, setLeads] = useState([]);
  const [vaultLeads, setVaultLeads] = useState([]);
  const [pick, setPick] = useState('');
  const [html, setHtml] = useState('');
  const [sample, setSample] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setBusy('load');
    try {
      const res = await base44.functions.invoke('rateDropGenerateMailer', { action: 'template' });
      const data = res?.data || {};
      setTpl(data.template || null);
      setSlots(data.slots || []);
      setSources(data.sources || []);
      setInboundPhone(data.inboundPhone || '');
      const page = await base44.entities.FronterLead.filter({ status: 'prospect' }, { sort: '-created_date', limit: 200 });
      setLeads(page?.items || page || []);
      // Leads still in the vault that can be distributed: validated, callable,
      // undistributed, not DNC/litigator blocked.
      const vaultPage = await base44.entities.LeadVaultEntry.filter({
        validationStatus: 'validated',
        phoneValid: true,
        phoneLineType: { $ne: 'voip' },
        destination: 'none',
        dncFederal: { $ne: true },
        dncState: { $ne: true },
        litigator: { $ne: true },
      }, { sort: '-created_date', limit: 500 });
      setVaultLeads(vaultPage?.items || vaultPage || []);
    } catch (e) {
      setMsg('Could not load the engine: ' + (e?.message || 'unknown error'));
    }
    setBusy('');
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key, value) => setTpl(prev => ({ ...prev, [key]: value }));
  const fieldMap = tpl ? parseJson(tpl.fieldMapJson, {}) : {};
  const setMapping = (slot, source) => set('fieldMapJson', JSON.stringify({ ...fieldMap, [slot]: source }));
  const benefits = tpl ? parseJson(tpl.benefitsJson, []) : [];
  const eligibility = tpl ? parseJson(tpl.eligibilityJson, []) : [];
  const nextSteps = tpl ? parseJson(tpl.nextStepsJson, []) : [];

  // Lists edit as one line per entry: "Title: description" / "Label: Value".
  const asLines = (rows, first, second) => rows
    .map(r => (typeof r === 'string' ? r : [r?.[first], r?.[second]].filter(Boolean).join(': ')))
    .join('\n');

  const setPairs = (key, text, first, second) => set(key, JSON.stringify(
    text.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
      const i = line.indexOf(':');
      return {
        [first]: i === -1 ? line : line.slice(0, i).trim(),
        [second]: i === -1 ? '' : line.slice(i + 1).trim(),
      };
    })
  ));

  const draftPayload = () => ({
    name: tpl.name, documentTitle: tpl.documentTitle, noticeTitle: tpl.noticeTitle,
    deadlineTime: tpl.deadlineTime || '', addresseeStatus: tpl.addresseeStatus || '',
    overviewText: tpl.overviewText || '', qualifyText: tpl.qualifyText || '',
    benefitsJson: JSON.stringify(benefits), eligibilityJson: JSON.stringify(eligibility),
    nextStepsText: tpl.nextStepsText || '', nextStepsJson: JSON.stringify(nextSteps),
    disclaimerText: tpl.disclaimerText || '',
    savingsPercent: tpl.savingsPercent, respondByDays: tpl.respondByDays,
    ctaPhoneOverride: tpl.ctaPhoneOverride || '', fieldMapJson: JSON.stringify(fieldMap),
  });

  // mock = true renders the mailer from sample card data, so the field map can be
  // tuned into shape before a real card is used.
  const preview = async (mock = false) => {
    if (!mock && !pick) { setMsg('Pick an available lead, or use the test mailer to preview with sample data.'); return; }
    const [source, id] = pick.split(':');
    const target = source === 'vault' ? { vaultEntryId: id } : { leadId: id };
    setBusy('preview'); setMsg('');
    try {
      const res = await base44.functions.invoke('rateDropGenerateMailer',
        mock ? { action: 'preview', mock: true, template: draftPayload() } : { action: 'preview', ...target, template: draftPayload() });
      setHtml(res?.data?.html || '');
      setSample(!!res?.data?.mock);
      setMsg(mock ? 'Test mailer built from sample card data (Sample Homeowner · NFS-99999-999 · $20,000). Nothing was stored.' : '');
    } catch (e) { setMsg('Preview failed: ' + (e?.message || 'unknown error')); }
    setBusy('');
  };

  const save = async () => {
    setBusy('save'); setMsg('');
    try {
      const payload = { ...draftPayload(), configName: 'default', updatedBy: adminUsername || 'admin', updatedAt: new Date().toISOString() };
      const existing = await base44.entities.RateDropTemplate.filter({ configName: 'default' });
      const row = (existing?.items || existing || [])[0];
      if (row) await base44.entities.RateDropTemplate.update(row.id, payload);
      else await base44.entities.RateDropTemplate.create(payload);
      setMsg('Template saved — every new digital mailer is generated from it.');
    } catch (e) { setMsg('Save failed: ' + (e?.message || 'unknown error')); }
    setBusy('');
  };

  const rebuild = async () => {
    const ids = leads.map(l => l.id).filter(Boolean);
    if (!ids.length) { setMsg('No prospect contact cards to rebuild.'); return; }
    setBusy('rebuild'); setMsg('');
    try {
      const res = await base44.functions.invoke('rateDropGenerateMailer', { action: 'generate', leadIds: ids });
      setMsg(`Rebuilt ${res?.data?.generated ?? 0} mailers with the saved template.`);
    } catch (e) { setMsg('Rebuild failed: ' + (e?.message || 'unknown error')); }
    setBusy('');
  };

  if (!tpl) {
    return <div style={{ color: '#6b7280', fontSize: '13px', padding: '30px', textAlign: 'center' }}>{busy ? 'Loading the Rate Drop Engine…' : msg || 'No template available.'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold' }}>📨 Rate Drop Engine</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
            The digital mailer every contact card is issued with · phone printed: <span style={{ color: BLUE }}>{inboundPhone || 'incoming AI line not set'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={rebuild} disabled={!!busy} style={{ background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '11px' }}>
            {busy === 'rebuild' ? 'Rebuilding…' : '↻ Rebuild prospect mailers'}
          </button>
          <button onClick={save} disabled={!!busy} style={{ background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {busy === 'save' ? 'Saving…' : '💾 Save Template'}
          </button>
        </div>
      </div>

      {msg && <div style={{ color: '#8a9ab8', fontSize: '11px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '8px 10px' }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: '16px', alignItems: 'start' }}>
        {/* ── Editor ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>Mailer Copy</div>
            {COPY_FIELDS.map(f => (
              <div key={f.key}>
                <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>{f.label}</div>
                {f.rows > 1
                  ? <textarea value={tpl[f.key] || ''} onChange={e => set(f.key, e.target.value)} rows={f.rows} style={inputStyle} />
                  : <input value={tpl[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={inputStyle} />}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Reduction % (savings shown)</div>
                <input type="number" value={tpl.savingsPercent || 60} onChange={e => set('savingsPercent', Number(e.target.value))} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Respond-By (days)</div>
                <input type="number" value={tpl.respondByDays || 30} onChange={e => set('respondByDays', Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Phone Override (empty = incoming AI agent line)</div>
              <input value={tpl.ctaPhoneOverride || ''} onChange={e => set('ctaPhoneOverride', e.target.value)} placeholder={inboundPhone} style={inputStyle} />
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Key Program Benefits (one per line — Title: description)</div>
              <textarea value={asLines(benefits, 'title', 'text')} onChange={e => setPairs('benefitsJson', e.target.value, 'title', 'text')} rows={7} style={inputStyle} />
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Summary of Eligibility (one per line — Label: Value)</div>
              <textarea value={asLines(eligibility, 'label', 'value')} onChange={e => setPairs('eligibilityJson', e.target.value, 'label', 'value')} rows={5} style={inputStyle} />
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Required Next Steps (one per line — numbered automatically)</div>
              <textarea value={nextSteps.join('\n')} onChange={e => set('nextStepsJson', JSON.stringify(e.target.value.split('\n').map(s => s.trim()).filter(Boolean)))} rows={4} style={inputStyle} />
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ color: PURPLE, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Field Map — mailer field → contact card field</div>
            {slots.map(s => (
              <div key={s.slot} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <div style={{ width: '42%', color: '#e8e0d0', fontSize: '11px' }}>{s.label}</div>
                <div style={{ color: '#4b5563', fontSize: '11px' }}>→</div>
                <select value={fieldMap[s.slot] || ''} onChange={e => setMapping(s.slot, e.target.value)} style={{ ...inputStyle, flex: 1, padding: '5px 8px' }}>
                  <option value="">— not mapped —</option>
                  {sources.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* ── Preview ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Preview against an available lead</div>
              <select value={pick} onChange={e => setPick(e.target.value)} style={inputStyle}>
                <option value="">— select an available lead —</option>
                {vaultLeads.length > 0 && (
                  <optgroup label={`Available in vault (${vaultLeads.length})`}>
                    {vaultLeads.map(e => (
                      <option key={e.id} value={`vault:${e.id}`}>
                        {e.firstName} {e.lastName}{e.city ? ` · ${e.city}, ${e.state}` : ''}{e.estimatedDebt ? ` · $${Number(e.estimatedDebt).toLocaleString('en-US')}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {leads.length > 0 && (
                  <optgroup label={`Prospect contact cards (${leads.length})`}>
                    {leads.map(l => (
                      <option key={l.id} value={`card:${l.id}`}>
                        {l.leadNumber ? `${l.leadNumber} · ` : ''}{l.firstName} {l.lastName}{l.noticeId ? ` · ${l.noticeId}` : ''}{l.city ? ` · ${l.city}, ${l.state}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <button onClick={() => preview(true)} disabled={!!busy} style={{ background: 'rgba(167,139,250,0.15)', color: PURPLE, border: `1px solid ${PURPLE}55`, borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              🧪 Test mailer
            </button>
            <button onClick={() => preview(false)} disabled={!!busy} style={{ background: `linear-gradient(135deg,#3b82f6,${BLUE})`, color: DARK, border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              {busy === 'preview' ? 'Building…' : '👁 Preview'}
            </button>
          </div>
          {html
            ? <>
                <div style={{ color: sample ? PURPLE : '#4b5563', fontSize: '10px' }}>{sample ? 'Test mailer — sample card data, nothing stored' : 'Preview — from the selected contact card'}</div>
                <iframe title="Rate Drop mailer preview" srcDoc={html} style={{ width: '100%', height: '900px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', background: '#ffffff' }} />
              </>
            : <div style={{ border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '4px', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: '12px', textAlign: 'center', padding: '20px' }}>Press 🧪 Test mailer to build one from sample data, or pick a lead and press 👁 Preview</div>}
        </div>
      </div>
    </div>
  );
}