/**
 * FronterContactCard.jsx — Professional floating contact card for fronters.
 * Two-column layout: Contact fields (left) | Notes + Debt info (right).
 * Tabs: Contact | Script (with popout).
 * Next button cycles to the next lead. Phone click-to-dial.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { substituteScriptVars } from '@/lib/scriptSubstitute';
import { renderFormatted } from '@/components/debt/ScriptRichText';
import FronterCardAudioControls from './FronterCardAudioControls';
import FronterMeetingScheduler from './FronterMeetingScheduler';
import FronterCredsEmailPopup from './FronterCredsEmailPopup';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', transition: 'border-color 0.2s' };

const DEBT_TYPES = ['Unsecured Credit Card', 'Unsecured Loans'];

function fmtET(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function FronterContactCard({ lead, username, fronterFirstName, onClose, onSave, onDial, onNext, isAdmin }) {
  const [local, setLocal] = useState(lead || {});
  const [notesLog, setNotesLog] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cardTab, setCardTab] = useState('contact');
  const [pos, setPos] = useState({ x: 60, y: 50 });
  const [size, setSize] = useState({ w: 560, h: 600 });
  const dragRef = useRef(null);
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [scriptPoppedOut, setScriptPoppedOut] = useState(false);
  const [scriptPos, setScriptPos] = useState({ x: 660, y: 80 });
  const [scriptSize, setScriptSize] = useState({ w: 400, h: 500 });
  const scriptDragRef = useRef(null);
  const [headsUpSent, setHeadsUpSent] = useState(false);
  const [headsUpSending, setHeadsUpSending] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [showCredsPopup, setShowCredsPopup] = useState(false);
  const [meetingDisposition, setMeetingDisposition] = useState('interested');

  useEffect(() => {
    setLocal(lead || {});
    try { setNotesLog(JSON.parse(lead?.notesLogJson || '[]')); } catch { setNotesLog([]); }
  }, [lead]);

  useEffect(() => {
    base44.entities.FronterScript.list('sortOrder', 50).then(all => {
      setScripts(all || []);
      if (all?.length > 0) setActiveScript(prev => prev || all[0]);
    }).catch(() => {});
  }, []);

  // Call timer — ticks every second while a call is active
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive, callStartTime]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const onScriptDragStart = (e) => {
    scriptDragRef.current = { startX: e.clientX - scriptPos.x, startY: e.clientY - scriptPos.y };
    const onMove = (ev) => { if (scriptDragRef.current) setScriptPos({ x: ev.clientX - scriptDragRef.current.startX, y: ev.clientY - scriptDragRef.current.startY }); };
    const onUp = () => { scriptDragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const update = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  const debtTypes = (() => { try { return JSON.parse(local.debtTypesJson || '[]'); } catch { return []; } })();
  const toggleDebtType = (type) => {
    const next = debtTypes.includes(type) ? debtTypes.filter(t => t !== type) : [...debtTypes, type];
    update('debtTypesJson', JSON.stringify(next));
  };

  const sendHeadsUp = async () => {
    if (!lead?.id || headsUpSending) return;
    setHeadsUpSending(true);
    try {
      // Look up the fronter's active DialerSession for conference name
      let conferenceName = '';
      let lineKey = '';
      try {
        const sessions = await base44.entities.DialerSession.filter({ username });
        if (sessions?.[0]) {
          conferenceName = sessions[0].currentCallConferenceName || '';
        }
        const assignments = await base44.entities.FronterLineAssignment.filter({ username });
        if (assignments?.[0]) lineKey = assignments[0].twilioLineKey || '';
      } catch {}
      await base44.entities.FronterHeadsUp.create({
        fronterUsername: username,
        leadId: lead.id,
        leadName: (lead.firstName || '') + ' ' + (lead.lastName || ''),
        leadPhone: lead.phone || '',
        conferenceName,
        lineKey,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      setHeadsUpSent(true);
      setTimeout(() => setHeadsUpSent(false), 3000);
    } catch (e) { alert('Heads Up failed: ' + (e?.message || String(e))); }
    setHeadsUpSending(false);
  };

  const addNote = async () => {
    if (!newNote.trim() || !lead?.id) return;
    const entry = { text: newNote.trim(), timestamp: new Date().toISOString(), author: username, type: 'note' };
    const nextLog = [...notesLog, entry];
    setNotesLog(nextLog);
    setNewNote('');
    try { await base44.entities.FronterLead.update(lead.id, { notesLogJson: JSON.stringify(nextLog) }); } catch {}
  };

  const save = async () => {
    if (!lead?.id) return;
    setSaving(true);
    try {
      await base44.entities.FronterLead.update(lead.id, {
        firstName: local.firstName, lastName: local.lastName, phone: local.phone, phone2: local.phone2,
        email: local.email, address: local.address, state: local.state, zipCode: local.zipCode,
        preferredCallTime: local.preferredCallTime, employmentStatus: local.employmentStatus,
        annualIncome: local.annualIncome, referralSource: local.referralSource,
        debtAmount: local.debtAmount, debtTypesJson: local.debtTypesJson,
        notesLogJson: JSON.stringify(notesLog),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onSave?.(local);
    } catch (e) { alert('Save failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const markClosedDeal = async () => {
    if (!lead?.id || !isAdmin) return;
    if (!confirm(`Mark ${local.firstName} ${local.lastName} as a Closed Deal? This will trigger a congratulatory popup for the fronter.`)) return;
    try {
      await base44.entities.FronterLead.update(lead.id, {
        status: 'closed_deal',
        closedDealAt: new Date().toISOString(),
        closedDealBy: username,
      });
      onSave?.({ ...local, status: 'closed_deal', closedDealAt: new Date().toISOString(), closedDealBy: username });
      onClose?.();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const scriptContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {scripts.length > 1 && (
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0 }}>
          {scripts.map(s => (
            <button key={s.id} onClick={() => setActiveScript(s)} style={{ padding: '6px 10px', background: 'none', border: 'none', borderBottom: `2px solid ${activeScript?.id === s.id ? GOLD : 'transparent'}`, color: activeScript?.id === s.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: activeScript?.id === s.id ? 'bold' : 'normal' }}>{s.name}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {!activeScript ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No scripts yet. Ask your admin to add a script.</div>
        ) : (
          <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{renderFormatted(substituteScriptVars(activeScript.content, { lead: local, fronterFirstName }))}</div>
        )}
      </div>
    </div>
  );

  const initials = `${(local.firstName?.[0] || '?')}${(local.lastName?.[0] || '')}`;
  const leadTypeColor = local.status === 'lead' ? GOLD : local.status === 'transferred' ? '#a78bfa' : local.status === 'closed_deal' ? '#a78bfa' : '#60a5fa';
  const leadTypeLabel = local.status === 'lead' ? 'LEAD' : local.status === 'transferred' ? 'TRANSFERRED' : local.status === 'closed_deal' ? 'CLOSED DEAL' : 'PROSPECT';
  const animalEmoji = local.status === 'closed_deal' ? '💎' : local.status === 'transferred' ? '🦄' : local.status === 'lead' ? '🐄' : '🦆';

  return (
    <>
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `2px solid ${leadTypeColor}55`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
        {/* Lead type banner */}
        <div style={{ padding: '6px 18px', background: `${leadTypeColor}18`, borderBottom: `1px solid ${leadTypeColor}33`, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: leadTypeColor, fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase' }}>● {leadTypeLabel} ●</span>
        </div>
        {/* Header — draggable */}
        <div onMouseDown={onDragStart} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(16,185,129,0.06), transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, #22c55e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DARK, fontSize: '14px', fontWeight: 'bold', flexShrink: 0, textTransform: 'uppercase' }}>{initials}</div>
            <div>
              <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>{local.firstName || 'New'} {local.lastName || 'Lead'}</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                {local.leadNumber && <span style={{ color: '#6b7280', fontSize: '10px' }}>{local.leadNumber}</span>}
                <span style={{ padding: '1px 7px', borderRadius: '8px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', background: local.status === 'lead' ? 'rgba(16,185,129,0.15)' : local.status === 'transferred' ? 'rgba(167,139,250,0.15)' : 'rgba(96,165,250,0.15)', color: local.status === 'lead' ? GOLD : local.status === 'transferred' ? '#a78bfa' : BLUE }}>{local.status || 'prospect'}</span>
                {local.callCount > 0 && <span style={{ color: '#6b7280', fontSize: '9px' }}>· {local.callCount}/3 calls</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {local.credsSentAt && <span title="Credentials Sent" style={{ padding: '2px 6px', borderRadius: '8px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '10px' }}>🔑✓</span>}
            <button onClick={(e) => { e.stopPropagation(); sendHeadsUp(); }} disabled={headsUpSending} title="Transfer Coming" style={{ background: headsUpSent ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: headsUpSent ? '#4ade80' : '#ef4444', border: '1px solid ' + (headsUpSent ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'), borderRadius: '4px', padding: '4px 8px', cursor: headsUpSending ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: headsUpSending ? 0.5 : 1 }}>🚨</button>
            <button onClick={(e) => { e.stopPropagation(); setShowCredsPopup(true); }} title="Email Company Credentials" style={{ background: 'rgba(96,165,250,0.12)', color: BLUE, border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>🔑</button>
            {local.status === 'prospect' && <>
              <button onClick={(e) => { e.stopPropagation(); setMeetingDisposition('interested'); setShowMeetingScheduler(true); }} title="Interested" style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>✓</button>
              <button onClick={(e) => { e.stopPropagation(); setMeetingDisposition('appointment'); setShowMeetingScheduler(true); }} title="Requests Meeting" style={{ background: 'rgba(96,165,250,0.15)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>📅</button>
            </>}
            {isAdmin && local.status !== 'closed_deal' && <button onClick={(e) => { e.stopPropagation(); markClosedDeal(); }} title="Mark as Closed Deal" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>💎</button>}
            {onNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} title="Next Lead" style={{ background: GOLD + '18', color: GOLD, border: '1px solid ' + GOLD + '44', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>→</button>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: 0, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Call control — LED timer + animal + auto-record indicator */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '28px', flexShrink: 0 }}>{animalEmoji}</div>
          <div style={{ flex: 1, background: '#001a0a', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '4px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: callActive ? '#4ade80' : '#4a5568', boxShadow: callActive ? '0 0 8px #4ade80' : 'none', animation: callActive ? 'pulse 1s infinite' : 'none' }} />
            <span style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>
              {String(Math.floor(callDuration / 60)).padStart(2, '0')}:{String(callDuration % 60).padStart(2, '0')}
            </span>
            <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: 'auto' }}>{callActive ? '🔴 LIVE · ● REC' : 'Ready to call'}</span>
          </div>
          {callActive && (
            <button onClick={() => { setCallActive(false); setCallStartTime(null); }} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>⏹ End</button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, padding: '0 14px' }}>
          <button onClick={() => setCardTab('contact')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'contact' ? GOLD : 'transparent'}`, color: cardTab === 'contact' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'contact' ? 'bold' : 'normal' }}>📇 Contact</button>
          <button onClick={() => setCardTab('script')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${cardTab === 'script' ? GOLD : 'transparent'}`, color: cardTab === 'script' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: cardTab === 'script' ? 'bold' : 'normal' }}>📜 Script</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {cardTab === 'contact' && (
            <div>
              {/* Audio controls */}
              <FronterCardAudioControls />

              {/* Two-column layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                {/* Left column: Contact info */}
                <div>
                  <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>Contact</div>
                  <div style={{ marginBottom: '8px' }}><label style={ls}>First Name</label><input value={local.firstName || ''} onChange={e => update('firstName', e.target.value)} style={inp} /></div>
                  <div style={{ marginBottom: '8px' }}><label style={ls}>Last Name</label><input value={local.lastName || ''} onChange={e => update('lastName', e.target.value)} style={inp} /></div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={ls}>Primary Phone</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input value={local.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="555-123-4567" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => { if (!local.phone) return; setCallActive(true); setCallStartTime(Date.now()); setCallDuration(0); onDial?.({ ...local, phone: local.phone }); }} disabled={!local.phone} title="Dial" style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '0 10px', cursor: local.phone ? 'pointer' : 'not-allowed', fontSize: '14px', flexShrink: 0, opacity: local.phone ? 1 : 0.4 }}>📞</button>
                    </div>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={ls}>Secondary Phone</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input value={local.phone2 || ''} onChange={e => update('phone2', e.target.value)} placeholder="555-987-6543" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => { if (!local.phone2) return; setCallActive(true); setCallStartTime(Date.now()); setCallDuration(0); onDial?.({ ...local, phone: local.phone2 }); }} disabled={!local.phone2} title="Dial" style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '0 10px', cursor: local.phone2 ? 'pointer' : 'not-allowed', fontSize: '14px', flexShrink: 0, opacity: local.phone2 ? 1 : 0.4 }}>📞</button>
                    </div>
                  </div>
                  <div style={{ marginBottom: '8px' }}><label style={ls}>Email</label><input value={local.email || ''} onChange={e => update('email', e.target.value)} style={inp} placeholder="customer@email.com" /></div>
                  <div style={{ marginBottom: '8px' }}><label style={ls}>Address</label><input value={local.address || ''} onChange={e => update('address', e.target.value)} style={inp} placeholder="123 Main St, City, State 12345" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div><label style={ls}>State</label><input value={local.state || ''} onChange={e => update('state', e.target.value)} style={inp} placeholder="NY" /></div>
                    <div><label style={ls}>Zip Code</label><input value={local.zipCode || ''} onChange={e => update('zipCode', e.target.value)} style={inp} placeholder="10001" /></div>
                  </div>
                </div>

                {/* Right column: Debt info */}
                <div>
                  <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>Debt Info</div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={ls}>Amount of Debt ($)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#6b7280', fontSize: '14px' }}>$</span>
                      <input type="number" value={local.debtAmount ?? ''} onChange={e => update('debtAmount', e.target.value ? Number(e.target.value) : null)} style={inp} placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label style={ls}>Type of Debt</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {DEBT_TYPES.map(type => {
                        const selected = debtTypes.includes(type);
                        return (
                          <button key={type} onClick={() => toggleDebtType(type)} style={{ padding: '3px 8px', borderRadius: '10px', border: `1px solid ${selected ? GOLD + '55' : 'rgba(255,255,255,0.1)'}`, background: selected ? `${GOLD}12` : 'transparent', color: selected ? GOLD : '#8a9ab8', cursor: 'pointer', fontSize: '10px', fontWeight: selected ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
                            {selected ? '✓ ' : ''}{type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Qualifying Info</div>
                    <div style={{ marginBottom: '8px' }}><label style={ls}>Best Time to Call</label><input value={local.preferredCallTime || ''} onChange={e => update('preferredCallTime', e.target.value)} style={inp} placeholder="Weekdays after 5pm" /></div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={ls}>Employment Status</label>
                      <select value={local.employmentStatus || 'unknown'} onChange={e => update('employmentStatus', e.target.value)} style={inp}>
                        <option value="unknown">— Unknown —</option>
                        <option value="employed">Employed</option>
                        <option value="self_employed">Self-Employed</option>
                        <option value="unemployed">Unemployed</option>
                        <option value="retired">Retired</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={ls}>Annual Income ($)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#6b7280', fontSize: '14px' }}>$</span>
                        <input type="number" value={local.annualIncome ?? ''} onChange={e => update('annualIncome', e.target.value ? Number(e.target.value) : null)} style={inp} placeholder="0" />
                      </div>
                    </div>
                    <div><label style={ls}>Lead Source / Referral</label><input value={local.referralSource || ''} onChange={e => update('referralSource', e.target.value)} style={inp} placeholder="Facebook, Google, Referral…" /></div>
                  </div>
                </div>
              </div>

              {/* Notes section — full width */}
              <div>
                <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>Notes (Eastern Time)</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNote(); }} placeholder="Add a note..." style={inp} />
                  <button onClick={addNote} disabled={!newNote.trim()} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '0 14px', cursor: !newNote.trim() ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: newNote.trim() ? 1 : 0.5, fontFamily: 'Georgia, serif', whiteSpace: 'nowrap' }}>Add</button>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {notesLog.length === 0 ? (
                    <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '16px' }}>No notes yet.</div>
                  ) : (
                    [...notesLog].reverse().map((n, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: n.type === 'dial' ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${n.type === 'dial' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '4px', borderLeft: `3px solid ${n.type === 'dial' ? BLUE : 'rgba(255,255,255,0.15)'}` }}>
                        <div style={{ color: n.type === 'dial' ? BLUE : '#c4cdd8', fontSize: '12px', lineHeight: 1.4 }}>{n.text}</div>
                        <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '3px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span>{fmtET(n.timestamp)}</span>
                          <span>·</span>
                          <span>{n.author || '—'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {cardTab === 'script' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginLeft: '-16px', marginRight: '-16px', marginTop: '-16px', marginBottom: '-16px' }}>
              {!scriptPoppedOut ? (
                <>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 Scripts</span>
                    <button onClick={() => setScriptPoppedOut(true)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>↗ Pop Out</button>
                  </div>
                  {scriptContent}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4a5568', fontSize: '13px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div>📜 Script is popped out</div>
                    <button onClick={() => setScriptPoppedOut(false)} style={{ marginTop: '10px', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>↙ Dock Back</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save bar */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          {saved && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓ Saved</span>}
          <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 28px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>
            {saving ? '⏳ Saving…' : '💾 Save Changes'}
          </button>
        </div>

        {/* Resize handle */}
        <div onMouseDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
          const onMove = (ev) => setSize({ w: Math.max(400, startW + ev.clientX - startX), h: Math.max(400, startH + ev.clientY - startY) });
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
      </div>

      {/* Script popout */}
      {scriptPoppedOut && (
        <div style={{ position: 'fixed', left: scriptPos.x, top: scriptPos.y, width: scriptSize.w, height: scriptSize.h, background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10001, display: 'flex', flexDirection: 'column' }}>
          <div onMouseDown={onScriptDragStart} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📜 {activeScript?.name || 'Script'}</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={() => setScriptSize(s => ({ ...s, w: Math.max(300, s.w - 50) }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>−</button>
              <button onClick={() => setScriptSize(s => ({ ...s, w: s.w + 50, h: s.h + 50 }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>+</button>
              <button onClick={() => setScriptPoppedOut(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}>×</button>
            </div>
          </div>
          {scriptContent}
          <div onMouseDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY, startW = scriptSize.w, startH = scriptSize.h;
            const onMove = (ev) => setScriptSize({ w: Math.max(300, startW + ev.clientX - startX), h: Math.max(200, startH + ev.clientY - startY) });
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
        </div>
      )}

      {/* Company credentials email popup */}
      {showCredsPopup && (
        <FronterCredsEmailPopup
          lead={local}
          username={username}
          onClose={() => setShowCredsPopup(false)}
          onSent={(updated) => { setLocal(prev => ({ ...prev, ...updated })); setShowCredsPopup(false); onSave?.({ ...local, ...updated }); }}
        />
      )}

      {/* Meeting scheduler popup */}
      {showMeetingScheduler && (
        <FronterMeetingScheduler
          lead={local}
          username={username}
          disposition={meetingDisposition}
          onClose={() => setShowMeetingScheduler(false)}
          onScheduled={() => { setShowMeetingScheduler(false); onSave?.(local); }}
        />
      )}
    </>
  );
}