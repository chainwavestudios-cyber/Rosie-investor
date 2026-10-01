/**
 * SmartLeadsRejectModal.jsx — Popup for rejecting a scraped lead with a reason.
 * The rejection feedback is saved to SmartLeadFeedback and sent to the Smart Leads AI
 * for learning (to improve future scraping).
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';

const REJECTION_CATEGORIES = [
  { id: 'not_relevant', label: 'Not Relevant', icon: '🚫', desc: 'Post is not about credit card debt or debt settlement' },
  { id: 'wrong_demographic', label: 'Wrong Demographic', icon: '👤', desc: 'Person doesn\'t fit our target demographic' },
  { id: 'spam_or_bot', label: 'Spam / Bot', icon: '🤖', desc: 'Appears to be spam, bot, or promotional content' },
  { id: 'too_old', label: 'Too Old', icon: '📅', desc: 'Post is outdated — situation likely resolved' },
  { id: 'wrong_debt_type', label: 'Wrong Debt Type', icon: '💳', desc: 'Student loans, medical, mortgage — not credit card debt' },
  { id: 'wrong_debt_amount', label: 'Wrong Debt Amount', icon: '💲', desc: 'Debt amount too low or outside our range' },
  { id: 'already_enrolled', label: 'Already Enrolled', icon: '✅', desc: 'Person is already in a debt program' },
  { id: 'duplicate', label: 'Duplicate', icon: '📋', desc: 'Same person or post already exists' },
  { id: 'other', label: 'Other', icon: '📝', desc: 'Something else — explain below' },
];

export default function SmartLeadsRejectModal({ lead, onClose, onSubmitted, coachUser }) {
  const [category, setCategory] = useState('not_relevant');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason.trim()) { setError('Please explain why this lead is not relevant.'); return; }
    setSubmitting(true); setError(''); setResult(null);
    try {
      // Save feedback
      const feedback = await base44.entities.SmartLeadFeedback.create({
        leadId: lead.id,
        leadDataJson: JSON.stringify({
          platform: lead.platform,
          userHandle: lead.userHandle,
          postTitle: lead.postTitle,
          postText: lead.postText?.substring(0, 2000),
          postUrl: lead.postUrl,
          distressCategory: lead.distressCategory,
          distressTag: lead.distressTag,
          extractedDebtAmount: lead.extractedDebtAmount,
          debtAmountRaw: lead.debtAmountRaw,
          subreddit: lead.subreddit,
          postCreatedAt: lead.postCreatedAt,
        }),
        rejectionCategory: category,
        rejectionReason: reason.trim(),
        submittedBy: coachUser?.username || 'unknown',
      });

      // Mark the lead as rejected
      await base44.entities.ScrapedLead.update(lead.id, { status: 'rejected' });

      // Send to Smart Leads AI for learning
      let aiResult = null;
      try {
        aiResult = await base44.functions.invoke('smartLeadsChat', {
          action: 'process_feedback',
          feedbackId: feedback.id,
        });
      } catch (e) {
        // AI processing might fail — still keep the feedback for later
        console.error('Smart Leads AI processing failed:', e);
      }

      setResult({
        feedbackId: feedback.id,
        aiLearning: aiResult?.learningNote || aiResult?.data?.learningNote || '',
        configChanges: aiResult?.configChanges || aiResult?.data?.configChanges || [],
        configUpdated: aiResult?.configUpdated ?? aiResult?.data?.configUpdated ?? false,
      });

      onSubmitted?.(lead.id);
    } catch (e) { setError('Failed to submit feedback: ' + (e?.message || String(e))); }
    setSubmitting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#0d1b2a', border: `1px solid ${RED}44`, borderRadius: '8px', maxWidth: '600px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ color: RED, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🚫 Reject Lead</div>
            <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{lead.userHandle}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Lead preview */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Post Preview</div>
          <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, maxHeight: '80px', overflow: 'hidden' }}>
            {lead.postTitle && <span style={{ fontWeight: 'bold' }}>{lead.postTitle} — </span>}{lead.postText?.substring(0, 200)}
          </div>
        </div>

        {result ? (
          /* Success state */
          <div>
            <div style={{ padding: '16px', background: 'rgba(16,185,129,0.08)', border: `1px solid ${GOLD}44`, borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>✅ Feedback Submitted & AI Processed</div>
              {result.aiLearning && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>🧠 What Smart Leads AI Learned</div>
                  <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6 }}>{result.aiLearning}</div>
                </div>
              )}
              {result.configChanges?.length > 0 && (
                <div>
                  <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>⚙️ Config Changes Applied</div>
                  {result.configChanges.map((c, i) => (
                    <div key={i} style={{ color: c.applied ? GOLD : '#6b7280', fontSize: '11px', marginBottom: '2px' }}>
                      {c.applied ? '✓' : '✗'} <strong>{c.action}</strong> {c.field}: {c.value} {c.reason && <span style={{ color: '#6b7280' }}>— {c.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
              {!result.configUpdated && (
                <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '8px' }}>No config changes needed — the AI noted this rejection for future reference.</div>
              )}
            </div>
            <button onClick={onClose} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
          </div>
        ) : (
          /* Form */
          <>
            {/* Category selection */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Why is this lead not relevant?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {REJECTION_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                    padding: '10px 12px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer',
                    background: category === cat.id ? `${RED}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${category === cat.id ? RED + '44' : 'rgba(255,255,255,0.08)'}`,
                    color: category === cat.id ? RED : '#8a9ab8', fontSize: '11px', fontWeight: category === cat.id ? 'bold' : 'normal',
                  }}>
                    <div style={{ fontSize: '14px', marginBottom: '2px' }}>{cat.icon} {cat.label}</div>
                    <div style={{ fontSize: '9px', color: category === cat.id ? '#8a9ab8' : '#4a5568' }}>{cat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed reason */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Explain in detail (this goes to the Smart Leads AI for learning)</div>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={4}
                placeholder="e.g., This post is about student loan debt, not credit card debt. The person mentions $40k in student loans and is asking about income-driven repayment plans, not debt settlement..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'Georgia, serif' }}
              />
            </div>

            {error && <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: RED, fontSize: '12px' }}>⚠ {error}</div>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={submit} disabled={submitting} style={{ flex: 1, background: `linear-gradient(135deg,${RED},#dc2626)`, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: submitting ? 0.5 : 1 }}>
                {submitting ? '⏳ Submitting…' : '🚫 Reject & Send to AI'}
              </button>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 16px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}