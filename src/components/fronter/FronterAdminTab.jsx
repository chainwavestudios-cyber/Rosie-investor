/**
 * FronterAdminTab.jsx — Super admin controls for the fronter system.
 * - Assign Twilio lines to fronters
 * - Upload and assign leads (auto-assigned prospect status)
 * - Track metrics per fronter
 * - Listen / barge active fronter calls
 * - Manage fronter scripts
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import FronterCallMetricsTab from '@/components/fronter/FronterCallMetricsTab';
import FronterReportsTab from '@/components/fronter/FronterReportsTab';
import FronterAdminCallsTab from '@/components/fronter/FronterAdminCallsTab';
import FronterHoldAudioTab from '@/components/fronter/FronterHoldAudioTab';
import FronterUsersTab from '@/components/fronter/FronterUsersTab';
import FronterLeadImportModal from '@/components/fronter/FronterLeadImportModal';
import FronterScriptEditor from '@/components/fronter/FronterScriptEditor';
import FronterQuoteTab from '@/components/fronter/FronterQuoteTab';
import { renderFormatted } from '@/components/debt/ScriptRichText';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterAdminTab({ adminUsername }) {
  const [subtab, setSubtab] = useState('lines');
  const [fronters, setFronters] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [lineAssignments, setLineAssignments] = useState([]);
  const [lines, setLines] = useState([]);
  const [leads, setLeads] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignForm, setAssignForm] = useState({ username: '', lineKey: '' });
  const [leadForm, setLeadForm] = useState({ firstName: '', lastName: '', phone: '', assignedTo: '', notes: '' });
  const [bulkText, setBulkText] = useState('');
  const [scriptForm, setScriptForm] = useState({ name: '', content: '' });
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [activeConferences, setActiveConferences] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const fileRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [users, assignments, ls, allLeads, scrs] = await Promise.all([
        base44.entities.DebtCoachUser.list('-created_date', 500),
        base44.entities.FronterLineAssignment.list('-assignedAt', 100),
        base44.functions.invoke('twilioGetLines', {}),
        base44.entities.FronterLead.list('-created_date', 500),
        base44.entities.FronterScript.list('sortOrder', 50),
      ]);
      const allU = users || [];
      setAllUsers(allU);
      setFronters(allU.filter(u => u.role === 'fronter' && u.isActive));
      setLineAssignments(assignments || []);
      setLines(ls?.data?.lines || ls?.lines || []);
      setLeads(allLeads || []);
      setScripts(scrs || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Poll active fronter sessions for live call monitoring
  useEffect(() => {
    const poll = async () => {
      try {
        const sessions = await base44.entities.DialerSession.filter({ status: 'on_call' });
        const fronterSessions = (sessions || []).filter(s => fronters.some(f => f.username === s.username));
        // For each active session, check if there's a conference
        const confs = {};
        for (const s of fronterSessions) {
          if (s.currentCallConferenceName) {
            const res = await base44.functions.invoke('fronterCall', { action: 'getConference', conferenceName: s.currentCallConferenceName });
            const data = res?.data || res;
            confs[s.username] = { conferenceName: s.currentCallConferenceName, participants: data?.participants || [] };
          }
        }
        setActiveConferences(confs);
      } catch {}
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [fronters]);

  // ── Line assignment ──
  const assignLine = async () => {
    if (!assignForm.username || !assignForm.lineKey) return;
    const line = lines.find(l => l.key === assignForm.lineKey);
    try {
      // Remove existing assignment for this user
      const existing = lineAssignments.find(a => a.username === assignForm.username);
      if (existing) await base44.entities.FronterLineAssignment.delete(existing.id);
      await base44.entities.FronterLineAssignment.create({
        username: assignForm.username,
        twilioLineKey: assignForm.lineKey,
        twilioNumber: line?.number || '',
        assignedBy: adminUsername,
        assignedAt: new Date().toISOString(),
      });
      setAssignForm({ username: '', lineKey: '' });
      loadAll();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const removeLine = async (id) => {
    await base44.entities.FronterLineAssignment.delete(id);
    loadAll();
  };

  // ── Lead upload ──
  const addLead = async () => {
    if (!leadForm.firstName.trim() || !leadForm.lastName.trim() || !leadForm.phone.trim() || !leadForm.assignedTo) return;
    try {
      const count = await base44.entities.FronterLead.list('-created_date', 1);
      const num = count?.[0]?.leadNumber ? parseInt(count[0].leadNumber.replace(/\D/g, '')) + 1 : 1;
      await base44.entities.FronterLead.create({
        leadNumber: `#F${String(num).padStart(4, '0')}`,
        firstName: leadForm.firstName.trim(),
        lastName: leadForm.lastName.trim(),
        phone: leadForm.phone.trim(),
        status: 'prospect',
        assignedTo: leadForm.assignedTo,
        assignedAt: new Date().toISOString(),
        assignedBy: adminUsername,
        uploadedBy: adminUsername,
        notes: leadForm.notes,
      });
      setLeadForm({ firstName: '', lastName: '', phone: '', assignedTo: leadForm.assignedTo, notes: '' });
      loadAll();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const bulkUpload = async () => {
    if (!bulkText.trim() || !leadForm.assignedTo) { alert('Enter lead data and select a fronter'); return; }
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    let success = 0;
    const existing = await base44.entities.FronterLead.list('-created_date', 1);
    let num = existing?.[0]?.leadNumber ? parseInt(existing[0].leadNumber.replace(/\D/g, '')) + 1 : 1;
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        try {
          await base44.entities.FronterLead.create({
            leadNumber: `#F${String(num++).padStart(4, '0')}`,
            firstName: parts[0], lastName: parts[1], phone: parts[2],
            status: 'prospect', assignedTo: leadForm.assignedTo,
            assignedAt: new Date().toISOString(), assignedBy: adminUsername, uploadedBy: adminUsername,
            notes: parts[3] || '',
          });
          success++;
        } catch {}
      }
    }
    setBulkText('');
    alert(`${success} leads uploaded and assigned to ${leadForm.assignedTo}`);
    loadAll();
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const text = await file.text();
    setBulkText(text);
  };

  // ── Scripts ──
  const addScript = async (data) => {
    if (!data?.name?.trim() || !data?.content?.trim()) return;
    try {
      await base44.entities.FronterScript.create({ name: data.name, content: data.content, sortOrder: scripts.length });
      loadAll();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const saveEditScript = async (data) => {
    if (!data?.name?.trim()) return;
    try {
      await base44.entities.FronterScript.update(editingScriptId, { name: data.name, content: data.content });
      setEditingScriptId(null);
      loadAll();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const deleteScript = async (id) => {
    if (!confirm('Delete this script?')) return;
    await base44.entities.FronterScript.delete(id);
    loadAll();
  };

  // ── Listen / Barge ──
  const listenOrBarge = async (fronterUsername, mode) => {
    const conf = activeConferences[fronterUsername];
    if (!conf?.conferenceName) { alert('No active conference for this fronter'); return; }
    const assignment = lineAssignments.find(a => a.username === fronterUsername);
    try {
      await base44.functions.invoke('fronterCall', {
        action: mode,
        conferenceName: conf.conferenceName,
        adminUsername,
        lineKey: assignment?.twilioLineKey || 'TWILIO_FROM_NUMBER',
      });
      alert(mode === 'listen' ? 'Listening to call (muted)' : 'Barged in (can speak)');
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const endListen = async (fronterUsername) => {
    const conf = activeConferences[fronterUsername];
    if (!conf?.conferenceName) return;
    try {
      await base44.functions.invoke('fronterCall', { action: 'endListen', conferenceName: conf.conferenceName, adminUsername });
    } catch {}
  };

  // ── Metrics ──
  const getMetrics = (fronterUsername) => {
    const fronterLeads = leads.filter(l => l.assignedTo === fronterUsername);
    return {
      total: fronterLeads.length,
      prospects: fronterLeads.filter(l => l.status === 'prospect').length,
      leads: fronterLeads.filter(l => l.status === 'lead').length,
      transferred: fronterLeads.filter(l => l.status === 'transferred').length,
      removed: fronterLeads.filter(l => l.status === 'removed').length,
      calls: fronterLeads.reduce((s, l) => s + (l.callCount || 0), 0),
    };
  };

  const SUBTABS = [
    { id: 'lines', label: '📞 Lines' },
    { id: 'leads', label: '📋 Leads' },
    { id: 'calls', label: '📞 Calls' },
    { id: 'callmetrics', label: '📈 Call Metrics' },
    { id: 'reports', label: '📊 Reports' },
    { id: 'metrics', label: '📊 Metrics' },
    { id: 'monitor', label: '🎧 Monitor' },
    { id: 'holdaudio', label: '🔊 Hold Audio' },
    { id: 'users', label: '👥 Users' },
    { id: 'scripts', label: '📜 Scripts' },
    { id: 'quotes', label: '💬 Quotes' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubtab(t.id)} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${subtab === t.id ? GOLD : 'transparent'}`, color: subtab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: subtab === t.id ? 'bold' : 'normal' }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>}

      {/* ── LINE ASSIGNMENT ── */}
      {subtab === 'lines' && !loading && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📞 Assign Twilio Lines to Fronters</div>
          {fronters.length === 0 ? (
            <div style={{ color: '#4a5568', padding: '20px', textAlign: 'center', fontSize: '13px' }}>No fronter users yet. Create fronter users from the Manager Portal → Employees tab.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '16px', alignItems: 'end' }}>
                <div>
                  <label style={ls}>Fronter</label>
                  <select value={assignForm.username} onChange={e => setAssignForm(p => ({ ...p, username: e.target.value }))} style={inp}>
                    <option value="">— Select fronter —</option>
                    {fronters.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
                  </select>
                </div>
                <div>
                  <label style={ls}>Twilio Line</label>
                  <select value={assignForm.lineKey} onChange={e => setAssignForm(p => ({ ...p, lineKey: e.target.value }))} style={inp}>
                    <option value="">— Select line —</option>
                    {lines.map(l => <option key={l.key} value={l.key}>{l.label} ({l.number})</option>)}
                  </select>
                </div>
                <button onClick={assignLine} disabled={!assignForm.username || !assignForm.lineKey} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: !assignForm.username || !assignForm.lineKey ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: !assignForm.username || !assignForm.lineKey ? 0.5 : 1 }}>Assign</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lineAssignments.map(a => (
                  <div key={a.id} style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{a.username}</span>
                      <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '12px' }}>{a.twilioNumber}</span>
                      <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '8px' }}>({a.twilioLineKey})</span>
                    </div>
                    <button onClick={() => removeLine(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                  </div>
                ))}
                {lineAssignments.length === 0 && <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No lines assigned yet.</div>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LEAD UPLOAD ── */}
      {subtab === 'leads' && !loading && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📋 Upload & Assign Leads</div>

          {/* Assign target */}
          <div style={{ marginBottom: '14px' }}>
            <label style={ls}>Assign All Leads To</label>
            <select value={leadForm.assignedTo} onChange={e => setLeadForm(p => ({ ...p, assignedTo: e.target.value }))} style={{ ...inp, maxWidth: '300px' }}>
              <option value="">— Select fronter —</option>
              {fronters.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
            </select>
          </div>

          {/* Single lead */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>+ Add Single Lead</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div><label style={ls}>First Name</label><input value={leadForm.firstName} onChange={e => setLeadForm(p => ({ ...p, firstName: e.target.value }))} style={inp} /></div>
              <div><label style={ls}>Last Name</label><input value={leadForm.lastName} onChange={e => setLeadForm(p => ({ ...p, lastName: e.target.value }))} style={inp} /></div>
              <div><label style={ls}>Phone</label><input value={leadForm.phone} onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))} placeholder="555-123-4567" style={inp} /></div>
            </div>
            <div style={{ marginBottom: '10px' }}><label style={ls}>Notes (optional)</label><input value={leadForm.notes} onChange={e => setLeadForm(p => ({ ...p, notes: e.target.value }))} style={inp} /></div>
            <button onClick={addLead} disabled={!leadForm.firstName || !leadForm.lastName || !leadForm.phone || !leadForm.assignedTo} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (!leadForm.firstName || !leadForm.assignedTo) ? 0.5 : 1 }}>Add Lead</button>
          </div>

          {/* Bulk import with field mapping */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>+ Bulk Import (CSV with Field Mapping)</div>
            <button onClick={() => setShowImportModal(true)} disabled={!leadForm.assignedTo} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: leadForm.assignedTo ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', opacity: leadForm.assignedTo ? 1 : 0.5 }}>📁 Import CSV (Map Fields)</button>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>Upload a CSV and match each column to the right contact card field. All imported leads start as Prospect.</div>
          </div>

          {/* Existing leads */}
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>All Leads — {leads.length}</div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {leads.slice(0, 100).map(l => (
              <div key={l.id} style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{l.firstName} {l.lastName}</span>
                  <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>{l.phone}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#4a5568', fontSize: '10px' }}>{l.assignedTo}</span>
                  <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', background: l.status === 'lead' ? 'rgba(16,185,129,0.15)' : l.status === 'transferred' ? 'rgba(167,139,250,0.15)' : l.status === 'removed' ? 'rgba(239,68,68,0.15)' : 'rgba(96,165,250,0.15)', color: l.status === 'lead' ? GOLD : l.status === 'transferred' ? '#a78bfa' : l.status === 'removed' ? '#ef4444' : '#60a5fa' }}>{l.status}</span>
                  <span style={{ color: '#4a5568', fontSize: '10px' }}>{l.callCount || 0}/3</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CALLS (last 24h with recordings + comments) ── */}
      {subtab === 'calls' && !loading && (
        <FronterAdminCallsTab adminUsername={adminUsername} fronters={fronters} />
      )}

      {/* ── CALL METRICS ── */}
      {subtab === 'callmetrics' && !loading && (
        <FronterCallMetricsTab fronters={fronters} />
      )}

      {/* ── DAILY REPORTS ── */}
      {subtab === 'reports' && !loading && (
        <FronterReportsTab fronters={fronters} />
      )}

      {/* ── METRICS ── */}
      {subtab === 'metrics' && !loading && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📊 Fronter Metrics</div>
          {fronters.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No fronters yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {fronters.map(f => {
                const m = getMetrics(f.username);
                return (
                  <div key={f.id} style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}>{f.username}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Metric label="Total Leads" value={m.total} color="#60a5fa" />
                      <Metric label="Total Calls" value={m.calls} color="#f59e0b" />
                      <Metric label="Prospects" value={m.prospects} color="#60a5fa" />
                      <Metric label="Leads" value={m.leads} color={GOLD} />
                      <Metric label="Transferred" value={m.transferred} color="#a78bfa" />
                      <Metric label="Removed" value={m.removed} color="#ef4444" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MONITOR ── */}
      {subtab === 'monitor' && !loading && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🎧 Live Call Monitoring</div>
          <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '14px', color: '#8a9ab8', fontSize: '11px' }}>
            Listen to active fronter calls (muted) or barge in (unmuted). Only works when a fronter has merged a call into a conference.
          </div>
          {fronters.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No fronters yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {fronters.map(f => {
                const conf = activeConferences[f.username];
                const isActive = !!conf?.conferenceName;
                return (
                  <div key={f.id} style={{ background: '#0d1b2a', border: `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#4ade80' : '#4a5568', animation: isActive ? 'pulse 1s infinite' : 'none' }} />
                        <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{f.username}</span>
                        {isActive && <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>· On Call ({conf.participants.length} in conf)</span>}
                      </div>
                    </div>
                    {isActive ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => listenOrBarge(f.username, 'listen')} style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🎧 Listen</button>
                        <button onClick={() => listenOrBarge(f.username, 'barge')} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📢 Barge</button>
                        <button onClick={() => endListen(f.username)} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>End</button>
                      </div>
                    ) : (
                      <span style={{ color: '#4a5568', fontSize: '11px' }}>Not on a call</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HOLD AUDIO ── */}
      {subtab === 'holdaudio' && !loading && (
        <FronterHoldAudioTab adminUsername={adminUsername} />
      )}

      {/* ── USERS ── */}
      {subtab === 'users' && !loading && (
        <FronterUsersTab adminUsername={adminUsername} />
      )}

      {/* ── QUOTES ── */}
      {subtab === 'quotes' && !loading && (
        <FronterQuoteTab adminUsername={adminUsername} />
      )}

      {/* CSV import modal */}
      {showImportModal && (
        <FronterLeadImportModal
          assignedTo={leadForm.assignedTo}
          assignedBy={adminUsername}
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); loadAll(); }}
        />
      )}

      {/* ── SCRIPTS ── */}
      {subtab === 'scripts' && !loading && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📜 Fronter Scripts</div>
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
            <FronterScriptEditor submitLabel="Add Script" onSubmit={addScript} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scripts.map(s => (
              <div key={s.id} style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '14px' }}>
                {editingScriptId === s.id ? (
                  <FronterScriptEditor initialName={s.name} initialContent={s.content} submitLabel="Save Changes" onSubmit={saveEditScript} onCancel={() => setEditingScriptId(null)} />
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{s.name}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingScriptId(s.id)} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '11px' }}>✎ Edit</button>
                        <button onClick={() => deleteScript(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                      </div>
                    </div>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.6, fontFamily: 'Georgia, serif', maxHeight: '200px', overflowY: 'auto' }}>{renderFormatted(s.content)}</div>
                  </>
                )}
              </div>
            ))}
            {scripts.length === 0 && <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No scripts yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>{label}</div>
    </div>
  );
}