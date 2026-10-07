/**
 * BobBrainScanner.jsx — Sophisticated AI chatbot inside BOB's Brain.
 *
 *  Three modes, all from one input box:
 *   1. Regular chat — ask BOB what it knows (answers from KB + transcripts).
 *   2. "forget: <topic>" / "remember: <Q> | <A>" — manage KB directly.
 *   3. SCAN mode — instruct BOB to run through all recorded calls looking for
 *      specific things (e.g. "Find all references to credit report or score").
 *      BOB catalogs every match as a confidence-building Q&A pair, then you
 *      can ✨ Enhance (buff up the language without changing facts) and
 *      📚 Push to KB (merge into a similar existing answer, or keep multiple).
 */
import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { findDuplicates } from './bobBrainUtils';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';
const PINK = '#f472b6';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';

const SCAN_TRIGGER = /^(scan\s*:|find all|look for|scan through|catalog|search all calls|go through the calls|run through the calls)/i;

export default function BobBrainScanner({ kbEntries, transcripts, onKBChanged }) {
  const [messages, setMessages] = useState([{
    role: 'bob',
    text: "I'm BOB's brain scanner. Tell me what to hunt for across all your recorded calls — e.g. \"Find all references to credit report or score so I can build confidence-building questions about credit utilization and closed accounts.\" I'll catalog every match, then you can enhance and push the best ones to the knowledge base.",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState(null); // { instruction, items: [{id, topic, question, answer, snippet, source, enhanced, pushed, dupMatches, mergeChoice}] }
  const [enhancing, setEnhancing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const scrollRef = useRef(null);
  const catIdRef = useRef(0);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading, catalog]);

  const send = async () => {
    const msg = (input || '').trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    const forgetMatch = msg.match(/^forget\s*:\s*(.+)/i);
    const rememberMatch = msg.match(/^remember\s*:\s*(.+?)\s*\|\s*(.+)$/i);

    try {
      if (forgetMatch) {
        const query = forgetMatch[1].trim().toLowerCase();
        const matches = kbEntries.filter(e => (e.question || '').toLowerCase().includes(query) || (e.answer || '').toLowerCase().includes(query)).slice(0, 10);
        setMessages(prev => [...prev, matches.length === 0
          ? { role: 'bob', text: `I don't have any entries matching "${forgetMatch[1].trim()}" to forget.` }
          : { role: 'bob', text: `Found ${matches.length} entries matching "${forgetMatch[1].trim()}". Click 🗑 to forget:`, deletable: matches }]);
      } else if (rememberMatch) {
        await base44.entities.KnowledgeBase.create({ question: rememberMatch[1].trim(), answer: rememberMatch[2].trim(), category: 'debt_faq', kbName: 'Debt Settlement', source: 'BobBrain Chat', created_date: new Date().toISOString() });
        setMessages(prev => [...prev, { role: 'bob', text: `✓ Remembered: "${rememberMatch[1].trim()}"` }]);
        onKBChanged?.();
      } else if (SCAN_TRIGGER.test(msg) || /credit|objection|hardship|closing|enroll|bankruptcy|interest|payment|score|utilization/i.test(msg)) {
        await runScan(msg);
      } else {
        await regularChat(msg);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bob', text: '⚠ ' + (e?.message || String(e)) }]);
    }
    setLoading(false);
  };

  const regularChat = async (msg) => {
    const ctx = kbEntries.slice(0, 60).map(e => `Q: ${e.question}\nA: ${(e.answer || '').slice(0, 300)}`).join('\n');
    const transcriptCtx = transcripts.slice(0, 8).map(t => `[${t.sourceName}]: ${(t.transcriptText || '').slice(0, 400)}`).join('\n---\n');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are BOB, a debt-settlement sales training AI brain. Answer conversationally based ONLY on the knowledge base and transcripts below. Be concise (2-4 sentences). If you don't know, say so.

KNOWLEDGE BASE (${kbEntries.length} entries):
${ctx}

RECENT CALL TRANSCRIPTS (${transcripts.length}):
${transcriptCtx || 'None yet'}

TRAINER: ${msg}`,
    });
    setMessages(prev => [...prev, { role: 'bob', text: (typeof res === 'string' ? res : (res?.data || res)) || '...' }]);
  };

  // ── SCAN: run through all transcripts looking for what the trainer asked ──
  const runScan = async (instruction) => {
    if (transcripts.length === 0) {
      setMessages(prev => [...prev, { role: 'bob', text: "I don't have any recorded calls in my brain yet. Upload some MP3s first, then I can scan them." }]);
      return;
    }
    setMessages(prev => [...prev, { role: 'bob', text: `🔍 Scanning ${transcripts.length} recorded calls for: "${instruction}"…` }]);

    // Build transcript context — cap total size to keep the LLM call reliable
    const MAX_TOTAL = 80000;
    let total = 0;
    const parts = [];
    for (const t of transcripts) {
      const text = (t.transcriptText || '').slice(0, 6000);
      if (total + text.length > MAX_TOTAL) { parts.push(`[${t.sourceName}]: ${text.slice(0, Math.max(0, MAX_TOTAL - total))}`); break; }
      parts.push(`[${t.sourceName}]: ${text}`);
      total += text.length;
    }
    const transcriptContext = parts.join('\n\n---\n\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are BOB's brain scanner. The trainer wants you to scan ALL recorded call transcripts below for specific information and catalog every relevant reference as a confidence-building Q&A pair.

TRAINER INSTRUCTION:
${instruction}

TRANSCRIPTS:
${transcriptContext}

For EVERY relevant reference found across the transcripts:
1. Extract the exact snippet (quote) from the transcript where the topic is discussed
2. Note which transcript/source it came from
3. Generate a confidence-building QUESTION and ANSWER pair based on what was actually said — the answer should be something an agent can read verbatim to a customer to build confidence, show empathy, and control the call flow.

Return JSON: { "items": [{ "topic": "short label", "question": "the question", "answer": "the answer", "snippet": "exact quote from transcript", "source": "transcript name" }] }

Rules:
- Only include references that ACTUALLY appear in the transcripts — do NOT invent anything.
- Find as many relevant references as exist. Aim for thoroughness.
- Each answer should be confident, empathetic, and guide the customer.`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                question: { type: 'string' },
                answer: { type: 'string' },
                snippet: { type: 'string' },
                source: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const items = (result?.items || result?.data?.items || []).map((it, i) => ({
      id: `cat-${++catIdRef.current}`,
      topic: it.topic || 'Reference',
      question: it.question || '',
      answer: it.answer || '',
      snippet: it.snippet || '',
      source: it.source || '',
      enhanced: false,
      pushed: false,
      dupMatches: null,
      mergeChoice: null,
    }));

    if (items.length === 0) {
      setMessages(prev => [...prev, { role: 'bob', text: `I scanned all ${transcripts.length} calls but didn't find any references matching that. Try rephrasing, or upload more calls that cover the topic.` }]);
      return;
    }

    setCatalog({ instruction, items });
    setMessages(prev => [...prev, { role: 'bob', text: `✓ Cataloged ${items.length} reference${items.length !== 1 ? 's' : ''} from the calls. Review them below — click ✨ Enhance to buff up the language, then 📚 Push to KB to merge or keep each one.` }]);
  };

  // ── ENHANCE: buff up answers without changing facts ──
  const enhanceItem = async (id) => {
    const item = catalog?.items.find(i => i.id === id);
    if (!item || item.enhanced) return;
    setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, enhancing: true } : i) });
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are enhancing a debt settlement knowledge base answer that an agent reads verbatim to customers. Rewrite the answer so it:
- Uses strong, confident language that conveys expertise and ability
- Shows genuine empathy for the customer's difficult financial situation
- Controls the flow of the call — guides the customer and ends with an engaging question when appropriate
- Does NOT change any facts, numbers, program terms, creditor names, legal/regulatory details, or the core meaning
- Is conversational and natural to read aloud

Original question: ${item.question}
Original answer: ${item.answer}

Return ONLY the enhanced answer text, nothing else.`,
      });
      const enhanced = (typeof res === 'string' ? res : (res?.data || res)) || item.answer;
      setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, answer: enhanced, enhanced: true, enhancing: false } : i) });
    } catch (e) {
      setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, enhancing: false } : i) });
    }
  };

  const enhanceAll = async () => {
    if (!catalog || enhancing) return;
    setEnhancing(true);
    const toDo = catalog.items.filter(i => !i.enhanced);
    // Limited concurrency to avoid timeouts
    const queue = [...toDo];
    const concurrency = 3;
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        await enhanceItem(item.id);
      }
    });
    await Promise.all(workers);
    setEnhancing(false);
  };

  // ── PUSH TO KB: merge into existing, or keep multiple ──
  const pushItem = async (id, choice) => {
    const item = catalog?.items.find(i => i.id === id);
    if (!item || item.pushed) return;
    setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, pushing: true } : i) });
    try {
      const matches = findDuplicates({ question: item.question, answer: item.answer }, kbEntries);
      if (matches.length === 0 || choice === 'new') {
        // No duplicate — create a fresh entry
        await base44.entities.KnowledgeBase.create({ question: item.question, answer: item.answer, category: 'debt_call', kbName: 'Debt Settlement', source: `BobBrain Scan: ${item.source || 'transcript'}`, created_date: new Date().toISOString() });
        setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, pushed: true, pushing: false, dupMatches: null } : i) });
      } else if (choice === 'merge') {
        // Merge: combine the new answer with the best-matching existing answer into one enhanced answer
        const existing = matches[0].existing;
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are merging two debt settlement knowledge base answers for the same question into one superior answer. Combine the facts from both. Keep all facts, numbers, and program details from both. The merged answer should be confident, empathetic, and flow-controlling — something an agent reads verbatim.

Question: ${existing.question || item.question}
Answer A (existing): ${existing.answer || ''}
Answer B (new): ${item.answer}

Return ONLY the merged answer text.`,
        });
        const merged = (typeof res === 'string' ? res : (res?.data || res)) || item.answer;
        const existingAnswers = (() => { try { const a = JSON.parse(existing.answersJson || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } })();
        const allAnswers = [merged, ...existingAnswers.filter(a => a && a !== merged)];
        await base44.entities.KnowledgeBase.update(existing.id, { answer: merged, answersJson: JSON.stringify(allAnswers) });
        setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, pushed: true, pushing: false, dupMatches: null, mergeChoice: 'merge' } : i) });
      } else if (choice === 'keep') {
        // Keep multiple: add the new answer as an additional answer on the existing entry
        const existing = matches[0].existing;
        const existingAnswers = (() => { try { const a = JSON.parse(existing.answersJson || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } })();
        const allAnswers = [...existingAnswers];
        if (existing.answer && !allAnswers.includes(existing.answer)) allAnswers.unshift(existing.answer);
        if (!allAnswers.includes(item.answer)) allAnswers.push(item.answer);
        await base44.entities.KnowledgeBase.update(existing.id, { answersJson: JSON.stringify(allAnswers) });
        setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, pushed: true, pushing: false, dupMatches: null, mergeChoice: 'keep' } : i) });
      } else {
        // Show the merge options
        setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, pushing: false, dupMatches: matches } : i) });
      }
      onKBChanged?.();
    } catch (e) {
      setCatalog(prev => prev && { ...prev, items: prev.items.map(i => i.id === id ? { ...i, pushing: false } : i) });
      setMessages(prev => [...prev, { role: 'bob', text: '⚠ Push failed: ' + (e?.message || String(e)) }]);
    }
  };

  const pushAll = async () => {
    if (!catalog || pushing) return;
    setPushing(true);
    for (const item of catalog.items) {
      if (item.pushed) continue;
      await pushItem(item.id, null);
      // If duplicates were found (pushItem showed merge options), auto-pick "keep" for bulk push
      const updated = (await new Promise(r => setCatalog(prev => { r(prev); return prev; })))?.items.find(i => i.id === item.id);
      if (updated?.dupMatches) await pushItem(item.id, 'keep');
    }
    setPushing(false);
  };

  const deleteEntry = async (id) => {
    try {
      await base44.entities.KnowledgeBase.delete(id);
      setMessages(prev => prev.map(m => m.deletable ? { ...m, deletable: m.deletable.filter(x => x.id !== id) } : m));
      onKBChanged?.();
    } catch (e) { setMessages(prev => [...prev, { role: 'bob', text: '⚠ Could not delete: ' + (e?.message || String(e)) }]); }
  };

  const enhancedCount = catalog?.items.filter(i => i.enhanced).length || 0;
  const pushedCount = catalog?.items.filter(i => i.pushed).length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '420px' }}>
      {/* Chat messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
            <div style={{
              background: m.role === 'user' ? 'rgba(16,185,129,0.12)' : 'rgba(167,139,250,0.08)',
              border: `1px solid ${m.role === 'user' ? 'rgba(16,185,129,0.25)' : 'rgba(167,139,250,0.2)'}`,
              borderRadius: '8px', padding: '10px 14px',
              color: m.role === 'user' ? GOLD : '#c4cdd8', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>{m.text}</div>
            {m.deletable && m.deletable.length > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {m.deletable.map(d => (
                  <div key={d.id} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 8px' }}>
                    <button onClick={() => deleteEntry(d.id)} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>🗑</button>
                    <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                      <span style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{d.question}</span>
                      <span style={{ color: '#8a9ab8' }}> — {(d.answer || '').slice(0, 120)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', color: PURPLE, fontSize: '11px', fontStyle: 'italic' }}>BOB is thinking…</div>}
      </div>

      {/* Catalog panel — scan results with enhance + push-to-KB */}
      {catalog && (
        <div style={{ borderTop: `2px solid ${PURPLE}44`, maxHeight: '340px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '8px 12px', background: 'rgba(167,139,250,0.08)', borderBottom: '1px solid rgba(167,139,250,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ color: PURPLE, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📂 Catalog — {catalog.items.length} references · {enhancedCount} enhanced · {pushedCount} pushed</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={enhanceAll} disabled={enhancing} title="Buff up every answer with confident, empathetic, flow-controlling language (facts unchanged)" style={{ background: enhancing ? 'rgba(167,139,250,0.15)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: enhancing ? PURPLE : '#fff', border: 'none', borderRadius: '4px', padding: '5px 12px', cursor: enhancing ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{enhancing ? `⏳ ${enhancedCount}/${catalog.items.length}` : '✨ Enhance All'}</button>
              <button onClick={pushAll} disabled={pushing} title="Push all to the knowledge base — new ones created, duplicates get both answers kept" style={{ background: pushing ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg,#10b981,#22c55e)', color: pushing ? GOLD : DARK, border: 'none', borderRadius: '4px', padding: '5px 12px', cursor: pushing ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{pushing ? `⏳ ${pushedCount}/${catalog.items.length}` : '📚 Push All'}</button>
              <button onClick={() => setCatalog(null)} title="Clear the catalog" style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {catalog.items.map(item => (
              <CatalogCard key={item.id} item={item} onEnhance={enhanceItem} onPush={pushItem} />
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder='Instruct BOB… e.g. "Find all references to credit report or score"  ·  or: forget: <topic>  /  remember: <Q> | <A>'
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 18px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
      </div>
    </div>
  );
}

// ─── Catalog card — one scanned reference with enhance + push actions ──────
function CatalogCard({ item, onEnhance, onPush }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${item.pushed ? 'rgba(16,185,129,0.3)' : item.enhanced ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '5px', padding: '10px 12px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '1px 7px', borderRadius: '3px', background: 'rgba(96,165,250,0.15)', color: BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.topic}</span>
          {item.enhanced && <span style={{ padding: '1px 7px', borderRadius: '3px', background: 'rgba(167,139,250,0.15)', color: PURPLE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>✨ Enhanced</span>}
          {item.pushed && <span style={{ padding: '1px 7px', borderRadius: '3px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>✓ In KB</span>}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={() => onEnhance(item.id)} disabled={item.enhanced || item.enhancing} title="Buff up the language (facts unchanged)" style={{ background: item.enhanced ? 'rgba(167,139,250,0.1)' : 'rgba(167,139,250,0.18)', color: item.enhanced ? '#6b7280' : PURPLE, border: `1px solid ${item.enhanced ? 'rgba(167,139,250,0.15)' : 'rgba(167,139,250,0.35)'}`, borderRadius: '3px', padding: '3px 9px', cursor: item.enhanced || item.enhancing ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{item.enhancing ? '⏳' : item.enhanced ? '✓' : '✨ Enhance'}</button>
          <button onClick={() => onPush(item.id, null)} disabled={item.pushed || item.pushing} title="Push to the knowledge base" style={{ background: item.pushed ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.18)', color: item.pushed ? '#6b7280' : GOLD, border: `1px solid ${item.pushed ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.35)'}`, borderRadius: '3px', padding: '3px 9px', cursor: item.pushed || item.pushing ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{item.pushing ? '⏳' : item.pushed ? '✓' : '📚 Push'}</button>
        </div>
      </div>

      {/* Question + answer */}
      <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{item.question || '(no question)'}</div>
      <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{item.answer || '(no answer)'}</div>

      {/* Source snippet */}
      {item.snippet && (
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '3px', padding: '6px 8px', marginBottom: '6px' }}>
          <div style={{ color: BLUE, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>💬 From {item.source || 'transcript'}</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', fontStyle: 'italic', lineHeight: 1.4 }}>"{item.snippet}"</div>
        </div>
      )}

      {/* Merge options — shown when a duplicate KB entry exists */}
      {item.dupMatches && item.dupMatches.length > 0 && !item.pushed && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px', padding: '8px 10px' }}>
          <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold', marginBottom: '6px' }}>⚠ Similar KB entry found — how do you want to handle it?</div>
          {item.dupMatches.slice(0, 2).map((m, i) => (
            <div key={i} style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: i < Math.min(1, item.dupMatches.length - 1) ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold' }}>{m.existing.question}</div>
              <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.4 }}>{(m.existing.answer || '').slice(0, 160)}{m.existing.answer && m.existing.answer.length > 160 ? '…' : ''}</div>
              <div style={{ color: '#6b7280', fontSize: '9px' }}>{Math.round(m.similarity * 100)}% match</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => onPush(item.id, 'merge')} title="Combine both answers into one enhanced answer on the existing entry" style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '3px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>🔀 Merge into one</button>
            <button onClick={() => onPush(item.id, 'keep')} title="Keep both answers on the existing entry (agent sees multiple options)" style={{ background: 'rgba(96,165,250,0.18)', color: BLUE, border: '1px solid rgba(96,165,250,0.35)', borderRadius: '3px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📚 Keep multiple</button>
            <button onClick={() => onPush(item.id, 'new')} title="Create a brand new separate KB entry" style={{ background: 'rgba(16,185,129,0.18)', color: GOLD, border: '1px solid rgba(16,185,129,0.35)', borderRadius: '3px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>➕ Create new</button>
          </div>
        </div>
      )}
    </div>
  );
}