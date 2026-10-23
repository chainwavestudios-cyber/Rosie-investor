/**
 * TemplateLibrary.jsx — the reusable email designs the campaigns send.
 *
 * The design lives here (subject, HTML, plain text, the tags it uses) and stays
 * separate from the sending engine: editing a mailer never touches a campaign.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, Field, GOLD, MUTED, SURFACE, BORDER, inputStyle } from './kit';
import { templateTags } from './templateTags';

const CATEGORIES = ['invitation', 'intro', 'follow_up', 'warm_lead', 'notice', 'other'];
const CATEGORY_LABELS = { warm_lead: 'Warm Lead' };
const categoryLabel = (value) => CATEGORY_LABELS[value] || String(value || 'other').replace('_', ' ');
const BLANK = { name: '', category: 'invitation', subject: '', previewText: '', bodyHtml: '', bodyText: '', notes: '' };

export default function TemplateLibrary({ username, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const page = await base44.entities.EmailCampaignTemplate.list('-created_date', 100).catch(() => []);
    setTemplates(page?.items || page || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const edit = (template) => {
    setDraft(template ? { ...template } : { ...BLANK });
    setNotice('');
    setError('');
  };

  const save = async () => {
    if (!draft.name.trim()) { setError('Give the template a name.'); return; }
    if (!draft.bodyHtml.trim()) { setError('Paste the email HTML — the library stores the design, the campaign fills the tags.'); return; }
    setBusy('save');
    setError('');
    try {
      const tags = templateTags(`${draft.subject || ''}\n${draft.bodyHtml || ''}\n${draft.bodyText || ''}`);
      const payload = {
        name: draft.name.trim(),
        category: draft.category,
        subject: draft.subject || '',
        previewText: draft.previewText || '',
        bodyHtml: draft.bodyHtml,
        bodyText: draft.bodyText || '',
        requiredVarsJson: JSON.stringify(tags),
        source: draft.source || 'library',
        updatedBy: username || 'admin',
        notes: draft.notes || '',
      };
      if (draft.id) {
        await base44.entities.EmailCampaignTemplate.update(draft.id, { ...payload, version: Number(draft.version || 1) + 1 });
        setNotice(`Saved — version ${Number(draft.version || 1) + 1}.`);
      } else {
        await base44.entities.EmailCampaignTemplate.create({ ...payload, version: 1 });
        setNotice('Template added to the library.');
      }
      setDraft(null);
      await load();
    } catch (e) {
      setError(e?.message || 'The template could not be saved.');
    }
    setBusy('');
  };

  const remove = async (template) => {
    setBusy(template.id);
    await base44.entities.EmailCampaignTemplate.delete(template.id).catch(() => {});
    setBusy('');
    await load();
  };

  const tags = draft ? templateTags(`${draft.subject || ''}\n${draft.bodyHtml || ''}\n${draft.bodyText || ''}`) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📚 Email Template Library</div>
          <div style={{ color: MUTED, fontSize: '11px', marginTop: '3px' }}>
            Self-contained HTML with hosted images. Personalization tags are filled per recipient at send time — {'{{FirstName}}'}, {'{{RosieInviteLink}}'}, {'{{ChrisInviteLink}}'}, {'{{UnsubscribeUrl}}'} and {'{{CompanyMailingAddress}}'} all resolve.
          </div>
        </div>
        <Btn tone="gold" onClick={() => edit(null)}>＋ New template</Btn>
        <Btn tone="ghost" onClick={onBack}>← Campaigns</Btn>
      </div>

      {draft ? (
        <Card
          title={draft.id ? `Edit “${draft.name || 'template'}”` : 'New template'}
          hint="Version rises on every save, so a campaign always knows which mailer it sent."
          actions={
            <div style={{ display: 'flex', gap: '7px' }}>
              <Btn tone="ghost" onClick={() => setDraft(null)}>Cancel</Btn>
              <Btn tone="gold" onClick={save} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : '💾 Save template'}</Btn>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '10px' }}>
            <Field label="Template name">
              <input style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Rosie invitation — rate drop" />
            </Field>
            <Field label="Category">
              <select style={inputStyle} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {CATEGORIES.map((option) => <option key={option} value={option}>{categoryLabel(option)}</option>)}
              </select>
            </Field>
            <Field label="Subject line">
              <input style={inputStyle} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="{{FirstName}}, your rate drop eligibility is on file" />
            </Field>
            <Field label="Preview text" hint="The line inboxes show beside the subject.">
              <input style={inputStyle} value={draft.previewText} onChange={(e) => setDraft({ ...draft, previewText: e.target.value })} />
            </Field>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Field label="Email HTML" hint={`${(draft.bodyHtml || '').length.toLocaleString()} characters — keep images hosted in the app, not embedded as base64.`}>
              <textarea style={{ ...inputStyle, minHeight: '220px', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '11px' }} value={draft.bodyHtml} onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })} />
            </Field>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Field label="Plain-text alternative" hint="Optional — generated from the HTML when left empty.">
              <textarea style={{ ...inputStyle, minHeight: '90px', fontSize: '11px' }} value={draft.bodyText} onChange={(e) => setDraft({ ...draft, bodyText: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            {tags.map((tag) => <span key={tag} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '3px', padding: '2px 7px', fontSize: '10px', color: GOLD }}>{`{{${tag}}}`}</span>)}
            {!tags.length && <span style={{ color: DIM, fontSize: '10px' }}>No tags yet — this email would go out identical for everyone.</span>}
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
        </Card>
      ) : (
        <Card title="Templates" hint="Copied in from your Debt Call Coach mailers and Fronter templates from step 3 of a campaign.">
          {notice && <div style={{ color: GOLD, fontSize: '11px', marginBottom: '10px' }}>{notice}</div>}
          {!templates.length && <div style={{ color: DIM, fontSize: '12px' }}>Nothing in the library yet — add one, or copy an existing mailer in from step 3.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '10px' }}>
            {templates.map((template) => (
              <div key={template.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '5px', padding: '11px 13px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{template.name}</span>
                  <span style={{ color: MUTED, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{categoryLabel(template.category)}</span>
                  <span style={{ color: DIM, fontSize: '10px' }}>v{template.version || 1}</span>
                </div>
                <div style={{ color: MUTED, fontSize: '11px', marginTop: '5px' }}>{template.subject || '(no subject)'}</div>
                <div style={{ color: DIM, fontSize: '10px', marginTop: '5px' }}>
                  {template.source && template.source !== 'library' ? `copied from ${template.source.replace('_', ' ')} · ` : ''}
                  {(template.bodyHtml || '').length.toLocaleString()} characters
                  {(() => { try { const tags = JSON.parse(template.requiredVarsJson || '[]'); return tags.length ? ` · ${tags.length} tags` : ''; } catch { return ''; } })()}
                </div>
                <div style={{ display: 'flex', gap: '7px', marginTop: '9px' }}>
                  <Btn tone="ghost" onClick={() => edit(template)}>✎ Edit</Btn>
                  <Btn tone="danger" onClick={() => remove(template)} disabled={busy === template.id}>{busy === template.id ? '…' : 'Delete'}</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}