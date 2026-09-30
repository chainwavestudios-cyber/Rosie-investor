/**
 * LeadAssignmentPopup.jsx — Shows a popup when a new lead is assigned to the current user.
 * Polls ScrapedLead for new assignments and displays a notification popup.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

const PLATFORM_LABELS = { reddit: 'Reddit', x_twitter: 'X/Twitter', facebook: 'Facebook', tiktok: 'TikTok', manual: 'Manual' };

export default function LeadAssignmentPopup({ onGoToLeads }) {
  const { user: coachUser } = useDebtCoachAuth();
  const [popup, setPopup] = useState(null);
  const seenIdsRef = useRef(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!coachUser?.username) return;

    const checkForNewAssignments = async () => {
      try {
        const all = await base44.entities.ScrapedLead.filter({ assignedTo: coachUser.username }, '-assignedAt', 20);
        const pending = (all || []).filter(l => l.status === 'assigned' || l.status === 'enriched');

        // On first load, mark all existing as seen (don't popup for old assignments)
        if (!initializedRef.current) {
          pending.forEach(l => seenIdsRef.current.add(l.id));
          initializedRef.current = true;
          return;
        }

        // Find new assignments not yet seen
        const newLead = pending.find(l => !seenIdsRef.current.has(l.id));
        if (newLead) {
          seenIdsRef.current.add(newLead.id);
          setPopup(newLead);
        }
      } catch {}
    };

    // Check immediately and then every 10 seconds
    checkForNewAssignments();
    const interval = setInterval(checkForNewAssignments, 10000);
    return () => clearInterval(interval);
  }, [coachUser?.username]);

  if (!popup) return null;

  return (
    <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 10000, maxWidth: '380px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}66`, borderRadius: '8px', boxShadow: '0 8px 32px rgba(16,185,129,0.2)', overflow: 'hidden', animation: 'slideIn 0.3s ease' }}>
        <style>{`@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.1)', borderBottom: `1px solid ${GOLD}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🎯 New Lead Assigned to You!</span>
          <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
            {popup.resolvedFullName || popup.userHandle}
          </div>
          <div style={{ color: '#8a9ab8', fontSize: '12px', marginBottom: '10px' }}>
            <span style={{ color: GOLD }}>{PLATFORM_LABELS[popup.platform] || popup.platform}</span>
            {popup.extractedDebtAmount ? ` · $${popup.extractedDebtAmount.toLocaleString()} debt` : ''}
            {popup.distressTag ? ` · ${popup.distressTag}` : ''}
          </div>
          <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, maxHeight: '60px', overflow: 'hidden', marginBottom: '14px' }}>
            {popup.postText?.substring(0, 150)}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { onGoToLeads?.(); setPopup(null); }} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
              View & Import
            </button>
            <button onClick={() => setPopup(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}