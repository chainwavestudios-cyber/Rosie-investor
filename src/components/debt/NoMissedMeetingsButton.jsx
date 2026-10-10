/**
 * NoMissedMeetingsButton.jsx — Scans transcripts for follow-up requests and
 * compares to actual Google Calendar events. Shows missed meetings so nothing
 * slips through. Date range or "today only" option.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';

export default function NoMissedMeetingsButton() {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [setting, setSetting] = useState(false);
  const [allSetResult, setAllSetResult] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('today'); // 'today' | 'range'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const runScan = async () => {
    setScanning(true); setError(''); setResult(null); setAllSetResult(null);
    try {
      const payload = mode === 'today' ? { todayOnly: true } : { dateFrom, dateTo };
      const res = await base44.functions.invoke('noMissedMeetings', payload);
      setResult(res?.data || res);
    } catch (e) { setError('Scan failed: ' + (e?.message || String(e))); }
    setScanning(false);
  };

  const setAllMissed = async () => {
    if (!result?.missed?.length) return;
    setSetting(true); setError('');
    try {
      const res = await base44.functions.invoke('noMissedMeetings', { action: 'setAllMissed', missedMeetings: result.missed });
      setAllSetResult(res?.data || res);
    } catch (e) { setError('Failed to set meetings: ' + (e?.message || String(e))); }
    setSetting(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
        🚫 No Missed Meetings
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => !scanning && setOpen(false)}>
          <div style={{ background: '#0d1b2a', border: `1px solid ${RED}44`, borderRadius: '8px', maxWidth: '680px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ color: RED, fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>🚫 No Missed Meetings</div>
                <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>Scans transcripts for follow-up requests and matches them to Google Calendar events</div>
              </div>
              <button onClick={() => setOpen(false)} disabled={scanning} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Mode selector */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
              <button onClick={() => setMode('today')} style={{ padding: '7px 16px', borderRadius: '4px', border: `1px solid ${mode === 'today' ? RED + '66' : 'rgba(255,255,255,0.1)'}`, background: mode === 'today' ? `${RED}18` : 'transparent', color: mode === 'today' ? RED : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📅 Today Only</button>
              <button onClick={() => setMode('range')} style={{ padding: '7px 16px', borderRadius: '4px', border: `1px solid ${mode === 'range' ? RED + '66' : 'rgba(255,255,255,0.1)'}`, background: mode === 'range' ? `${RED}18` : 'transparent', color: mode === 'range' ? RED : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📆 Date Range</button>
            </div>

            {mode === 'range' && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', colorScheme: 'dark' }} />
                </div>
              </div>
            )}

            <button onClick={runScan} disabled={scanning || (mode === 'range' && (!dateFrom || !dateTo))} style={{ width: '100%', background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px', cursor: scanning ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: scanning || (mode === 'range' && (!dateFrom || !dateTo)) ? 0.5 : 1, marginBottom: '14px' }}>
              {scanning ? '⏳ Scanning transcripts…' : '🔍 Scan for Missed Meetings'}
            </button>

            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: RED, fontSize: '12px', marginBottom: '12px' }}>⚠ {error}</div>}

            {result && (
              <div>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                  <SummaryCard label="Transcripts" value={result.totalTranscriptsScanned || 0} color={BLUE} />
                  <SummaryCard label="Follow-ups" value={result.totalRequests || 0} color={AMBER} />
                  <SummaryCard label="Matched" value={result.matchedCount || 0} color={GOLD} />
                  <SummaryCard label="MISSED" value={result.missedCount || 0} color={RED} />
                </div>

                {result.missedCount === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                    <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold' }}>No missed meetings!</div>
                    <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>Every follow-up request has a matching calendar event.</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ color: RED, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⚠ Missed Meetings — No Calendar Event Found</div>
                      <button onClick={setAllMissed} disabled={setting} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '7px 16px', cursor: setting ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: setting ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                        {setting ? '⏳ Setting…' : '📅 Set All Missed Meetings'}
                      </button>
                    </div>
                    {allSetResult && (
                      <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', marginBottom: '10px', fontSize: '12px' }}>
                        <span style={{ color: GOLD, fontWeight: 'bold' }}>✓ Created {allSetResult.createdCount || 0} event(s)</span>
                        {allSetResult.failedCount > 0 && <span style={{ color: RED, marginLeft: '12px' }}>⚠ {allSetResult.failedCount} failed</span>}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(result.missed || []).map((m, i) => (
                        <div key={i} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <div>
                              <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{m.leadName || 'Unknown Lead'}</div>
                              <div style={{ color: AMBER, fontSize: '11px', marginTop: '2px' }}>📅 Requested: {m.requestedTimeLabel}</div>
                            </div>
                            <div style={{ color: '#4a5568', fontSize: '10px' }}>{m.callDate ? new Date(m.callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
                          </div>
                          {m.summary && <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>{m.summary}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '20px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>{label}</div>
    </div>
  );
}