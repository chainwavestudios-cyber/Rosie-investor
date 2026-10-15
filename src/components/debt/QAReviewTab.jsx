/**
 * QAReviewTab.jsx — Admin review page for extracted Q&A pairs.
 *
 * Shows HistoricalQAExample records with status 'pending_review'.
 * Admins can approve (promotes to KnowledgeBase) or reject each pair.
 * Approved pairs become KB entries the live Q&A copilot can find.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function QAReviewTab() {
  const { user } = useDebtCoachAuth();
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pending'); // 'pending' | 'approved' | 'rejected'
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ question: '', answer: '' });
  const [saving, setSaving] = useState(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.HistoricalQAExample.filter(
        { status: 'pending_review' },
        { sort: '-extractedAt', limit: 200 }
      );
      setPending(page?.items || page || []);
    } catch (e) {
      console.error('Failed to load pending Q&A:', e);
    }
    setLoading(false);
  }, []);

  const loadApproved = useCallback(async () => {
    try {
      const page = await base44.entities.HistoricalQAExample.filter(
        { status: view === 'rejected' ? 'rejected' : 'approved' },
        { sort: '-reviewedAt', limit: 100 }
      );
      setApproved(page?.items || page || []);
    } catch (e) {
      console.error('Failed to load reviewed Q&A:', e);
    }
  }, [view]);

  useEffect(() => {
    if (view === 'pending') loadPending();
    else loadApproved();
  }, [view, loadPending, loadApproved]);

  const handleApprove = async (item, editedQuestion, editedAnswer) => {
    setSaving(true);
    try {
      // 1. Create a KnowledgeBase entry from the approved Q&A
      const kbRes = await base44.entities.KnowledgeBase.create({
        question: editedQuestion || item.question,
        answer: editedAnswer || item.answer,
        category: 'debt_faq',
        kbName: 'Debt Settlement',
        source: 'transcript_learning',
        tags: 'learned',
      });

      // 2. Mark the HistoricalQAExample as approved
      await base44.entities.HistoricalQAExample.update(item.id, {
        status: 'approved',
        reviewedBy: user?.username || 'admin',
        reviewedAt: new Date().toISOString(),
        kbEntryId: kbRes?.id || '',
      });

      setEditingId(null);
      loadPending();
    } catch (e) {
      alert('Failed to approve: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  const handleReject = async (item) => {
    try {
      await base44.entities.HistoricalQAExample.update(item.id, {
        status: 'rejected',
        reviewedBy: user?.username || 'admin',
        reviewedAt: new Date().toISOString(),
      });
      loadPending();
    } catch (e) {
      alert('Failed to reject: ' + (e?.message || String(e)));
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ question: item.question, answer: item.answer });
  };

  const list = view === 'pending' ? pending : approved;

  return (
    <div>
      {/* Sub-tabs: Pending | Approved | Rejected */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📚 Q&A Learning Review</div>
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { id: 'pending', label: `⏳ Pending (${pending.length})` },
            { id: 'approved', label: '✅ Approved' },
            { id: 'rejected', label: '❌ Rejected' },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${view === t.id ? GOLD : 'transparent'}`, color: view === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: view === t.id ? 'bold' : 'normal' }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ color: '#4a5568', fontSize: '11px', marginBottom: '16px', lineHeight: 1.6 }}>
        {view === 'pending'
          ? 'Q&A pairs extracted from completed call transcripts. Approve good ones to add them to the Knowledge Base — the live Q&A copilot will use them on future calls. Edit the text before approving if needed.'
          : view === 'approved'
          ? 'Approved Q&A pairs that have been promoted to the Knowledge Base. The live Q&A copilot can now find and use these answers.'
          : 'Rejected Q&A pairs. These were not good enough to add to the Knowledge Base.'}
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
          {view === 'pending' ? 'No pending Q&A pairs to review. They appear here automatically after calls are completed.' : 'No records yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {list.map((item) => {
            const isEditing = editingId === item.id && view === 'pending';
            return (
              <div key={item.id} style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px' }}>
                {item.leadName && (
                  <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '6px' }}>
                    From call with {item.leadName} · {item.extractedAt ? new Date(item.extractedAt).toLocaleDateString() : ''}
                    {item.reviewedBy && ` · Reviewed by ${item.reviewedBy}`}
                  </div>
                )}

                {isEditing ? (
                  <>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Question</label>
                      <input value={editForm.question} onChange={e => setEditForm(prev => ({ ...prev, question: e.target.value }))} style={inp} />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Answer</label>
                      <textarea value={editForm.answer} onChange={e => setEditForm(prev => ({ ...prev, answer: e.target.value }))} style={{ ...inp, minHeight: '80px', resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleApprove(item, editForm.question, editForm.answer)} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : '✓ Approve & Save'}</button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Q: {item.question}</div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>A: {item.answer}</div>

                    {view === 'pending' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleApprove(item)} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '5px 14px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✓ Approve</button>
                        <button onClick={() => startEdit(item)} style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px' }}>✏ Edit & Approve</button>
                        <button onClick={() => handleReject(item)} style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '10px' }}>✗ Reject</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}