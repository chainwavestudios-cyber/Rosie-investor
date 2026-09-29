import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function ManagerTranscriptTab() {
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.DebtCallTranscript.list('-callDate', 500);
      setTranscripts(all || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter transcripts by search query
  const filtered = transcripts.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if ((t.leadName || '').toLowerCase().includes(q)) return true;
    if ((t.leadNumber || '').toLowerCase().includes(q)) return true;
    if ((t.agentName || '').toLowerCase().includes(q)) return true;
    try {
      const lines = JSON.parse(t.transcriptJson || '[]');
      return lines.some(l => (l.text || '').toLowerCase().includes(q));
    } catch { return false; }
  });

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search transcripts by keyword, client name, phone number, or agent…"
          style={inp}
        />
      </div>

      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
        📝 All Transcripts — {filtered.length} {search.trim() && `(of ${transcripts.length} total)`}
      </div>

      {loading ? <div style={{ color: '#4a5568', fontSize: '12px' }}>Loading…</div> :
       filtered.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No transcripts found.</div> :
       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
         {filtered.map((t, i) => {
           const isOpen = expanded === t.id;
           let lines = [];
           try { lines = JSON.parse(t.transcriptJson || '[]'); } catch {}
           const duration = t.durationSeconds ? `${Math.floor(t.durationSeconds / 60)}m ${t.durationSeconds % 60}s` : '—';
           return (
             <div key={t.id || i} style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
               <button onClick={() => setExpanded(isOpen ? null : t.id)} style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '12px', alignItems: 'center', color: '#c4cdd8', fontSize: '12px' }}>
                 <span style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold', minWidth: '120px' }}>{t.callDate ? new Date(t.callDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                 <span style={{ padding: '2px 8px', borderRadius: '2px', background: t.callMode === 'close' ? 'rgba(16,185,129,0.12)' : 'rgba(96,165,250,0.12)', color: t.callMode === 'close' ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{t.callMode || 'open'}</span>
                 <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{t.leadName || 'Unknown'}</span>
                 {t.leadNumber && <span style={{ color: GOLD, fontSize: '11px' }}>({t.leadNumber})</span>}
                 <span style={{ color: '#6b7280', fontSize: '11px' }}>Agent: {t.agentName || '—'}</span>
                 <span style={{ color: '#6b7280', fontSize: '11px' }}>{duration}</span>
                 {t.intentScore != null && <span style={{ color: '#f472b6', fontSize: '11px', fontWeight: 'bold' }}>Intent: {t.intentScore}</span>}
                 <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: 'auto' }}>{lines.length} lines</span>
                 <span style={{ color: '#6b7280', fontSize: '14px' }}>{isOpen ? '−' : '+'}</span>
               </button>
               {isOpen && (
                 <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', maxHeight: '500px', overflowY: 'auto', padding: '12px 16px' }}>
                   {lines.length === 0 ? <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center' }}>No transcript lines.</div> :
                    lines.map((msg, j) => {
                      const isAgent = msg.speaker === 0;
                      const text = msg.text || '';
                      const highlight = search.trim() && text.toLowerCase().includes(search.toLowerCase());
                      return (
                        <div key={j} style={{ marginBottom: '4px', display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0, minWidth: '50px' }}>{msg.time ? new Date(msg.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                          <span style={{ color: isAgent ? '#60a5fa' : '#10b981', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '60px' }}>{isAgent ? 'Agent' : 'Customer'}</span>
                          <span style={{ color: highlight ? '#f472b6' : '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{text}</span>
                        </div>
                      );
                    })}
                   {t.followUpReport && (
                     <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                       <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>📋 Follow-Up Report</div>
                       <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.followUpReport}</div>
                     </div>
                   )}
                 </div>
               )}
             </div>
           );
         })}
       </div>}
    </div>
  );
}