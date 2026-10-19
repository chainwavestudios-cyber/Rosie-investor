/**
 * DebtEmailsTab — Email template management for the Debt Call Coach.
 * Lists all DebtEmailTemplate records, allows editing each one with a full
 * rich text editor (react-quill), and configures automation rules + contact
 * card button settings + tracking options.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { registerImageResizeBlot } from '@/utils/quillImageResize';
import { useQuillImageModules } from '@/utils/quillImageUpload';
import { insertWelcomeTracker } from '@/utils/quillWelcomeTracker';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const TYPE_LABELS = {
  night_before: { label: '🌙 Night-Before', color: BLUE },
  hour_before: { label: '⏰ 1-Hour Before', color: AMBER },
  manual: { label: '✋ Manual', color: GOLD },
  custom_automation: { label: '⚙️ Custom Automation', color: PURPLE },
};

const quillFormats = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'align', 'list', 'link', 'image', 'width'];

export default function DebtEmailsTab({ username }) {
  const quillRef = useRef(null);
  const quillModules = useQuillImageModules(quillRef);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const [selectedImg, setSelectedImg] = useState(null);
  const [imgRect, setImgRect] = useState(null);
  const editorWrapRef = useRef(null);
  const dragStateRef = useRef(null);

  // Register the custom Quill image blot once on mount so width styles persist
  useEffect(() => { registerImageResizeBlot(); }, []);

  const refreshImgRect = useCallback(() => {
    if (!selectedImg || !editorWrapRef.current) return;
    const wrapRect = editorWrapRef.current.getBoundingClientRect();
    const r = selectedImg.getBoundingClientRect();
    setImgRect({ left: r.left - wrapRect.left, top: r.top - wrapRect.top, width: r.width, height: r.height });
  }, [selectedImg]);

  // Close the image resize panel when clicking outside the editor
  useEffect(() => {
    if (!selectedImg) return;
    const close = (e) => {
      if (editorWrapRef.current && editorWrapRef.current.contains(e.target)) return;
      setSelectedImg(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [selectedImg]);

  // Track image position while selected
  useEffect(() => {
    if (!selectedImg) { setImgRect(null); return; }
    refreshImgRect();
    const ro = new ResizeObserver(refreshImgRect);
    ro.observe(selectedImg);
    const onScroll = () => refreshImgRect();
    editorWrapRef.current?.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onScroll);
    return () => { ro.disconnect(); editorWrapRef.current?.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [selectedImg, refreshImgRect]);

  const handleEditorClick = (e) => {
    if (e.target.tagName === 'IMG') {
      e.stopPropagation();
      setSelectedImg(e.target);
    }
  };

  const applyImgWidth = (width) => {
    if (!selectedImg) return;
    selectedImg.style.width = width;
    selectedImg.style.height = 'auto';
    refreshImgRect();
  };

  const startCornerDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImg) return;
    const startX = e.clientX;
    const startW = selectedImg.getBoundingClientRect().width;
    const naturalW = selectedImg.naturalWidth || startW;
    dragStateRef.current = { startX, startW, naturalW };
    const onMove = (ev) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const delta = ev.clientX - ds.startX;
      let newW = ds.startW + delta;
      if (newW < 20) newW = 20;
      if (newW > ds.naturalW) newW = ds.naturalW;
      selectedImg.style.width = `${newW}px`;
      selectedImg.style.height = 'auto';
      refreshImgRect();
    };
    const onUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.DebtEmailTemplate.list('sortOrder', 100);
      setTemplates(page?.items || page || []);
    } catch { setTemplates([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const startNew = () => {
    setEditing({
      name: '', templateType: 'manual', subject: '', bodyHtml: '',
      triggerOffsetHours: -18, triggerTimeOfDay: '', enabled: true,
      attachToContactCard: false, buttonLabel: '', buttonColor: '#10b981',
      trackingEnabled: true, includeSignature: true, sortOrder: templates.length + 1,
      personalMessageUrl: '',
    });
  };

  const save = async () => {
    if (!editing?.name?.trim()) { alert('Template name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...editing, updatedBy: username };
      if (editing.id) {
        await base44.entities.DebtEmailTemplate.update(editing.id, payload);
      } else {
        await base44.entities.DebtEmailTemplate.create(payload);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(null);
      loadTemplates();
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const del = async (tpl) => {
    if (!confirm(`Delete "${tpl.name}"?`)) return;
    try {
      await base44.entities.DebtEmailTemplate.delete(tpl.id);
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
          <div><label style={ls}>Template Name</label><input value={editing.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Welcome Email, Follow-up Reminder" style={inp} /></div>
          <div>
            <label style={ls}>Template Type</label>
            <select value={editing.templateType} onChange={e => update('templateType', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="manual">✋ Manual (send on demand)</option>
              <option value="night_before">🌙 Night-Before (automated)</option>
              <option value="hour_before">⏰ 1-Hour Before (automated)</option>
              <option value="custom_automation">⚙️ Custom Automation</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>Email Subject <span style={{ color: '#4a5568', textTransform: 'none', letterSpacing: '0' }}>(supports {'{{firstName}}'}, {'{{appointmentDate}}'}, etc.)</span></label>
          <input value={editing.subject} onChange={e => update('subject', e.target.value)} placeholder="Reminder: Your call tomorrow at {{appointmentDate}}" style={inp} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ ...ls, marginBottom: 0 }}>Email Body — Full Editor</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {!showHtmlSource && (
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => insertWelcomeTracker(quillRef, selectedImg, setSelectedImg)}
                  title="Wrap the selected image or text in a trackable {{personalMessageUrl}} link"
                  style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                >
                  🎙️ Insert Welcome Tracker
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHtmlSource(s => !s)}
                style={{ background: showHtmlSource ? `${PURPLE}22` : 'rgba(255,255,255,0.05)', color: showHtmlSource ? PURPLE : '#8a9ab8', border: `1px solid ${showHtmlSource ? PURPLE + '44' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
              >
                {showHtmlSource ? '👁 Rich Text' : '</> HTML Source'}
              </button>
            </div>
          </div>
          {showHtmlSource ? (
            <textarea
              value={editing.bodyHtml || ''}
              onChange={e => update('bodyHtml', e.target.value)}
              style={{ width: '100%', minHeight: '300px', background: '#0a0f1e', color: '#e8e0d0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              placeholder="<html>...</html>"
            />
          ) : (
            <div ref={editorWrapRef} style={{ position: 'relative', background: '#fff', borderRadius: '4px', overflow: 'hidden' }} onClick={handleEditorClick}>
              <ReactQuill
                ref={quillRef}
                value={editing.bodyHtml || ''}
                onChange={(val) => update('bodyHtml', val)}
                modules={quillModules}
                formats={quillFormats}
                theme="snow"
                style={{ height: '300px', marginBottom: '42px' }}
              />
              {selectedImg && imgRect && [
                <div key="outline" style={{ position: 'absolute', left: imgRect.left, top: imgRect.top, width: imgRect.width, height: imgRect.height, border: '2px solid #10b981', pointerEvents: 'none', zIndex: 50, boxSizing: 'border-box' }} />,
                ...[['nw', 0, 0, 'nwse-resize'], ['ne', 1, 0, 'nesw-resize'], ['sw', 0, 1, 'nwse-resize'], ['se', 1, 1, 'nesw-resize']].map(([id, hx, hy, cursor]) => (
                  <div key={id} onMouseDown={startCornerDrag} onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: imgRect.left + hx * imgRect.width - 6, top: imgRect.top + hy * imgRect.height - 6, width: 12, height: 12, background: '#10b981', border: '2px solid #fff', borderRadius: '2px', cursor, zIndex: 60, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
                )),
              ]}
              {selectedImg && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ position: 'absolute', top: 8, right: 8, zIndex: 100, background: '#0a0f1e', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '6px', padding: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '6px' }}
                >
                  <div style={{ color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Image Size</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[['15%', 'XS'], ['25%', 'S'], ['50%', 'M'], ['75%', 'L'], ['100%', 'XL']].map(([w, label]) => (
                      <button key={w} type="button" onClick={() => applyImgWidth(w)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="text" placeholder="e.g. 300px" onKeyDown={e => { if (e.key === 'Enter') { applyImgWidth(e.target.value); } }} style={{ width: '80px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '4px 6px', color: '#e8e0d0', fontSize: '10px', outline: 'none' }} />
                    <button type="button" onClick={e => { const inp = e.target.previousSibling; applyImgWidth(inp.value); }} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Set</button>
                  </div>
                  <button type="button" onClick={() => { selectedImg.style.width = ''; selectedImg.style.height = ''; setSelectedImg(null); }} style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '3px 6px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}>↺ Reset</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Automation Rules */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>⚙️ Automation Rules</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={ls}>Trigger Offset (hours)</label>
              <input type="number" value={editing.triggerOffsetHours} onChange={e => update('triggerOffsetHours', Number(e.target.value))} style={inp} title="Negative = hours before appointment" />
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
        </div>

        {/* Contact Card Button Settings */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>🔘 Contact Card Button</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: editing.attachToContactCard ? GOLD : '#6b7280', fontSize: '12px', fontWeight: 'bold', marginBottom: editing.attachToContactCard ? '12px' : '0' }}>
            <input type="checkbox" checked={editing.attachToContactCard} onChange={e => update('attachToContactCard', e.target.checked)} style={{ cursor: 'pointer' }} />
            Show as button on client contact card
          </label>
          {editing.attachToContactCard && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div><label style={ls}>Button Label</label><input value={editing.buttonLabel || ''} onChange={e => update('buttonLabel', e.target.value)} placeholder="e.g. Send Welcome Email" style={inp} /></div>
              <div><label style={ls}>Button Color</label><input type="color" value={editing.buttonColor || '#10b981'} onChange={e => update('buttonColor', e.target.value)} style={{ ...inp, height: '38px', cursor: 'pointer', padding: '2px' }} /></div>
            </div>
          )}
        </div>

        {/* Personal Message Audio URL */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>🎙️ Personal Message Audio Link</div>
          <label style={ls}>Personal Message URL <span style={{ color: '#4a5568', textTransform: 'none', letterSpacing: '0' }}>(supports {'{{leadId}}'}, {'{{firstName}}'} — use {'{{personalMessageUrl}}'} in the email body)</span></label>
          <input value={editing.personalMessageUrl || ''} onChange={e => update('personalMessageUrl', e.target.value)} placeholder="https://your-audio-site.com/message/{{leadId}}" style={inp} />
          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>When a prospect clicks this link in the email, the 🎙️ Personal Message badge on the contact card pulses neon green.</div>
        </div>

        {/* Tracking & Signature */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: editing.trackingEnabled ? PURPLE : '#6b7280', fontSize: '12px', fontWeight: 'bold' }}>
              <input type="checkbox" checked={editing.trackingEnabled} onChange={e => update('trackingEnabled', e.target.checked)} style={{ cursor: 'pointer' }} />
              📊 Track Opens & Clicks
            </label>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px', marginLeft: '24px' }}>Injects tracking pixels and wraps links. The contact card button lights up when opened.</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: editing.includeSignature ? GOLD : '#6b7280', fontSize: '12px', fontWeight: 'bold' }}>
              <input type="checkbox" checked={editing.includeSignature} onChange={e => update('includeSignature', e.target.checked)} style={{ cursor: 'pointer' }} />
              ✍️ Include Email Signature
            </label>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px', marginLeft: '24px' }}>Appends Chris Bongiorno's signature with imagery.</div>
          </div>
        </div>

        {/* Variable reference */}
        <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: PURPLE, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Available Variables</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.8 }}>
            {'{{firstName}}'} · {'{{lastName}}'} · {'{{phone}}'} · {'{{email}}'} · {'{{appointmentDate}}'} · {'{{debtAmount}}'} · {'{{confirmUrl}}'} · {'{{changeUrl}}'} · {'{{personalMessageUrl}}'}
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

      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px', marginBottom: '20px', color: '#8a9ab8', fontSize: '12px', lineHeight: 1.6 }}>
        Create and manage email templates for appointment reminders, follow-ups, and manual sends. Each template can be:
        <br />• <span style={{ color: GOLD }}>Automated</span> — sent on a schedule relative to the appointment (night-before, 1-hour-before, custom offset)
        <br />• <span style={{ color: BLUE }}>Manual</span> — sent on demand from a button on the client contact card
        <br />• <span style={{ color: PURPLE }}>Tracked</span> — opens and link clicks are recorded; the contact card button lights up when opened
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{tpl.name}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '3px', background: `${typeCfg.color}15`, color: typeCfg.color, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{typeCfg.label}</span>
                    {tpl.enabled ? <span style={{ color: GOLD, fontSize: '9px' }}>● Active</span> : <span style={{ color: '#6b7280', fontSize: '9px' }}>⏸ Disabled</span>}
                    {tpl.attachToContactCard && <span style={{ padding: '1px 6px', borderRadius: '3px', background: `${GOLD}15`, color: GOLD, fontSize: '8px', fontWeight: 'bold' }}>🔘 Card Button</span>}
                    {tpl.trackingEnabled && <span style={{ padding: '1px 6px', borderRadius: '3px', background: `${PURPLE}15`, color: PURPLE, fontSize: '8px', fontWeight: 'bold' }}>📊 Tracked</span>}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.subject || '(no subject)'}</div>
                  {tpl.templateType === 'custom_automation' && tpl.triggerOffsetHours != null && (
                    <div style={{ color: BLUE, fontSize: '10px', marginTop: '3px' }}>⏱ {tpl.triggerOffsetHours}h offset{tpl.triggerTimeOfDay ? ` @ ${tpl.triggerTimeOfDay}` : ''}</div>
                  )}
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