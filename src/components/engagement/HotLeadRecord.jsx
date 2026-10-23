/**
 * HotLeadRecord.jsx — the permanent hot-lead record. The cue at the top of the console
 * only shows who is hot right now and clears itself; this is the paper trail: everyone
 * who has ever crossed into hot, when they first appeared, when they were last on the
 * list, how many times they came back, their best score, and whether anyone worked them.
 */
import { useState } from 'react';
import { C, chip, btn, emptyStyle, ago, fmtDate } from '@/components/superadmin/kit';
import { tierStyle } from '@/lib/engagementTiers';
import LeadNameButton from '@/components/engagement/LeadNameButton';

export default function HotLeadRecord({ history, system, onOpenLead, onHandle, handlingId, soundOn, onToggleSound }) {
  const [copied, setCopied] = useState('');
  const rows = history || [];
  const live = rows.filter((row) => row.stillHot);
  const queue = live.filter((row) => !row.handledAt);
  const style = tierStyle('hot');

  const copyCallList = async () => {
    const lines = queue.map((row) => `${row.name || 'Lead'} — ${row.phone || 'no phone on file'}`);
    if (!lines.length) { setCopied('nothing to copy'); setTimeout(() => setCopied(''), 2500); return; }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(`${lines.length} copied`);
    } catch { setCopied('copy blocked by the browser'); }
    setTimeout(() => setCopied(''), 2500);
  };

  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '14px 16px', marginTop: '14px' }}>
      <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: C.ink, fontSize: '13px', fontWeight: 'bold' }}>📌 Hot lead record — permanent</span>
        <span style={chip(C.muted)}>{rows.length} ever recorded</span>
        {live.length > 0 && <span style={chip(C.danger)}>{live.length} hot now</span>}
        {queue.length > 0 && <span style={chip(C.warn)}>{queue.length} not worked yet</span>}
        <span style={{ flex: 1 }} />
        <button onClick={copyCallList} style={btn(C.fronter)}>{copied || '📋 Copy call list'}</button>
        <button onClick={onToggleSound} title="Sound on new hot leads" style={btn(soundOn ? C.coach : C.muted)}>{soundOn ? '🔔 Sound on' : '🔕 Sound off'}</button>
      </div>
      <div style={{ color: C.muted, fontSize: '11px', margin: '4px 0 11px' }}>
        Everyone who has ever shown up hot in {system === 'coach' ? 'Debt Call Coach' : 'the fronter workspace'}, newest arrival first. The live cue clears itself — this does not.
      </div>

      {rows.length === 0 && <div style={emptyStyle}>Nobody has gone hot in this system yet — the first one lands here the moment it happens.</div>}

      {rows.length > 0 && (
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {rows.map((row) => (
            <div key={row.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '9px 10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${row.stillHot ? `${style.color}44` : C.border}`, borderRadius: '6px', marginBottom: '6px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '7px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <LeadNameButton lead={row} onOpenLead={onOpenLead} />
                  {row.stillHot
                    ? <span style={chip(C.danger)}>🔥 hot now · {row.lastScore}</span>
                    : <span style={chip(C.muted)}>❄️ cooled · peak {row.peakScore}</span>}
                  {row.hotSessions > 1 && <span style={chip(C.warn)}>↻ {row.hotSessions}×</span>}
                  {row.handledAt
                    ? <span style={chip(C.fronter)}>✓ worked by {row.handledBy || 'staff'} {ago(row.handledAt)}</span>
                    : <span style={chip(C.coach)}>◻ not worked yet</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {row.phone
                    ? <a href={`tel:${row.phone}`} style={{ color: C.fronter, fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}>📞 {row.phone}</a>
                    : <span style={{ color: C.dim, fontSize: '10px' }}>no phone on file</span>}
                  <span style={{ color: C.dim, fontSize: '10px' }}>first {fmtDate(row.firstHotAt)} · last {ago(row.lastHotAt)}</span>
                </div>
                {row.action && <div style={{ color: C.warn, fontSize: '11px', marginTop: '3px' }}>➜ {row.action}</div>}
                {row.reasons?.length > 0 && (
                  <div style={{ color: C.muted, fontSize: '10px', marginTop: '3px' }}>{row.reasons.join(' · ')}</div>
                )}
              </div>
              <button
                onClick={() => onHandle(row, !row.handledAt)}
                disabled={handlingId === row.id}
                style={{ ...btn(row.handledAt ? C.muted : C.fronter), opacity: handlingId === row.id ? 0.5 : 1 }}
              >{handlingId === row.id ? '…' : row.handledAt ? 'Reopen' : '✓ Worked'}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}