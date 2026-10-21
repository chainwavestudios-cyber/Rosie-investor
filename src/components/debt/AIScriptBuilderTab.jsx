/**
 * AIScriptBuilderTab.jsx — Debt Call Coach → ⚙️ Admin → 🧠 AI Script Builder.
 *
 * Load a newly uploaded fronter script (file, saved script, or pasted text) and
 * the Anthropic builder rebuilds the whole script system from it: fronter
 * scripts, the AI agent's outbound + inbound config, rebuttals, common
 * questions and the main knowledge base. Nothing is written until Apply.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import AIScriptProposalPreview from '@/components/debt/AIScriptProposalPreview';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';
const RED = '#ef4444';

const SECTIONS = [
  { key: 'scripts', label: 'Fronter scripts — open, discovery, rebuttals, close' },
  { key: 'agent_config', label: 'AI agent config — outbound + inbound' },
  { key: 'objections', label: 'Rebuttals' },
  { key: 'common_questions', label: 'Common questions (fronter Q&A)' },
  { key: 'main_kb', label: 'Main knowledge base' },
];

const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const card = { background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px', marginBottom: '14px' };
const head = { color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' };
const modeBtn = (active) => ({ background: active ? `${GOLD}18` : 'rgba(255,255,255,0.04)', color: active ? GOLD : '#8a9ab8', border: `1px solid ${active ? `${GOLD}44` : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });

const STEP_COLORS = { pending: '#6b7280', running: PURPLE, done: GOLD, error: RED };
const STEP_ICONS = { pending: '○', running: '◍', done: '✓', error: '⚠' };

function countOf(key, data) {
  if (key === 'extract') return 'text ready';
  const payload = data?.data || {};
  if (key === 'scripts') return `${(payload.scripts || []).length} scripts`;
  if (key === 'objections') return `${(payload.objections || []).length} rebuttals`;
  if (key === 'common_questions') return `${(payload.entries || []).length} Q&A pairs`;
  if (key === 'main_kb') return `${(payload.entries || []).length} entries`;
  const filled = Object.keys(payload || {}).filter(k => typeof payload[k] === 'string' && payload[k].trim()).length;
  return `${filled} config fields`;
}

export default function AIScriptBuilderTab() {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const [mode, setMode] = useState('upload');
  const [pasteText, setPasteText] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileUri, setFileUri] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [fileName, setFileName] = useState('');
  const [saved, setSaved] = useState([]);
  const [pickedId, setPickedId] = useState('');
  const [steps, setSteps] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [fronter, dialer] = await Promise.all([
          base44.entities.FronterScript.list({ limit: 100 }),
          base44.entities.DebtScript.list({ limit: 100 }),
        ]);
        setSaved([
          ...(fronter.items || []).map(s => ({ id: s.id, name: s.name, content: s.content || '', tag: 'Fronter' })),
          ...(dialer.items || []).map(s => ({ id: s.id, name: s.name, content: s.content || '', tag: 'Dialer' })),
        ]);
      } catch { setSaved([]); }
    })();
  }, []);

  const picked = saved.find(s => s.id === pickedId);
  const sourceText = mode === 'paste' ? pasteText : mode === 'saved' ? (picked?.content || '') : fileText;
  const sourceLabel = mode === 'saved' ? (picked?.name || 'saved script') : mode === 'paste' ? 'pasted script' : (fileName || 'uploaded script');
  const ready = mode === 'upload' ? Boolean(fileText || fileUri) : Boolean(sourceText.trim());
  const hasContent = Boolean(proposal && (
    proposal.scripts.length || proposal.objections.length ||
    proposal.commonQuestions.length || proposal.kbEntries.length ||
    Object.keys(proposal.agentConfig || {}).length
  ));

  const onFile = async (file) => {
    if (!file) return;
    setError('');
    setResult(null);
    setFileName(file.name);
    setMediaType(file.type || '');
    const isText = (file.type || '').startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name);
    const isDoc = file.type === 'application/pdf' || (file.type || '').startsWith('image/');
    try {
      if (isText) {
        setFileText(await file.text());
        setFileUri('');
        return;
      }
      setFileText('');
      if (!isDoc) {
        setFileUri('');
        setError('That file type is not supported — load a PDF, an image, or a .txt / .md file.');
        return;
      }
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      const uri = res?.file_uri || res?.data?.file_uri || '';
      if (!uri) throw new Error('Upload failed — try again.');
      setFileUri(uri);
    } catch (e) {
      setError(e?.message || 'Could not read that file.');
    }
  };

  const run = async () => {
    if (!ready) { setError('Add a script first — upload a file, pick a saved one, or paste it.'); return; }
    setRunning(true);
    setError('');
    setResult(null);

    const next = { scripts: [], agentConfig: {}, objections: [], commonQuestions: [], kbEntries: [], sourceLabel };
    setProposal({ ...next });

    const queue = [];
    if (!sourceText.trim() && fileUri) queue.push({ key: 'extract', label: 'Reading the uploaded script' });
    SECTIONS.forEach(s => queue.push(s));
    const initial = {};
    queue.forEach(q => { initial[q.key] = { label: q.label, status: 'pending', count: null }; });
    setSteps(initial);

    let text = sourceText;
    for (const q of queue) {
      setSteps(prev => ({ ...prev, [q.key]: { ...prev[q.key], status: 'running' } }));
      try {
        const res = await base44.functions.invoke('aiScriptBuilder', {
          action: 'generate', section: q.key, sourceText: text, sourceLabel, fileUri, mediaType,
          sessionUserId, sessionToken,
        });
        const data = res?.data || res;
        if (data?.error) throw new Error(data.error);

        if (q.key === 'extract') {
          text = String(data?.text || '');
          if (!text) throw new Error('Could not read the uploaded document.');
        } else {
          const payload = data?.data || {};
          if (q.key === 'scripts') next.scripts = payload.scripts || [];
          if (q.key === 'agent_config') next.agentConfig = payload;
          if (q.key === 'objections') next.objections = payload.objections || [];
          if (q.key === 'common_questions') next.commonQuestions = payload.entries || [];
          if (q.key === 'main_kb') next.kbEntries = payload.entries || [];
          setProposal({ ...next });
        }
        setSteps(prev => ({ ...prev, [q.key]: { ...prev[q.key], status: 'done', count: countOf(q.key, data) } }));
      } catch (e) {
        setSteps(prev => ({ ...prev, [q.key]: { ...prev[q.key], status: 'error', error: e?.message || String(e) } }));
      }
    }
    setRunning(false);
  };

  const apply = async () => {
    if (!hasContent) return;
    setApplying(true);
    setError('');
    try {
      const res = await base44.functions.invoke('aiScriptBuilder', {
        action: 'apply', proposal, sourceLabel, sessionUserId, sessionToken,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
    } catch (e) {
      setError(e?.message || String(e));
    }
    setApplying(false);
  };

  return (
    <div>
      <div style={head}>🧠 AI Script Builder — rebuild the whole script system from one script</div>

      {/* 1 · Source */}
      <div style={card}>
        <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>1 · The new fronter script</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button style={modeBtn(mode === 'upload')} onClick={() => setMode('upload')}>📎 Load a file</button>
          <button style={modeBtn(mode === 'saved')} onClick={() => setMode('saved')}>📂 Saved script</button>
          <button style={modeBtn(mode === 'paste')} onClick={() => setMode('paste')}>✍️ Paste script</button>
        </div>

        {mode === 'upload' && (
          <div>
            <input type="file" accept=".txt,.md,.csv,.pdf,.png,.jpg,.jpeg" onChange={e => onFile(e.target.files?.[0])} style={{ ...inp, padding: '8px 10px' }} />
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px' }}>
              Text files are read straight in. PDFs and images are uploaded (stored privately) and read by the AI from a temporary link. Word files need converting to PDF or text first.
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
                <option key={s.id} value={s.id}>{s.tag} — {s.name} ({((s.content || '').length).toLocaleString()} chars)</option>
              ))}
            </select>
          )
        )}

        {mode === 'paste' && (
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={10}
            placeholder="Paste the full new fronter script here…"
            style={{ ...inp, lineHeight: 1.5 }}
          />
        )}
      </div>

      {/* 2 · Build */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>2 · Build every section</div>
          <button
            onClick={run}
            disabled={running || !ready}
            style={{ background: running || !ready ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${PURPLE},#8b5cf6)`, color: running || !ready ? '#6b7280' : '#0a0f1e', border: 'none', borderRadius: '4px', padding: '9px 18px', cursor: running || !ready ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {running ? '⏳ Building…' : '🪄 Build with AI'}
          </button>
        </div>

        {steps && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(steps).map(([key, s]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ color: STEP_COLORS[s.status], fontWeight: 'bold', width: '14px' }}>{STEP_ICONS[s.status]}</span>
                <span style={{ color: s.status === 'pending' ? '#6b7280' : '#e8e0d0', fontFamily: 'Georgia, serif' }}>{s.label}</span>
                {s.count && <span style={{ color: GOLD, fontSize: '11px' }}>— {s.count}</span>}
                {s.error && <span style={{ color: RED, fontSize: '11px' }}>— {s.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3 · Review + apply */}
      <AIScriptProposalPreview proposal={proposal} />

      {hasContent && !result && (
        <button
          onClick={apply}
          disabled={applying}
          style={{ background: applying ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${GOLD},#059669)`, color: applying ? '#6b7280' : '#0a0f1e', border: 'none', borderRadius: '4px', padding: '12px 22px', cursor: applying ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', marginBottom: '14px' }}
        >
          {applying ? '⏳ Applying…' : '✅ Apply all changes'}
        </button>
      )}

      {result && (
        <div style={{ ...card, borderColor: `${GOLD}44` }}>
          <div style={head}>✅ Applied</div>
          <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.8, fontFamily: 'Georgia, serif' }}>
            <div>Fronter scripts — {result.scripts.created} created, {result.scripts.updated} updated</div>
            <div>AI agent config — {result.agentConfig ? 'updated (outbound + inbound)' : 'no changes'}</div>
            <div>Rebuttals — {result.objections.created} created, {result.objections.updated} updated</div>
            <div>Common questions — {result.commonQuestions.created} created, {result.commonQuestions.updated} updated</div>
            <div>Main knowledge base — {result.kbEntries.created} created, {result.kbEntries.updated} updated</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: `${RED}12`, border: `1px solid ${RED}44`, borderRadius: '6px', padding: '12px 14px', color: RED, fontSize: '12px' }}>⚠ {error}</div>
      )}
    </div>
  );
}