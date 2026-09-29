/**
 * ComplianceAdminTab.jsx — Admin/SuperAdmin compliance management.
 * Knowledge Base management, Conversational AI agent for rule ingestion,
 * Script compliance approvals, and aggregate reporting.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const SUB_TABS = [
  { id: 'kb', label: '📚 Knowledge Base' },
  { id: 'agent', label: '🤖 AI Agent' },
  { id: 'scripts', label: '📜 Script Approvals' },
  { id: 'reports', label: '📊 Reports' },
];

const CATEGORIES = [
  { id: 'regulatory_disclosure', label: 'Regulatory Disclosure' },
  { id: 'factual_ground_truth', label: 'Factual Ground Truth' },
  { id: 'approved_script', label: 'Approved Script' },
  { id: 'policy_doc', label: 'Policy Document' },
  { id: 'training_material', label: 'Training Material' },
  { id: 'custom_rule', label: 'Custom Rule' },
];

export default function ComplianceAdminTab() {
  const [subTab, setSubTab] = useState('kb');
  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${subTab === t.id ? GOLD : 'transparent'}`, color: subTab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: subTab === t.id ? 'bold' : 'normal' }}>{t.label}</button>
        ))}
      </div>
      {subTab === 'kb' && <KnowledgeBaseTab />}
      {subTab === 'agent' && <AgentChatTab />}
      {subTab === 'scripts' && <ScriptApprovalsTab />}
      {subTab === 'reports' && <ReportsTab />}
    </div>
  );
}

function KnowledgeBaseTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'custom_rule', content: '', ruleInstructions: '', groundTruthJson: '', thresholdValue: '', mediaType: 'MANUAL', fileUrl: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'listKnowledge' });
      setEntries((res?.data || res).entries || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await base44.functions.invoke('complianceAdmin', {
        action: 'uploadKnowledge',
        title: form.title, category: form.category, content: form.content,
        ruleInstructions: form.ruleInstructions, groundTruthJson: form.groundTruthJson,
        thresholdValue: form.thresholdValue ? Number(form.thresholdValue) : null,
        mediaType: form.mediaType, fileUrl: form.fileUrl,
      });
      setForm({ title: '', category: 'custom_rule', content: '', ruleInstructions: '', groundTruthJson: '', thresholdValue: '', mediaType: 'MANUAL', fileUrl: '' });
      setShowAdd(false);
      load();
    } catch {}
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this compliance rule?')) return;
    await base44.functions.invoke('complianceAdmin', { action: 'deleteKnowledge', kbId: id });
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📚 Compliance Knowledge Base</div>
        <button onClick={() => setShowAdd(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{showAdd ? '✕ Cancel' : '+ Add Rule'}</button>
      </div>

      {showAdd && (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div><label style={ls}>Title</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Rate Disclosure Rule" style={inp} /></div>
            <div><label style={ls}>Category</label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: '12px' }}><label style={ls}>Content / Rule Text</label><textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="The compliance rule or approved language…" /></div>
          <div style={{ marginBottom: '12px' }}><label style={ls}>Natural Language Rule Instructions</label><textarea value={form.ruleInstructions} onChange={e => setForm(p => ({ ...p, ruleInstructions: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="e.g. Flag any deviation over 0.25% on rates as critical" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div><label style={ls}>Ground Truth (JSON)</label><input value={form.groundTruthJson} onChange={e => setForm(p => ({ ...p, groundTruthJson: e.target.value }))} placeholder='{"max_rate": "3%"}' style={inp} /></div>
            <div><label style={ls}>Threshold Value</label><input type="number" value={form.thresholdValue} onChange={e => setForm(p => ({ ...p, thresholdValue: e.target.value }))} style={inp} /></div>
            <div><label style={ls}>Media Type</label><select value={form.mediaType} onChange={e => setForm(p => ({ ...p, mediaType: e.target.value }))} style={inp}><option value="MANUAL">Manual</option><option value="PDF">PDF</option><option value="AUDIO">Audio</option><option value="TEXT">Text</option><option value="LINK">Link</option></select></div>
          </div>
          {form.mediaType !== 'MANUAL' && <div style={{ marginBottom: '12px' }}><label style={ls}>File URL</label><input value={form.fileUrl} onChange={e => setForm(p => ({ ...p, fileUrl: e.target.value }))} placeholder="https://…" style={inp} /></div>}
          <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>💾 Save Rule</button>
        </div>
      )}

      {loading ? <div style={{ color: '#6b7280', textAlign: 'center', padding: '30px' }}>Loading…</div> :
       entries.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No compliance rules yet. Add rules for the AI engine to evaluate against.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map(e => {
            const cat = CATEGORIES.find(c => c.id === e.category);
            return (
              <div key={e.id} style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <span style={{ padding: '2px 8px', borderRadius: '2px', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{cat?.label || e.category}</span>
                    <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginLeft: '8px' }}>{e.title}</span>
                  </div>
                  <button onClick={() => del(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                </div>
                <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.content}</div>
                {e.ruleInstructions && <div style={{ color: '#a78bfa', fontSize: '11px', marginTop: '6px' }}>📋 {e.ruleInstructions}</div>}
                {e.groundTruthJson && <div style={{ color: '#60a5fa', fontSize: '11px', marginTop: '4px' }}>Ground Truth: {e.groundTruthJson}</div>}
                {e.thresholdValue != null && <div style={{ color: '#f59e0b', fontSize: '11px', marginTop: '4px' }}>Threshold: {e.thresholdValue}</div>}
                <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px' }}>By {e.createdBy || '—'} · {new Date(e.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentChatTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const res = await base44.functions.invoke('complianceAdmin', {
        action: 'agentChat', message: input, fileUrl, history: messages.map(m => ({ role: m.role, text: m.text })),
      });
      const data = res?.data || res;
      const reply = data?.reply || 'No response.';
      const createdKb = data?.createdKb;
      setMessages(prev => [...prev, { role: 'assistant', text: reply, createdRule: !!createdKb, ruleTitle: createdKb?.title }]);
      setInput(''); setFileUrl('');
    } catch { setMessages(prev => [...prev, { role: 'assistant', text: 'Error contacting agent.' }]); }
    setSending(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🤖 Compliance Knowledge Agent</div>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }} ref={scrollRef}>
        {messages.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
            Chat with the AI to create compliance rules. Try:<br />
            <em style={{ color: '#8a9ab8' }}>"Add a rule: flag any rate mention above 3% as critical"</em><br />
            <em style={{ color: '#8a9ab8' }}>"Create a ground truth: our success rate is 85%, flag anyone claiming higher"</em>
          </div>
        ) : messages.map((m, i) => (
          <div key={i} style={{ padding: '10px 14px', borderRadius: '6px', background: m.role === 'user' ? 'rgba(16,185,129,0.06)' : 'rgba(96,165,250,0.06)', border: `1px solid ${m.role === 'user' ? 'rgba(16,185,129,0.2)' : 'rgba(96,165,250,0.2)'}`, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            <div style={{ color: m.role === 'user' ? GOLD : '#60a5fa', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>{m.role === 'user' ? 'You' : 'AI Agent'}</div>
            <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
            {m.createdRule && <div style={{ color: '#4ade80', fontSize: '11px', marginTop: '6px' }}>✓ Rule created: {m.ruleTitle}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="Optional file URL for context…" style={{ ...inp, flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Describe a compliance rule to create…" style={{ ...inp, flex: 1 }} />
        <button onClick={send} disabled={sending || !input.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '0 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: sending || !input.trim() ? 0.5 : 1 }}>{sending ? '⏳' : 'Send'}</button>
      </div>
    </div>
  );
}

function ScriptApprovalsTab() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvedIds, setApprovedIds] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const allScripts = await base44.entities.DebtScript.list('-sortOrder', 100);
      setScripts(allScripts || []);
      const kbRes = await base44.functions.invoke('complianceAdmin', { action: 'listKnowledge' });
      const kbEntries = (kbRes?.data || kbRes).entries || [];
      setApprovedIds(new Set(kbEntries.filter(k => k.isApprovedScript && k.scriptId).map(k => k.scriptId)));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (s) => {
    const isApproved = approvedIds.has(s.id);
    try {
      await base44.functions.invoke('complianceAdmin', { action: 'approveScript', scriptId: s.id, isApproved: !isApproved });
      setApprovedIds(prev => { const next = new Set(prev); if (isApproved) next.delete(s.id); else next.add(s.id); return next; });
    } catch {}
  };

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📜 Script Compliance Approvals</div>
      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px' }}>
        Approved scripts are added to the compliance rules vector space. The AI engine evaluates live calls against these approved scripts.
      </div>
      {loading ? <div style={{ color: '#6b7280', textAlign: 'center', padding: '30px' }}>Loading…</div> :
       scripts.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No scripts found.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {scripts.map(s => {
            const isApproved = approvedIds.has(s.id);
            return (
              <div key={s.id} style={{ background: '#0d1b2a', border: `1px solid ${isApproved ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{s.name}</span>
                    <span style={{ padding: '1px 6px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase' }}>{s.scriptType}</span>
                    {isApproved && <span style={{ padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.18)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>✓ Compliance Approved</span>}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', maxHeight: '40px', overflow: 'hidden' }}>{(s.content || '').slice(0, 120)}…</div>
                </div>
                <button onClick={() => toggle(s)} style={{ padding: '8px 16px', borderRadius: '4px', border: `1px solid ${isApproved ? 'rgba(239,68,68,0.3)' : GOLD + '44'}`, background: isApproved ? 'rgba(239,68,68,0.1)' : `${GOLD}18`, color: isApproved ? '#ef4444' : GOLD, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{isApproved ? 'Revoke' : 'Approve'}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'getStats', dateFrom, dateTo });
      setStats((res?.data || res));
    } catch {}
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📊 Compliance Reports & Trends</div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div><label style={ls}>From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} /></div>
        <div><label style={ls}>To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} /></div>
      </div>
      {loading ? <div style={{ color: '#6b7280', textAlign: 'center', padding: '30px' }}>Loading…</div> : stats ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <StatBox label="Total IDs" value={stats.total || 0} color={GOLD} />
            <StatBox label="Open" value={stats.open || 0} color="#ef4444" />
            <StatBox label="Avg Score" value={`${stats.avgScore || 100}%`} color={stats.avgScore >= 80 ? '#4ade80' : '#f59e0b'} />
            <StatBox label="Critical Violations" value={stats.criticalViolations || 0} color="#ef4444" />
          </div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>⚠️ Violation Type Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {Object.entries(stats.byRule || {}).length === 0 ? <div style={{ color: '#4a5568', fontSize: '12px' }}>No violations recorded.</div> : Object.entries(stats.byRule).map(([rule, count]) => (
              <div key={rule} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                <span style={{ color: '#c4cdd8', fontSize: '12px', textTransform: 'capitalize' }}>{rule.replace(/_/g, ' ')}</span>
                <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>{count}</span>
              </div>
            ))}
          </div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>👥 Per-User Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(stats.byUser || []).length === 0 ? <div style={{ color: '#4a5568', fontSize: '12px' }}>No data.</div> : (stats.byUser || []).map(u => (
              <div key={u.username} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                <span style={{ color: '#c4cdd8', fontSize: '12px' }}>{u.username}</span>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>{u.total} IDs</span>
                  <span style={{ color: '#ef4444', fontSize: '11px' }}>{u.open} open</span>
                  <span style={{ color: u.avgScore >= 80 ? '#4ade80' : '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>{u.avgScore}% avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px' }}>No data.</div>}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '20px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}