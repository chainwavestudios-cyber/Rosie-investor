/**
 * WCRChecklist.jsx — Floating, draggable, resizable WCR (Welcome Call Review) checklist.
 * All requirements as checkable items, % complete progress bar, and a reminder setter
 * that fires a popup when it's time to finish the checklist.
 * Persisted to localStorage. Rendered at the DebtCallCoach level.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const STORAGE_KEY = 'wcr_checklist_state';
const SIZE_KEY = 'wcr_checklist_size';

const CHECKLIST_SECTIONS = [
  {
    id: 'main', label: '📋 Main Page & Program Calculator', color: '#60a5fa',
    items: [
      "Verify that the file is in the correct agent's name.",
      "If there is an Opener/TO agent on the file, check that it is assigned accordingly.",
      "Verify that the Status is not 'Xchange'.",
      'Check that "Language" is selected.',
      'Check that the Payment date is in the future.',
      'If the "Change Initial Payment Date" box is checked, the recurring date must be AFTER the 1st payment date.',
      'For all reps in Chat Level 1, the 1st payment must be scheduled within 14 days. (Two exceptions per month; after that, manager approval required. SS tracks exceptions.)',
      'Check for potentially invalid Term Extensions: NO EXTENSIONS on Single Account Files!!',
      'Check for a fee reduction. Does the rep still qualify for a fee reduction?',
      'Verify that the client has opted in to SMS Messaging.',
    ],
  },
  {
    id: 'profile-customer', label: '👤 Profile — Customer Information', color: '#f59e0b',
    items: [
      'Full Name: Double-check spelling, sentence case, only first letter capitalized.',
      'Middle Initial: If no middle name, leave a comment to note this.',
      'Date of Birth',
      "Mother's Maiden Name: This must be the Mother's Maiden Name.",
      'Gender (Optional)',
      'FULL Social Security # — All 9 digits (Check "Credit Pull History").',
      'Phone Number — Double-check for accuracy.',
      'Email Address — Double-check for accuracy.',
      'If there is a Co-App, all the same requirements apply.',
    ],
  },
  {
    id: 'profile-mailing', label: '📬 Profile — Mailing Address', color: '#a78bfa',
    items: ['Mailing Address — Validate'],
  },
  {
    id: 'profile-banking', label: '🏦 Profile — Banking Information', color: '#34d399',
    items: ['Banking Information — Validate & double-check for accuracy'],
  },
  {
    id: 'profile-financial', label: '💰 Profile — Financial Information', color: '#4ade80',
    items: [
      'Income',
      'Detailed Expenses',
      'The available Budget must be more than the Program Payment',
    ],
  },
  {
    id: 'profile-other', label: '📝 Profile — Other Information', color: '#fb923c',
    items: [
      'Select Campaign — Mailers will automatically assign the campaign',
      'Select and elaborate on Hardship. Must be at least 3 sentences: What happened? When? How has it impacted finances?',
      'Occupation (Optional)',
      'Residence Ownership (Optional)',
    ],
  },
  {
    id: 'creditor', label: '💳 Creditor Tab', color: '#ef4444',
    items: [
      'All accounts must be eligible for enrollment. Use Company Directory and/or Enrollment Guidelines.',
      'All accounts must have at least 3 complete consecutive monthly payments to the Credit Report.',
      'If a single account file, there are NO exceptions on the term.',
      'AMEX CC must be the account # from the physical card.',
      'AMEX Loan must have the last 5-6 digits of the account number as shown on the statement.',
      'Capital One must have the entire 16-digit account #.',
      'Discover must have the entire 16-digit account #.',
      'NO "Line of Credit" (other than Upstart) — Must check Credit Report.',
      'NO Credit Unions of Any Kind (Exceptions: Navy Fed, Pentagon Fed, Vystar).',
      'USAA or NFCU: must enroll all accounts with that creditor, no secured accounts, agree to close remaining accounts, cannot enroll with USAA/NFCU bank account.',
      'NO Medical Debt of Any Kind.',
      'No Business Debt of Any Kind (even if the Business is dissolved).',
      'NO Student Loans — Navient is the only exception.',
      'NO Goldman Sachs or GS Bank.',
      'Verify that any accounts showing in dispute are not actually in dispute. Leave a note in the file.',
      'Verify that any Regions Bank accounts are NOT through Enerbank.',
      '90% of the Eligible Debt must be included. Manager approval required if more than 10% left out.',
      'The current Creditor Name field is filled out for Collection Accounts and blank for other accounts.',
      'Credit report must show at least 3 payments or Months Reviewed. If not, get proof (statements) and upload before submitting.',
      'For Charged Off / Collections accounts, confirm where currently handled (internal collections, third-party agency, or law firm). Leave a note.',
      'If applicable, check for any indication of an active garnishment.',
    ],
  },
  {
    id: 'creditor-amounts', label: '🧾 Creditor Tab — Enrolled Amounts & Statements', color: '#f472b6',
    items: [
      "Enrolled amounts must match amounts on the Credit Report. If different or not on report, a statement must be uploaded.",
      "Statements must include: Date (Within 30 Days), Client's Name, Creditor Name, Account #, Current Balance, Confirmation of 3 payments made.",
    ],
  },
  {
    id: 'program-calc', label: '🧮 Program Calculator', color: '#60a5fa',
    items: [
      'The monthly Draft must be at least $315.',
      'The first Draft Date must be at least 3 business days out, but within 30 calendar days of signing.',
      'For all reps in Chat Level 1, the 1st payment must be scheduled within 14 days.',
      'Double-check the draft schedule for accuracy.',
      'Check that the Payment date is in the future.',
      'If "Change Initial Payment Date" is checked, recurring date must be AFTER the 1st payment date.',
    ],
  },
  {
    id: 'documents', label: '📄 Documents Tab', color: '#a78bfa',
    items: [
      'Verify that the credit report has been uploaded to the file.',
      'If pulled outside of Zenith, upload the credit report manually.',
    ],
  },
  {
    id: 'post-approval', label: '✅ Post-Approval (GOTA & Welcome Call)', color: '#4ade80',
    items: [
      'After receiving the Green Light, transition to a GOTA to review the agreement and program expectations with the client.',
      'After the client signs the agreement, transfer to the Welcome Call. Check the company directory for the correct number.',
    ],
  },
];

// Flatten for quick count
const ALL_ITEMS = CHECKLIST_SECTIONS.flatMap(s => s.items.map((text, i) => ({ id: `${s.id}-${i}`, text, section: s.id })));

export default function WCRChecklist() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const [reminder, setReminder] = useState(null); // { fireAt } or null
  const [reminderInput, setReminderInput] = useState({ hours: 0, minutes: 30 });
  const [reminderFired, setReminderFired] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Window position/size
  const saved = (() => { try { return JSON.parse(localStorage.getItem(SIZE_KEY) || 'null'); } catch { return null; } })();
  const [pos, setPos] = useState(saved ? { x: saved.x, y: saved.y } : { x: 60, y: 80 });
  const [size, setSize] = useState(saved ? { w: saved.w, h: saved.h } : { w: 480, h: 600 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef(null);

  // Load saved checkbox state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {}
  }, []);

  // Save checkbox state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  // Save window size/position
  useEffect(() => {
    localStorage.setItem(SIZE_KEY, JSON.stringify({ x: pos.x, y: pos.y, w: size.w, h: size.h }));
  }, [pos, size]);

  // Tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reminder timer
  useEffect(() => {
    if (!reminder) return;
    const ms = reminder.fireAt - Date.now();
    if (ms <= 0) { setReminderFired(true); setReminder(null); return; }
    const t = setTimeout(() => { setReminderFired(true); setReminder(null); }, ms);
    return () => clearTimeout(t);
  }, [reminder]);

  // Drag/resize handlers
  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (e) => {
      if (dragging) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 80, dragStart.current.px + e.clientX - dragStart.current.mx)),
          y: Math.max(0, Math.min(window.innerHeight - 40, dragStart.current.py + e.clientY - dragStart.current.my)),
        });
      }
      if (resizing) {
        setSize({
          w: Math.max(350, Math.min(window.innerWidth - pos.x - 4, dragStart.current.sw + e.clientX - dragStart.current.mx)),
          h: Math.max(300, Math.min(window.innerHeight - pos.y - 4, dragStart.current.sh + e.clientY - dragStart.current.my)),
        });
      }
    };
    const onUp = () => { setDragging(false); setResizing(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, resizing, pos.x, pos.y]);

  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y, sw: size.w, sh: size.h };
  };
  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y, sw: size.w, sh: size.h };
  };

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSection = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const totalChecked = ALL_ITEMS.filter(i => checked[i.id]).length;
  const pct = Math.round((totalChecked / ALL_ITEMS.length) * 100);
  const pctColor = pct === 100 ? '#4ade80' : pct >= 75 ? GOLD : pct >= 50 ? '#f59e0b' : '#ef4444';

  const setReminderFromInput = () => {
    const ms = (Number(reminderInput.hours) || 0) * 3600000 + (Number(reminderInput.minutes) || 0) * 60000;
    if (ms < 60000) { alert('Please set at least 1 minute.'); return; }
    setReminder({ fireAt: Date.now() + ms });
    setReminderFired(false);
  };

  const resetAll = () => {
    if (window.confirm('Reset all checkboxes? This will uncheck everything.')) setChecked({});
  };

  const remainingMs = reminder ? reminder.fireAt - now : 0;
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);

  // FAB
  if (!visible) {
    return (
      <>
        <button onClick={() => setVisible(true)} title="Open WCR Checklist"
          style={{ position: 'fixed', bottom: '84px', right: '24px', zIndex: 99998, background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '50%', width: '52px', height: '52px', fontSize: '22px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✅
        </button>
        {reminderFired && <ReminderFiredPopup onClose={() => setReminderFired(false)} onOpen={() => { setVisible(true); setReminderFired(false); }} pct={pct} />}
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', boxShadow: '0 12px 60px rgba(0,0,0,0.7)', zIndex: 99998, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
        {/* Header — draggable */}
        <div onMouseDown={startDrag} style={{ padding: '10px 14px', background: `${GOLD}12`, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
          <div>
            <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>✅ WCR Checklist</span>
            <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: '8px' }}>Zenith · Sep 21, 2026</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={resetAll} title="Reset all" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}>↺ Reset</button>
            <button onClick={() => setVisible(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}>×</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ color: pctColor, fontSize: '20px', fontWeight: 'bold' }}>{pct}%</span>
            <span style={{ color: '#6b7280', fontSize: '11px' }}>{totalChecked} / {ALL_ITEMS.length} checked</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pctColor, borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Reminder bar */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>⏰ Remind me in:</span>
          <input type="number" min="0" max="23" value={reminderInput.hours} onChange={e => setReminderInput(p => ({ ...p, hours: Number(e.target.value) }))} style={{ width: '42px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '4px 6px', color: '#e8e0d0', fontSize: '12px', outline: 'none', textAlign: 'center' }} />
          <span style={{ color: '#6b7280', fontSize: '11px' }}>hr</span>
          <input type="number" min="0" max="59" value={reminderInput.minutes} onChange={e => setReminderInput(p => ({ ...p, minutes: Number(e.target.value) }))} style={{ width: '42px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '4px 6px', color: '#e8e0d0', fontSize: '12px', outline: 'none', textAlign: 'center' }} />
          <span style={{ color: '#6b7280', fontSize: '11px' }}>min</span>
          {reminder ? (
            <button onClick={() => setReminder(null)} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Cancel ({remainingMin}m {remainingSec}s)</button>
          ) : (
            <button onClick={setReminderFromInput} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Set</button>
          )}
        </div>

        {/* Checklist body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
          {CHECKLIST_SECTIONS.map(section => {
            const sectionItems = ALL_ITEMS.filter(i => i.section === section.id);
            const sectionChecked = sectionItems.filter(i => checked[i.id]).length;
            const isCollapsed = collapsed[section.id];
            return (
              <div key={section.id} style={{ marginBottom: '10px' }}>
                <div onClick={() => toggleSection(section.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: `${section.color}11`, border: `1px solid ${section.color}22`, borderRadius: '4px', cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ color: section.color, fontSize: '10px' }}>{isCollapsed ? '▸' : '▾'}</span>
                  <span style={{ color: section.color, fontSize: '11px', fontWeight: 'bold', flex: 1 }}>{section.label}</span>
                  <span style={{ color: sectionChecked === sectionItems.length ? '#4ade80' : '#6b7280', fontSize: '10px' }}>{sectionChecked}/{sectionItems.length}</span>
                </div>
                {!isCollapsed && (
                  <div style={{ marginTop: '4px' }}>
                    {sectionItems.map(item => (
                      <label key={item.id} style={{ display: 'flex', gap: '8px', padding: '6px 10px', cursor: 'pointer', borderRadius: '3px', alignItems: 'flex-start', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <input type="checkbox" checked={!!checked[item.id]} onChange={() => toggle(item.id)} style={{ marginTop: '2px', accentColor: GOLD, cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ color: checked[item.id] ? '#6b7280' : '#c4cdd8', fontSize: '12px', lineHeight: 1.5, textDecoration: checked[item.id] ? 'line-through' : 'none' }}>{item.text}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resize handle */}
        <div onMouseDown={startResize} style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', cursor: 'nwse-resize', color: '#4a5568', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '2px', fontSize: '10px', userSelect: 'none' }}>⤡</div>
      </div>

      {reminderFired && <ReminderFiredPopup onClose={() => setReminderFired(false)} onOpen={() => setReminderFired(false)} pct={pct} />}
    </>
  );
}

function ReminderFiredPopup({ onClose, onOpen, pct }) {
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0d1b2a', border: `2px solid ${GOLD}`, borderRadius: '8px', padding: '20px', maxWidth: '320px', boxShadow: '0 20px 80px rgba(0,0,0,0.9)', zIndex: 99999, fontFamily: 'Georgia, serif', animation: 'wcrSlide 0.3s ease-out' }}>
      <style>{`@keyframes wcrSlide{from{transform:translateY(400px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⏰ WCR Reminder</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
      </div>
      <p style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px' }}>Time to finish your WCR Checklist!</p>
      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 12px' }}>{pct}% complete — {pct === 100 ? 'All done! 🎉' : 'Keep going, you\'re almost there.'}</p>
      <button onClick={onOpen} style={{ width: '100%', background: `linear-gradient(135deg, ${GOLD}, #22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Open Checklist →</button>
    </div>
  );
}