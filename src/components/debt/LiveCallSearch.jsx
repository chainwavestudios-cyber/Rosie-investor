const GOLD = '#10b981', DARK = '#0a0f1e';
export default function LiveCallSearch({ phase, session: s }) {
  if (phase === 'live') return <button onClick={s.handleEndCallClick} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' }}>⏹ End</button>;
  const startStyle = { color: DARK, border: 'none', borderRadius: 4, padding: '6px 12px', cursor: s.kbLoading ? 'not-allowed' : 'pointer', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', opacity: s.kbLoading ? 0.5 : 1, whiteSpace: 'nowrap' };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
    <label style={{ color: '#8a9ab8', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>👤 Search Client Profile</label>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <input value={s.leadSearch} onChange={e => s.setLeadSearch(e.target.value)} onFocus={() => s.setLeadSearchFocus(true)} onBlur={() => setTimeout(() => s.setLeadSearchFocus(false), 200)} placeholder="Type name, phone, or email…" style={{ width: 200, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '6px 10px', color: '#e8e0d0', fontSize: 11, outline: 'none', fontFamily: 'Georgia, serif' }} />
      <button onClick={() => s.startCall(false)} disabled={s.kbLoading} style={{ ...startStyle, background: 'linear-gradient(135deg,#10b981,#22c55e)' }}>{s.kbLoading ? 'Loading…' : '🔴 Live Call (Alt+L)'}</button>
      <button onClick={() => s.startCall(false, true)} disabled={s.kbLoading} title="Single-mic test mode — play a pre-recorded call through speakers, no dual-channel duplicates" style={{ ...startStyle, background: 'linear-gradient(135deg,#f59e0b,#f97316)' }}>🧪 Test Call</button>
    </div>
    {s.leadSearchFocus && s.leadSearchResults.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, background: DARK, border: `1px solid ${GOLD}44`, borderRadius: 4, maxHeight: 240, overflowY: 'auto', zIndex: 10000, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
      {s.leadSearchResults.map(l => <button key={l.id} onClick={() => s.selectLeadAndStartCall(l)} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px', cursor: 'pointer', textAlign: 'left', color: '#c4cdd8', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{l.firstName} {l.lastName}</span><span style={{ color: '#6b7280', fontSize: 9 }}>{l.phone || l.email || l.leadNumber || ''}</span></button>)}
    </div>}
  </div>;
}