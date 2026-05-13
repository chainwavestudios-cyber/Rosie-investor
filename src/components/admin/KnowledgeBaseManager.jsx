import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };

const DEFAULT_KB = '__default__';

export default function KnowledgeBaseManager({ IntentEngineTuner, CoachRulesTuner }) {
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [section, setSection]       = useState('entries');
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('all');

  // ── KB Management ──────────────────────────────────────────────────────
  const [kbNames, setKbNames]           = useState([]); // list of kbName strings
  const [selectedKb, setSelectedKb]     = useState(DEFAULT_KB); // currently viewed KB
  const [newKbName, setNewKbName]       = useState('');
  const [creatingKb, setCreatingKb]     = useState(false);

  const [q, setQ]       = useState('');
  const [a, setA]       = useState('');
  const [cat, setCat]   = useState('faq');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const fileRef = useRef(null);
  const [scrapeUrl, setScrapeUrl]   = useState('');
  const [scraping, setScraping]     = useState(false);
  const [scrapeMsg, setScrapeMsg]   = useState('');
  const [deleting, setDeleting]     = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editQ, setEditQ]           = useState('');
  const [editA, setEditA]           = useState('');
  const [editCat, setEditCat]       = useState('faq');
  const [editTags, setEditTags]     = useState('');
  const [editKb, setEditKb]         = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditQ(e.question||'');
    setEditA(e.answer||'');
    setEditCat(e.category||'faq');
    setEditTags(e.tags||'');
    setEditKb(e.kbName || DEFAULT_KB);
  };

  const saveEdit = async () => {
    if (!editQ.trim() || !editA.trim()) return;
    setEditSaving(true);
    try {
      await base44.entities.KnowledgeBase.update(editingId, {
        question: editQ.trim(),
        answer: editA.trim(),
        category: editCat,
        tags: editTags.trim(),
        kbName: editKb === DEFAULT_KB ? '' : editKb,
      });
      setEditingId(null);
      await load();
    } catch (e) { alert('Save failed: ' + e.message); }
    setEditSaving(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 1000);
      setEntries(all || []);
      // Derive unique KB names from entries
      const names = [...new Set((all || []).map(e => e.kbName || '').filter(Boolean))];
      setKbNames(names);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Create new KB ────────────────────────────────────────────────────────
  const createKb = () => {
    const name = newKbName.trim();
    if (!name || kbNames.includes(name)) return;
    setKbNames(prev => [...prev, name]);
    setSelectedKb(name);
    setNewKbName('');
    setCreatingKb(false);
  };

  const deleteKb = async (name) => {
    if (!window.confirm(`Delete knowledge base "${name}" and all its entries? This cannot be undone.`)) return;
    setLoading(true);
    const toDelete = entries.filter(e => (e.kbName || DEFAULT_KB) === name);
    for (const e of toDelete) { try { await base44.entities.KnowledgeBase.delete(e.id); } catch {} }
    setKbNames(prev => prev.filter(n => n !== name));
    if (selectedKb === name) setSelectedKb(DEFAULT_KB);
    await load();
  };

  // ── Helpers: get kbName to save ──────────────────────────────────────────
  const activeKbName = selectedKb === DEFAULT_KB ? '' : selectedKb;

  const addManual = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.KnowledgeBase.create({
        question: q.trim(), answer: a.trim(),
        category: cat, tags: tags.trim(),
        source: 'manual', kbName: activeKbName,
      });
      setQ(''); setA(''); setTags('');
      setSaveMsg('✓ Entry added');
      await load();
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setUploading(true); setUploadMsg(''); setUploadProgress('Reading file…');
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('Read failed'));
        r.readAsDataURL(file);
      });
      setUploadProgress(`Processing "${file.name}" with AI — this may take 30-60s for large documents…`);
      const result = await base44.functions.invoke('kbExtractFile', { fileName: file.name, fileType: file.type, base64 });
      const extracted = result?.data?.entries || [];
      setUploadProgress(`Saving ${extracted.length} entries…`);
      let saved = 0;
      for (const entry of extracted) {
        try {
          await base44.entities.KnowledgeBase.create({
            question: entry.question, answer: entry.answer,
            category: entry.category || 'faq',
            source: file.name, tags: entry.tags || '',
            kbName: activeKbName,
          });
          saved++;
        } catch {}
      }
      setUploadMsg(`✓ Extracted and saved ${saved} entries from "${file.name}"`);
      await load();
    } catch (e) { setUploadMsg('Error: ' + e.message); }
    setUploading(false); setUploadProgress('');
    setTimeout(() => setUploadMsg(''), 6000);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true); setScrapeMsg('Fetching and analyzing page…');
    try {
      const result = await base44.functions.invoke('kbScrapeUrl', { url: scrapeUrl.trim() });
      const extracted = result?.data?.entries || [];
      let saved = 0;
      for (const entry of extracted) {
        try {
          await base44.entities.KnowledgeBase.create({
            question: entry.question, answer: entry.answer,
            category: entry.category || 'faq',
            source: scrapeUrl.trim(), tags: entry.tags || '',
            kbName: activeKbName,
          });
          saved++;
        } catch {}
      }
      setScrapeMsg(`✓ Scraped and saved ${saved} entries from ${scrapeUrl}`);
      setScrapeUrl('');
      await load();
    } catch (e) { setScrapeMsg('Error: ' + e.message); }
    setScraping(false);
    setTimeout(() => setScrapeMsg(''), 6000);
  };

  const deleteEntry = async (id) => {
    setDeleting(id);
    try { await base44.entities.KnowledgeBase.delete(id); await load(); } catch {}
    setDeleting(null);
  };

  const deleteAll = async () => {
    if (!window.confirm('Delete ALL knowledge base entries? This cannot be undone.')) return;
    setLoading(true);
    for (const e of entries) { try { await base44.entities.KnowledgeBase.delete(e.id); } catch {} }
    await load();
  };

  const CATEGORIES = ['all','faq','financials','product','team','market','legal','process','risk','company','pricing','manual','raw_document'];
  const CAT_COLORS = { faq:'#60a5fa', financials:'#4ade80', product:'#a78bfa', team:'#f59e0b', market:'#f59e0b', legal:'#ef4444', process:'#8a9ab8', risk:'#ef4444', company:'#60a5fa', pricing:'#4ade80', manual:GOLD, raw_document:'#4a5568' };

  // Filter entries by selected KB then by category/search
  const kbFiltered = entries.filter(e => {
    if (selectedKb === DEFAULT_KB) return !e.kbName || e.kbName === '';
    return (e.kbName || '') === selectedKb;
  });
  const filtered = kbFiltered
    .filter(e => filterCat === 'all' || e.category === filterCat)
    .filter(e => !search || `${e.question} ${e.answer} ${e.tags || ''}`.toLowerCase().includes(search.toLowerCase()));

  const sources = [...new Set(kbFiltered.filter(e => e.source).map(e => e.source))];
  const inp2 = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box' };
  const ta2  = { ...inp2, resize:'vertical', minHeight:'80px' };

  // All KB tabs including default
  const allKbs = [{ id: DEFAULT_KB, label: 'Default KB' }, ...kbNames.map(n => ({ id: n, label: n }))];
  const totalEntries = entries.filter(e => selectedKb === DEFAULT_KB ? !e.kbName || e.kbName === '' : (e.kbName || '') === selectedKb).length;

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'22px', fontWeight:'normal' }}>🧠 Knowledge Base</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>
            {entries.filter(e => e.category !== 'raw_document').length} total entries across {allKbs.length} knowledge base{allKbs.length !== 1 ? 's' : ''} · Used by <strong style={{ color:GOLD }}>Rosie AI</strong> and the <strong style={{ color:'#a78bfa' }}>Live Call Assistant</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>↻ Refresh</button>
          <button onClick={deleteAll} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>🗑 Clear All</button>
        </div>
      </div>

      {/* ── KB Selector Bar ── */}
      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'14px 16px', marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
          <span style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', flexShrink:0 }}>Knowledge Base:</span>

          {/* KB tabs */}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', flex:1 }}>
            {allKbs.map(kb => {
              const count = entries.filter(e => kb.id === DEFAULT_KB ? !e.kbName || e.kbName === '' : (e.kbName || '') === kb.id).length;
              const isActive = selectedKb === kb.id;
              return (
                <div key={kb.id} style={{ display:'flex', alignItems:'center', gap:'0' }}>
                  <button
                    onClick={() => setSelectedKb(kb.id)}
                    style={{
                      background: isActive ? 'linear-gradient(135deg,rgba(184,147,58,0.25),rgba(184,147,58,0.15))' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isActive ? GOLD : 'rgba(255,255,255,0.1)'}`,
                      borderRight: kb.id !== DEFAULT_KB ? 'none' : undefined,
                      borderRadius: kb.id !== DEFAULT_KB ? '4px 0 0 4px' : '4px',
                      color: isActive ? GOLD : '#6b7280',
                      padding: '5px 12px', cursor: 'pointer', fontSize: '11px',
                      fontWeight: isActive ? 'bold' : 'normal',
                      letterSpacing: '0.3px',
                    }}>
                    {kb.label} <span style={{ color: isActive ? GOLD : '#4a5568', marginLeft:'4px', fontSize:'10px' }}>({count})</span>
                  </button>
                  {kb.id !== DEFAULT_KB && (
                    <button
                      onClick={() => deleteKb(kb.id)}
                      title={`Delete "${kb.label}" knowledge base`}
                      style={{
                        background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isActive ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '0 4px 4px 0',
                        color: '#ef444466', cursor: 'pointer',
                        padding: '5px 7px', fontSize: '12px', lineHeight: 1,
                      }}>
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Create new KB */}
          {creatingKb ? (
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <input
                value={newKbName}
                onChange={e => setNewKbName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createKb(); if (e.key === 'Escape') setCreatingKb(false); }}
                placeholder="KB name…"
                autoFocus
                style={{ background:'rgba(255,255,255,0.07)', border:`1px solid ${GOLD}`, borderRadius:'4px', padding:'5px 10px', color:'#e8e0d0', fontSize:'12px', outline:'none', width:'140px' }}
              />
              <button onClick={createKb} disabled={!newKbName.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>Create</button>
              <button onClick={() => setCreatingKb(false)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#6b7280', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingKb(true)}
              style={{ background:'rgba(184,147,58,0.08)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
              + New KB
            </button>
          )}
        </div>

        {/* Active KB info */}
        <div style={{ marginTop:'10px', color:'#4a5568', fontSize:'11px' }}>
          Viewing: <strong style={{ color:'#8a9ab8' }}>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong> — {totalEntries} entries.
          {selectedKb !== DEFAULT_KB && (
            <span style={{ marginLeft:'8px', color:'#4a5568' }}>
              Agents can select this KB in the Live Call Assistant to focus AI responses.
            </span>
          )}
        </div>
      </div>

      {/* ── Section Tabs ── */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:'28px' }}>
        {[['entries','📋 Entries'],['add','✏️ Add Q&A'],['upload','📄 Upload Document'],['scrape','🌐 Scrape Website'],['intent','🦆 Intent Engine'],['coach','🎯 Coach Rules']].map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{ background:'none', border:'none', borderBottom:section===id?`2px solid ${GOLD}`:'2px solid transparent', color:section===id?GOLD:'#6b7280', padding:'10px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Entries ── */}
      {section === 'entries' && (
        <div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…" style={{ ...inp2, width:'260px', padding:'8px 12px', fontSize:'12px' }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inp2, width:'160px', padding:'8px 12px', fontSize:'12px', cursor:'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c==='all'?`All Categories (${kbFiltered.length})`:`${c} (${kbFiltered.filter(e=>e.category===c).length})`}</option>)}
            </select>
          </div>
          {loading && <p style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</p>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px', color:'#4a5568' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>🧠</div>
              <p>No entries in <strong>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong> yet. Upload a document, scrape a URL, or add Q&A manually.</p>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filtered.slice(0, 100).map(e => (
              <div key={e.id} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${editingId===e.id?'rgba(184,147,58,0.4)':'rgba(255,255,255,0.07)'}`, borderRadius:'4px', padding:'12px 16px' }}>
                {editingId === e.id ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    <input value={editQ} onChange={ev => setEditQ(ev.target.value)} placeholder="Question" style={{ ...inp2, fontSize:'13px', fontWeight:'bold' }} />
                    <textarea value={editA} onChange={ev => setEditA(ev.target.value)} placeholder="Answer" rows={4} style={{ ...ta2, fontSize:'13px' }} />
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <select value={editCat} onChange={ev => setEditCat(ev.target.value)} style={{ ...inp2, width:'140px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>
                        {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input value={editTags} onChange={ev => setEditTags(ev.target.value)} placeholder="Tags" style={{ ...inp2, flex:1, padding:'6px 10px', fontSize:'12px' }} />
                      <select value={editKb} onChange={ev => setEditKb(ev.target.value)} style={{ ...inp2, width:'160px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>
                        <option value={DEFAULT_KB}>Default KB</option>
                        {kbNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={saveEdit} disabled={editSaving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'6px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', whiteSpace:'nowrap' }}>{editSaving ? '⏳' : '✓ Save'}</button>
                      <button onClick={() => setEditingId(null)} style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:'14px', alignItems:'flex-start' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'4px', flexWrap:'wrap' }}>
                        {e.category && <span style={{ background:`${CAT_COLORS[e.category]||'#6b7280'}18`, color:CAT_COLORS[e.category]||'#6b7280', border:`1px solid ${CAT_COLORS[e.category]||'#6b7280'}44`, borderRadius:'10px', padding:'1px 8px', fontSize:'10px', letterSpacing:'0.5px', textTransform:'uppercase', flexShrink:0 }}>{e.category}</span>}
                        {e.kbName && <span style={{ background:'rgba(184,147,58,0.1)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'10px', padding:'1px 8px', fontSize:'10px', flexShrink:0 }}>📚 {e.kbName}</span>}
                        {e.source && <span style={{ color:'#4a5568', fontSize:'10px', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{e.source}</span>}
                        {e.tags && <span style={{ color:'#6b7280', fontSize:'10px' }}>#{e.tags}</span>}
                      </div>
                      <div style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', marginBottom:'4px', lineHeight:1.4 }}>{e.question?.startsWith('[') ? <span style={{ color:'#4a5568' }}>{e.question}</span> : `Q: ${e.question}`}</div>
                      {e.category !== 'raw_document' && <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5 }}>A: {e.answer}</div>}
                    </div>
                    <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                      <button onClick={() => startEdit(e)} style={{ background:'rgba(184,147,58,0.1)', border:'1px solid rgba(184,147,58,0.25)', color:'#b8933a', cursor:'pointer', fontSize:'11px', padding:'3px 10px', borderRadius:'4px', whiteSpace:'nowrap' }}>✏️ Edit</button>
                      <button onClick={() => deleteEntry(e.id)} disabled={deleting===e.id} style={{ background:'none', border:'none', color:deleting===e.id?'#4a5568':'#ef444466', cursor:'pointer', fontSize:'16px', padding:'2px 4px' }}>{deleting===e.id ? '…' : '×'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length > 100 && <p style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'8px' }}>Showing 100 of {filtered.length} — refine search to see more</p>}
          </div>
        </div>
      )}

      {/* ── Add Q&A ── */}
      {section === 'add' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 20px', fontSize:'16px' }}>Add Manual Q&A Entry</h3>
          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Knowledge Base</label>
            <select value={selectedKb} onChange={e => setSelectedKb(e.target.value)} style={{ ...inp2, cursor:'pointer', marginBottom:'4px' }}>
              <option value={DEFAULT_KB}>Default KB</option>
              {kbNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ color:'#4a5568', fontSize:'11px' }}>Entry will be added to: <strong style={{ color:'#8a9ab8' }}>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong></div>
          </div>
          <div style={{ marginBottom:'16px' }}><label style={ls}>Question / Keyword / Topic</label><input value={q} onChange={e => setQ(e.target.value)} placeholder="What is the minimum investment?" style={inp2} /></div>
          <div style={{ marginBottom:'16px' }}><label style={ls}>Answer</label><textarea value={a} onChange={e => setA(e.target.value)} placeholder="The minimum investment is $25,000…" rows={5} style={ta2} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            <div><label style={ls}>Category</label><select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp2, cursor:'pointer' }}>{['faq','financials','product','team','market','legal','process','risk','company','pricing','manual'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</select></div>
            <div><label style={ls}>Tags (optional)</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="minimum, investment, amount" style={inp2} /></div>
          </div>
          {saveMsg && <div style={{ background:saveMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${saveMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'10px 14px', color:saveMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px', marginBottom:'16px' }}>{saveMsg}</div>}
          <button onClick={addManual} disabled={saving||!q.trim()||!a.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving ? 'Saving…' : '+ Add Entry'}</button>
        </div>
      )}

      {/* ── Upload Document ── */}
      {section === 'upload' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>Upload Document</h3>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 16px', lineHeight:1.7 }}>Upload a PDF, Word doc, or text file. The AI will read the entire document and extract every useful Q&A pair automatically.</p>

          {/* KB selector for upload */}
          <div style={{ marginBottom:'16px', background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'12px 14px' }}>
            <label style={ls}>Add extracted entries to Knowledge Base</label>
            <select value={selectedKb} onChange={e => setSelectedKb(e.target.value)} style={{ ...inp2, cursor:'pointer' }}>
              <option value={DEFAULT_KB}>Default KB</option>
              {kbNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div onClick={() => !uploading && fileRef.current?.click()}
            style={{ border:`2px dashed ${uploading?'rgba(184,147,58,0.5)':'rgba(255,255,255,0.15)'}`, borderRadius:'8px', padding:'48px', textAlign:'center', cursor:uploading?'default':'pointer', background:'rgba(255,255,255,0.02)', transition:'all 0.2s' }}
            onMouseEnter={e => { if(!uploading){ e.currentTarget.style.borderColor=GOLD; e.currentTarget.style.background='rgba(184,147,58,0.04)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'; e.currentTarget.style.background='rgba(255,255,255,0.02)'; }}>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv" onChange={handleFileUpload} style={{ display:'none' }} />
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>{uploading ? '⏳' : '📄'}</div>
            <div style={{ color:uploading?GOLD:'#e8e0d0', fontSize:'15px', marginBottom:'6px', fontWeight:'bold' }}>{uploading ? uploadProgress||'Processing…' : 'Click to select a file'}</div>
            <div style={{ color:'#4a5568', fontSize:'12px' }}>PDF, Word (.docx), TXT, Markdown, CSV — max 10MB</div>
          </div>
          {uploadMsg && <div style={{ marginTop:'16px', background:uploadMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${uploadMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'12px 16px', color:uploadMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px' }}>{uploadMsg}</div>}
          {sources.length > 0 && (
            <div style={{ marginTop:'28px' }}>
              <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Documents in {selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb} ({sources.length})</div>
              {sources.map(src => {
                const count = kbFiltered.filter(e => e.source === src && e.category !== 'raw_document').length;
                return (
                  <div key={src} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', marginBottom:'4px' }}>
                    <div><span style={{ color:'#c4cdd8', fontSize:'13px' }}>{src}</span><span style={{ color:'#4a5568', fontSize:'11px', marginLeft:'10px' }}>{count} entries</span></div>
                    <button onClick={async () => {
                      if (!window.confirm(`Delete all entries from "${src}"?`)) return;
                      const toDelete = entries.filter(e => e.source === src);
                      for (const e of toDelete) { try { await base44.entities.KnowledgeBase.delete(e.id); } catch {} }
                      await load();
                    }} style={{ background:'none', border:'none', color:'#ef444466', cursor:'pointer', fontSize:'13px' }}>× Remove</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Scrape Website ── */}
      {section === 'scrape' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>Scrape Website</h3>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 16px', lineHeight:1.7 }}>Enter a URL and the AI will fetch the page, strip the noise, and extract every useful Q&A pair.</p>

          {/* KB selector for scrape */}
          <div style={{ marginBottom:'16px', background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'12px 14px' }}>
            <label style={ls}>Add scraped entries to Knowledge Base</label>
            <select value={selectedKb} onChange={e => setSelectedKb(e.target.value)} style={{ ...inp2, cursor:'pointer' }}>
              <option value={DEFAULT_KB}>Default KB</option>
              {kbNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://www.rosieai.tech/about" onKeyDown={e => { if (e.key === 'Enter' && !scraping) handleScrape(); }} style={{ ...inp2, flex:1 }} />
            <button onClick={handleScrape} disabled={scraping||!scrapeUrl.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 20px', cursor:'pointer', fontWeight:'700', fontSize:'12px', whiteSpace:'nowrap' }}>{scraping ? '⏳ Scraping…' : '🌐 Scrape'}</button>
          </div>
          {scrapeMsg && <div style={{ background:scrapeMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${scrapeMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'12px 16px', color:scrapeMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px', marginBottom:'16px' }}>{scrapeMsg}</div>}
          <div style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'4px', padding:'14px 16px', fontSize:'12px', color:'#8a9ab8', lineHeight:1.8 }}><strong style={{ color:'#60a5fa' }}>Tip:</strong> Scrape multiple pages for best coverage — home page, features, pricing, FAQ, about.</div>
        </div>
      )}

      {section === 'intent' && IntentEngineTuner && <IntentEngineTuner />}
      {section === 'coach' && CoachRulesTuner && <CoachRulesTuner />}
    </div>
  );
}