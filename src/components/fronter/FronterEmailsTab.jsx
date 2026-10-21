/**
 * FronterEmailsTab — Super-admin-only email template management for the
 * fronter system. Mirrors DebtEmailsTab but uses the FronterEmailTemplate
 * entity. All templates and automation rules live here.
 *
 * Template types:
 *   - manual: sent on demand from the credentials popup / contact card button
 *   - follow_up: auto-sent when a lead opens their creds email + clicks 2/3 links
 *   - custom_automation: reserved for future trigger-based automations
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useQuillImageModules } from '@/utils/quillImageUpload';
import { insertWelcomeTracker } from '@/utils/quillWelcomeTracker';
import EmailOptInPanel from './EmailOptInPanel';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const TYPE_LABELS = {
  manual: { label: '✋ Manual', color: GOLD },
  follow_up: { label: '📨 Follow-Up (Auto)', color: BLUE },
  custom_automation: { label: '⚙️ Custom Automation', color: PURPLE },
};

const quillFormats = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'align', 'list', 'link', 'image'];

export default function FronterEmailsTab({ username }) {
  const quillRef = useRef(null);
  const quillModules = useQuillImageModules(quillRef);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.FronterEmailTemplate.list('sortOrder', 100);
      setTemplates(page?.items || page || []);
    } catch { setTemplates([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const startNew = () => {
    setEditing({
      label: '', templateType: 'manual', subject: '', body: '',
      triggerOffsetHours: 0, triggerTimeOfDay: '', enabled: true,
      attachToContactCard: false, buttonLabel: '', buttonColor: '#10b981',
      trackingEnabled: true, includeSignature: true, sortOrder: templates.length + 1,
    });
  };

  const save = async () => {
    if (!editing?.label?.trim()) { alert('Template label is required'); return; }
    setSaving(true);
    try {
      const payload = { ...editing, updatedBy: username };
      if (editing.id) {
        await base44.entities.FronterEmailTemplate.update(editing.id, payload);
      } else {
        await base44.entities.FronterEmailTemplate.create(payload);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(null);
      loadTemplates();
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const del = async (tpl) => {
    if (!confirm(`Delete "${tpl.label}"?`)) return;
    try {
      await base44.entities.FronterEmailTemplate.delete(tpl.id);
      loadTemplates();
    } catch (e) { alert('Delete failed: ' + (e?.message || String(e))); }
  };

  const update = (field, value) => setEditing(prev => ({ ...prev, [field]: value }));

  // ── Editor view ──
  if (editing) {
    const typeCfg = TYPE_LABELS[editing.templateType] || TYPE_LABELS.manual;
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setEditing(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px' }}>← Back</button>
            <span style={{ color: typeCfg.color, fontSize: '16px', fontWeight: 'bold' }}>{editing.id ? 'Edit Template' : 'New Email Template'}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {saved && <span style={{ color: GOLD, fontSize: '12px' }}>✓ Saved</span>}
            <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>{saving ? '⏳ Saving…' : '💾 Save Template'}</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div><label style={ls}>Template Label</label><input value={editing.label} onChange={e => update('label', e.target.value)} placeholder="e.g. Follow-Up, Welcome Email" style={inp} /></div>
          <div>
            <label style={ls}>Template Type</label>
            <select value={editing.templateType} onChange={e => update('templateType', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="manual">✋ Manual (send on demand)</option>
              <option value="follow_up">📨 Follow-Up (auto-sent on email open + link clicks)</option>
              <option value="custom_automation">⚙️ Custom Automation</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>Email Subject <span style={{ color: '#4a5568', textTransform: 'none', letterSpacing: '0' }}>(supports {'{{firstName}}'}, {'{{email}}'})</span></label>
          <input value={editing.subject} onChange={e => update('subject', e.target.value)} placeholder="{{firstName}}, ready to take the next step?" style={inp} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ ...ls, marginBottom: 0 }}>Email Body — Full Editor</label>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => insertWelcomeTracker(quillRef, null, null)}
              title="Wrap the selected text in a trackable {{personalMessageUrl}} link"
              style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
            >
              🎙️ Insert Welcome Tracker
            </button>
          </div>
          <div style={{ background: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
            <ReactQuill
              ref={quillRef}
              value={editing.body || ''}
              onChange={(val) => update('body', val)}
              modules={quillModules}
              formats={quillFormats}
              theme="snow"
              style={{ height: '300px', marginBottom: '42px' }}
            />
          </div>
        </div>

        {/* Automation Rules */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>⚙️ Automation Rules</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={ls}>Trigger Offset (hours)</label>
              <input type="number" value={editing.triggerOffsetHours} onChange={e => update('triggerOffsetHours', Number(e.target.value))} style={inp} title="Hours relative to trigger event" />
            </div>
            <div>
              <label style={ls}>Time of Day (optional)</label>
              <input type="time" value={editing.triggerTimeOfDay || ''} onChange={e => update('triggerTimeOfDay', e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: editing.enabled ? GOLD : '#6b7280', fontSize: '12px', fontWeight: 'bold' }}>
                <input type="checkbox" checked={editing.enabled} onChange={e => update('enabled', e.target.checked)} style={{ cursor: 'pointer' }} />
                {editing.enabled ? '✓ Automation Active' : '⏸ Disabled'}
              </label>
            </div>
          </div>
          {editing.templateType === 'follow_up' && (
            <div style={{ color: BLUE, fontSize: '11px', marginTop: '10px', lineHeight: 1.5 }}>
              📨 This template auto-sends when a lead opens their credentials email AND clicks at least 2 of 3 tracked links (Trustpilot, BBB, Website). Disable to pause the automation.
            </div>
          )}
        </div>

        {/* Contact Card Button Settings */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>🔘 Contact Card Button</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: editing.attachToContactCard ? GOLD : '#6b7280', fontSize: '12px', fontWeight: 'bold', marginBottom: editing.attachToContactCard ? '12px' : '0' }}>
            <input type="checkbox" checked={editing.attachToContactCard} onChange={e => update('attachToContactCard', e.target.checked)} style={{ cursor: 'pointer' }} />
            Show as button on fronter contact card
          </label>
          {editing.attachToContactCard && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div><label style={ls}>Button Label</label><input value={editing.buttonLabel || ''} onChange={e => update('buttonLabel', e.target.value)} placeholder="e.g. Send Follow-Up" style={inp} /></div>
              <div><label style={ls}>Button Color</label><input type="color" value={editing.buttonColor || '#10b981'} onChange={e => update('buttonColor', e.target.value)} style={{ ...inp, height: '38px', cursor: 'pointer', padding: '2px' }} /></div>
            </div>
          )}
        </div>

        {/* Tracking & Signature */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: editing.trackingEnabled ? PURPLE : '#6b7280', fontSize: '12px', fontWeight: 'bold' }}>
              <input type="checkbox" checked={editing.trackingEnabled} onChange={e => update('trackingEnabled', e.target.checked)} style={{ cursor: 'pointer' }} />
              📊 Track Opens & Clicks
            </label>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px', marginLeft: '24px' }}>Injects tracking pixels and wraps links. Triggers the follow-up automation when opened.</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: editing.includeSignature ? GOLD : '#6b7280', fontSize: '12px', fontWeight: 'bold' }}>
              <input type="checkbox" checked={editing.includeSignature} onChange={e => update('includeSignature', e.target.checked)} style={{ cursor: 'pointer' }} />
              ✍️ Include Email Signature
            </label>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px', marginLeft: '24px' }}>Appends the standard email signature with imagery.</div>
          </div>
        </div>

        {/* Variable reference */}
        <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: PURPLE, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Available Variables</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.8 }}>
            {'{{firstName}}'} · {'{{email}}'}
          </div>
        </div>

        {editing.id && (
          <button onClick={() => del(editing)} style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🗑 Delete Template</button>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>📧 Email Templates & Automation</div>
        <button onClick={startNew} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ New Email Template</button>
      </div>

      <EmailOptInPanel username={username} />

      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px', marginBottom: '20px', color: '#8a9ab8', fontSize: '12px', lineHeight: 1.6 }}>
        Central hub for all fronter email templates and automation rules. Each template can be:
        <br />• <span style={{ color: GOLD }}>Manual</span> — sent on demand from the credentials popup or a contact card button
        <br />• <span style={{ color: BLUE }}>Follow-Up (Auto)</span> — auto-sent when a lead opens their credentials email + clicks 2/3 tracked links
        <br />• <span style={{ color: PURPLE }}>Tracked</span> — opens and link clicks are recorded; triggers the follow-up automation
        <br />• <span style={{ color: RED }}>⚠ Note:</span> The follow-up automation workflow must also be active in the Workflows dashboard for auto-sends to fire.
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Loading templates…</div>
      ) : templates.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No templates yet. Click "New Email Template" to create one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {templates.map(tpl => {
            const typeCfg = TYPE_LABELS[tpl.templateType] || TYPE_LABELS.manual;
            return (
              <div key={tpl.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${typeCfg.color}22`, borderLeft: `3px solid ${typeCfg.color}`, borderRadius: '4px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{tpl.label}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '3px', background: `${typeCfg.color}15`, color: typeCfg.color, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{typeCfg.label}</span>
                    {tpl.enabled ? <span style={{ color: GOLD, fontSize: '9px' }}>● Active</span> : <span style={{ color: '#6b7280', fontSize: '9px' }}>⏸ Disabled</span>}
                    {tpl.attachToContactCard && <span style={{ padding: '1px 6px', borderRadius: '3px', background: `${GOLD}15`, color: GOLD, fontSize: '8px', fontWeight: 'bold' }}>🔘 Card Button</span>}
                    {tpl.trackingEnabled && <span style={{ padding: '1px 6px', borderRadius: '3px', background: `${PURPLE}15`, color: PURPLE, fontSize: '8px', fontWeight: 'bold' }}>📊 Tracked</span>}
                    {tpl.isDefault && <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: '#6b7280', fontSize: '8px', fontWeight: 'bold' }}>Built-in</span>}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.subject || '(no subject)'}</div>
                </div>
                <button onClick={() => setEditing(tpl)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>✏ Edit</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}