/**
 * AIAgentScriptBuilderSection.jsx — Fronter → 🤖 AI Agent → 🧠 AI Script Builder.
 *
 * Load a script (file, saved script or pasted text), tag it Incoming or Outgoing,
 * and the AI writes the MIRROR script for the opposite direction plus that
 * direction's System Prompt, Script Flow, Rebuttals and Q&A Tuning — grounded in
 * the knowledge base. Nothing is written until Apply, and Apply renames and
 * rewrites the current AI script for that direction.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import AIAgentScriptReview from './AIAgentScriptReview';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';
const BLUE = '#60a5fa';
const RED = '#ef4444';

const inp = { width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 11px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const card = { background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '14px' };
const head = { color: PURPLE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' };
const toggleBtn = (active, color) => ({ background: active ? `${color}22` : 'rgba(255,255,255,0.04)', color: active ? color : '#8a9ab8', border: `1px solid ${active ? `${color}66` : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
const STEP_COLORS = { pending: '#6b7280', running: PURPLE, done: GOLD, error: RED };
const STEP_ICONS = { pending: '○', running: '◍', done: '✓', error: '⚠' };

export default function AIAgentScriptBuilderSection() {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const [direction, setDirection] = useState('outgoing');
  const [mode, setMode] = useState('upload');
  const [pasteText, setPasteText] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileUri, setFileUri] = useState('');
  const [fileName, setFileName] = useState('');
  const [saved, setSaved] = useState([]);
  const [current, setCurrent] = useState({});
  const [pickedId, setPickedId] = useState('');
  const [steps, setSteps] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [fronter, aiScripts] = await Promise.all([
        base44.entities.FronterScript.list({ limit: 100 }),
        base44.entities.AIAgentScript.list({ limit: 50 }),
      ]);
      const rows = aiScripts.items || [];
      setSaved([
        ...rows.map(s => ({ id: s.id, name: s.name, content: s.content || '', tag: s.direction === 'incoming' ? 'AI incoming' : 'AI outgoing' })),
        ...(fronter.items || []).map(s => ({ id: s.id, name: s.name, content: s.content || '', tag: 'Fronter' })),
      ]);
      const byDirection = {};
      rows.forEach(r => { if (!byDirection[r.direction]) byDirection[r.direction] = r; });
      setCurrent(byDirection);
    } catch { /* the builder still works with a pasted script */ }
  };

  useEffect(() => { load(); }, []);

  const target = direction === 'outgoing' ? 'incoming' : 'outgoing';
  const currentTarget = current[target];
  const picked = saved.find(s => s.id === pickedId);
  const sourceText = mode === 'paste' ? pasteText : mode === 'saved' ? (picked?.content || '') : fileText;
  const sourceLabel = mode === 'saved' ? (picked?.name || 'saved script') : mode === 'paste' ? 'pasted script' : (fileName || 'uploaded script');
  const ready = mode === 'upload' ? Boolean(fileText || fileUri) : Boolean(sourceText.trim());
  const hasContent = Boolean(proposal?.name && proposal?.script);

  const onFile = async (file) => {
    if (!file) return;
    setError(''); setResult(null); setFileName(file.name);
    const isText = (file.type || '').startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name);
    const isDoc = file.type === 'application/pdf' || (file.type || '').startsWith('image/');
    try {
      if (isText) { setFileText(await file.text()); setFileUri(''); return; }
      setFileText('');
      if (!isDoc) { setFileUri(''); setError('That file type is not supported — load a PDF, an image, or a .txt / .md file.'); return; }
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      const uri = res?.file_uri || res?.data?.file_uri || '';
      if (!uri) throw new Error('Upload failed — try again.');
      setFileUri(uri);
    } catch (e) { setError(e?.message || 'Could not read that file.'); }
  };

  const run = async () => {
    if (!ready) { setError('Add a script first — upload a file, pick a saved one, or paste it.'); return; }
    setRunning(true); setError(''); setResult(null); setProposal(null);

    const queue = [];
    if (!sourceText.trim() && fileUri) queue.push({ key: 'extract', label: 'Reading the uploaded script' });
    queue.push({ key: 'counterpart', label: `Writing the ${target} script + agent sections` });
    const initial = {};
    queue.forEach(q => { initial[q.key] = { label: q.label, status: 'pending' }; });
    setSteps(initial);

    let text = sourceText;
    for (const q of queue) {
      setSteps(prev => ({ ...prev, [q.key]: { ...prev[q.key], status: 'running' } }));
      try {
        const res = await base44.functions.invoke('aiScriptBuilder', {
          action: 'generate', section: q.key, sourceText: text, sourceLabel, fileUri, sourceDirection: direction,
          sessionUserId, sessionToken,
        });
        const data = res?.data || res;
        if (data?.error) throw new Error(data.error);

        if (q.key === 'extract') {
          text = String(data?.text || '');
          if (!text) throw new Error('Could not read the uploaded document.');
          setSteps(prev => ({ ...prev, extract: { ...prev.extract, status: 'done', count: `${text.length.toLocaleString()} characters read` } }));
        } else {
          const payload = data?.data || {};
          setProposal({
            direction: payload.direction === 'incoming' ? 'incoming' : target,
            name: payload.name || `${target.toUpperCase()} — AI script`,
            script: payload.script || '',
            agentConfig: payload.config || {},
          });
          setSteps(prev => ({ ...prev, counterpart: { ...prev.counterpart, status: 'done', count: `${Object.keys(payload.config || {}).length} agent fields` } }));
        }
      } catch (e) {
        setSteps(prev => ({ ...prev, [q.key]: { ...prev[q.key], status: 'error', error: e?.message || String(e) } }));
      }
    }
    setRunning(false);
  };

  const apply = async () => {
    if (!hasContent) return;
    setApplying(true); setError('');
    try {
      const res = await base44.functions.invoke('aiScriptBuilder', {
        action: 'apply', sourceLabel, sessionUserId, sessionToken,
        proposal: {
          counterpart: { direction: proposal.direction, name: proposal.name, script: proposal.script },
          agentConfig: proposal.agentConfig,
        },
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
      await load();
    } catch (e) { setError(e?.message || String(e)); }
    setApplying(false);
  };

  return (
    <div>
      {/* 1 · The script you have */}
      <div style={card}>
        <div style={head}>1 · The script you have</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button style={toggleBtn(direction === 'outgoing', BLUE)} onClick={() => setDirection('outgoing')}>📤 Outgoing script</button>
          <button style={toggleBtn(direction === 'incoming', GOLD)} onClick={() => setDirection('incoming')}>📥 Incoming script</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button style={toggleBtn(mode === 'upload', PURPLE)} onClick={() => setMode('upload')}>📎 Load a file</button>
          <button style={toggleBtn(mode === 'saved', PURPLE)} onClick={() => setMode('saved')}>📂 Saved script</button>
          <button style={toggleBtn(mode === 'paste', PURPLE)} onClick={() => setMode('paste')}>✍️ Paste script</button>
        </div>

        {mode === 'upload' && (
          <div>
            <input type="file" accept=".txt,.md,.csv,.pdf,.png,.jpg,.jpeg" onChange={e => onFile(e.target.files?.[0])} style={{ ...inp, padding: '8px 10px' }} />
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>
              Text files are read straight in. PDFs and images are uploaded (stored privately) and read by the AI from a temporary link.
            </div>
            {(fileText || fileUri) && (
              <div style={{ color: GOLD, fontSize: '11px', marginTop: '8px' }}>
                ✓ {fileName} {fileText ? `— ${fileText.length.toLocaleString()} characters ready` : '— uploaded, the AI will read it'}
              </div>
            )}
          </div>
        )}

        {mode === 'saved' && (
          saved.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '12px' }}>No saved scripts found.</div>
          ) : (
            <select value={pickedId} onChange={e => setPickedId(e.target.value)} style={inp}>
              <option value="">Select a saved script…</option>
              {saved.map(s => (
                <option key={s.id} value={s.id}>{s.tag} — {s.name} ({(s.content || '').length.toLocaleString()} chars)</option>
              ))}
            </select>
          )
        )}

        {mode === 'paste' && (
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={10} placeholder={`Paste the ${direction} script here…`} style={{ ...inp, lineHeight: 1.5 }} />
        )}
      </div>

      {/* What will be renamed + rewritten */}
      <div style={{ ...card, background: 'rgba(96,165,250,0.05)', borderColor: 'rgba(96,165,250,0.2)' }}>
        <div style={{ ...head, color: BLUE }}>2 · The {target === 'incoming' ? 'incoming' : 'outgoing'} AI script this will rewrite</div>
        {currentTarget ? (
          <>
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>{currentTarget.name}</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '8px' }}>
              {(currentTarget.content || '').length.toLocaleString()} characters · {currentTarget.updatedAt ? `last updated ${new Date(currentTarget.updatedAt).toLocaleDateString('en-US')}` : 'no update date'}
            </div>
            <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px', color: '#8a9ab8', fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {(currentTarget.content || '').slice(0, 1200)}{(currentTarget.content || '').length > 1200 ? '…' : ''}
            </div>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>Applying will rename and rewrite this script for the {target} direction.</div>
          </>
        ) : (
          <div style={{ color: '#8a9ab8', fontSize: '12px' }}>
            No {target} AI script saved yet — the builder will create one, named and written from your {direction} script.
          </div>
        )}
      </div>

      {/* Build */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={head}>3 · Build the mirror script + agent sections</div>
          <button
            onClick={run}
            disabled={running || !ready}
            style={{ background: running || !ready ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${PURPLE},#8b5cf6)`, color: running || !ready ? '#6b7280' : '#0a0f1e', border: 'none', borderRadius: '4px', padding: '9px 18px', cursor: running || !ready ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {running ? '⏳ Building…' : `🪄 Build the ${target} script + sections`}
          </button>
        </div>

        {steps && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(steps).map(([key, s]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ color: STEP_COLORS[s.status], fontWeight: 'bold', width: '14px' }}>{STEP_ICONS[s.status]}</span>
                <span style={{ color: s.status === 'pending' ? '#6b7280' : '#e8e0d0' }}>{s.label}</span>
                {s.count && <span style={{ color: GOLD, fontSize: '11px' }}>— {s.count}</span>}
                {s.error && <span style={{ color: RED, fontSize: '11px' }}>— {s.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review + apply */}
      {proposal && <AIAgentScriptReview proposal={proposal} setProposal={setProposal} />}

      {hasContent && !result && (
        <button
          onClick={apply}
          disabled={applying}
          style={{ background: applying ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${GOLD},#059669)`, color: applying ? '#6b7280' : '#0a0f1e', border: 'none', borderRadius: '4px', padding: '12px 22px', cursor: applying ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', marginBottom: '14px' }}
        >
          {applying ? '⏳ Applying…' : `✅ Rename, rewrite and apply the ${proposal.direction} script`}
        </button>
      )}

      {result && (
        <div style={{ ...card, borderColor: `${GOLD}44` }}>
          <div style={head}>✅ Applied</div>
          <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.8 }}>
            {result.aiScript
              ? <div>{result.aiScript.direction === 'incoming' ? 'Incoming' : 'Outgoing'} AI script — {result.aiScript.action} as “{result.aiScript.name}”</div>
              : <div>AI script — unchanged</div>}
            <div>Agent config — {result.agentConfig ? 'updated for this direction' : 'no changes'}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: `${RED}12`, border: `1px solid ${RED}44`, borderRadius: '4px', padding: '12px 14px', color: RED, fontSize: '12px' }}>⚠ {error}</div>
      )}
    </div>
  );
}