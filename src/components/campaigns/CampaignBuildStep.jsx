/**
 * CampaignBuildStep.jsx — step 3: which email, which subject, which account.
 *
 * The design lives in the template library; this step only picks it and copies an
 * existing mailer in when the library does not have it yet.
 */
import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, Field, GOLD, MUTED, SURFACE, BORDER, inputStyle } from './kit';

export default function CampaignBuildStep({ campaign, templates, loadTemplates, save }) {
  const [sourceTemplates, setSourceTemplates] = useState([]);
  const [account, setAccount] = useState({ loading: true, emailAddress: '', note: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      const [debt, fronter] = await Promise.all([
        base44.entities.DebtEmailTemplate.list('-created_date', 50).catch(() => []),
        base44.entities.FronterEmailTemplate.list('-created_date', 50).catch(() => []),
      ]);
      const list = [
        ...(debt?.items || debt || []).map((t) => ({ kind: 'debt_coach', id: t.id, name: t.name, subject: t.subject, html: t.bodyHtml, text: '' })),
        ...(fronter?.items || fronter || []).map((t) => ({ kind: 'fronter', id: t.id, name: t.label, subject: t.subject, html: t.body, text: '' })),
      ];
      setSourceTemplates(list);

      const res = await base44.functions.invoke('emailCampaignSend', { mode: 'accounts' }).catch(() => null);
      const data = res?.data || res;
      setAccount({ loading: false, emailAddress: data?.emailAddress || '', note: data?.note || '' });
    })();
  }, []);

  // A campaign always sends the library copy, so a mailer counts as available once
  // its source has been brought across (matched by the source it came from).
  const copiedIds = useMemo(() => new Set(templates.map((t) => t.sourceTemplateId).filter(Boolean)), [templates]);

  const copyIntoLibrary = (source) => base44.entities.EmailCampaignTemplate.create({
    name: source.name || 'Imported mailer',
    category: source.kind === 'debt_coach' ? 'intro' : 'other',
    subject: source.subject || '',
    bodyHtml: source.html,
    bodyText: source.text || '',
    source: source.kind,
    sourceTemplateId: source.id,
    version: 1,
    updatedBy: campaign?.createdBy || '',
  });

  const copyIn = async (source) => {
    if (!source.html) { setError(`“${source.name}” has no HTML body to copy.`); return; }
    setBusy(source.id);
    setError('');
    setNotice('');
    try {
      const created = await copyIntoLibrary(source);
      await loadTemplates();
      await save({ templateId: created.id, templateName: created.name });
      setNotice(`“${created.name}” is now in the library — pick it above.`);
    } catch (e) {
      setError(e?.message || 'That mailer could not be copied into the library.');
    }
    setBusy('');
  };

  const copyAll = async () => {
    const pending = sourceTemplates.filter((s) => s.html && !copiedIds.has(s.id));
    setError('');
    setNotice('');
    if (!pending.length) { setNotice('Every existing mailer is already in the library.'); return; }
    setBusy('all');
    let added = 0;
    let failed = 0;
    for (const source of pending) {
      try {
        await copyIntoLibrary(source);
        added += 1;
      } catch {
        failed += 1;
      }
    }
    await loadTemplates();
    setNotice(`${added} mailer${added === 1 ? '' : 's'} copied into the library${failed ? `, ${failed} could not be copied` : ''} — all of them are in the list above now.`);
    setBusy('');
  };

  const selected = templates.find((t) => t.id === campaign?.templateId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Card title="Step 3 — Choose the email" hint="This list is your template library — copy your Debt Call Coach and Fronter mailers in below and they appear here. A campaign always sends the library copy, so editing a design never touches a running campaign.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '10px' }}>
          <Field label="Email template">
            <select
              style={inputStyle}
              value={campaign?.templateId || ''}
              onChange={async (e) => {
                const template = templates.find((t) => t.id === e.target.value);
                await save({ templateId: e.target.value, templateName: template?.name || '' });
              }}
            >
              <option value="">— choose a template —</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({template.category})</option>)}
            </select>
          </Field>
          <Field label="Subject override" hint="Leave empty to send the template's own subject line.">
            <input
              style={inputStyle}
              value={campaign?.subject || ''}
              placeholder={selected?.subject || 'Uses the template subject'}
              onChange={(e) => save({ subject: e.target.value })}
            />
          </Field>
          <Field label="From name shown to recipients" hint="Sends always go out from the connected Gmail account.">
            <input style={inputStyle} value={campaign?.senderName || ''} placeholder="Debt Solutions Inc" onChange={(e) => save({ senderName: e.target.value })} />
          </Field>
          <Field label="Connected sending account">
            <input style={{ ...inputStyle, color: MUTED }} readOnly value={account.loading ? 'Checking…' : account.emailAddress || 'Gmail connected'} />
          </Field>
        </div>
        {account.note && <div style={{ color: DIM, fontSize: '10px', marginTop: '8px' }}>{account.note}</div>}
        {selected && (
          <div style={{ color: MUTED, fontSize: '11px', marginTop: '10px' }}>
            Using <strong style={{ color: GOLD }}>{selected.name}</strong>
            {selected.version ? ` · v${selected.version}` : ''}
            {selected.updatedBy ? ` · last saved by ${selected.updatedBy}` : ''}
            {' · '}{(selected.bodyHtml || '').length.toLocaleString()} characters of HTML
          </div>
        )}
      </Card>

      <Card
        title="Copy your existing mailers into the library"
        hint={`Your Debt Call Coach mailers and Fronter templates, brought across with their subject and body so the campaign can personalize them — ${sourceTemplates.length} found, ${sourceTemplates.filter((source) => copiedIds.has(source.id)).length} already in the library.`}
        actions={
          <Btn tone="gold" onClick={copyAll} disabled={busy === 'all' || !sourceTemplates.length}>
            {busy === 'all' ? 'Copying…' : '⤵ Copy all into library'}
          </Btn>
        }
      >
        {!sourceTemplates.length && <div style={{ color: DIM, fontSize: '12px' }}>No existing mailers were found.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '8px' }}>
          {sourceTemplates.map((source) => (
            <div key={`${source.kind}-${source.id}`} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '5px', padding: '10px 12px' }}>
              <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{source.name}</div>
              <div style={{ color: DIM, fontSize: '10px', marginTop: '3px' }}>
                {source.kind === 'debt_coach' ? 'Debt Call Coach mailer' : 'Fronter template'} · {(source.html || '').length.toLocaleString()} characters
              </div>
              <div style={{ marginTop: '8px' }}>
                {copiedIds.has(source.id) ? (
                  <span style={{ color: '#10b981', fontSize: '10px' }}>✓ Already in the library</span>
                ) : (
                  <Btn tone="ghost" onClick={() => copyIn(source)} disabled={busy === source.id || busy === 'all'}>{busy === source.id ? 'Copying…' : '⤵ Copy into library'}</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
        {notice && <div style={{ color: GOLD, fontSize: '11px', marginTop: '10px' }}>{notice}</div>}
        {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
      </Card>
    </div>
  );
}