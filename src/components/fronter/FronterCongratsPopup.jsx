/**
 * FronterCongratsPopup.jsx — Congratulatory popup shown to a fronter when
 * one of their deals is marked as Closed Deal by a super admin.
 * Message: "Congrats, <fronter name>, your <First Name> deal has been signed
 * and executed. Way to Go!" — dismissible with X.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function FronterCongratsPopup({ username, fronterFirstName }) {
  const [deal, setDeal] = useState(null);
  const [show, setShow] = useState(false);

  const check = useCallback(async () => {
    if (!username) return;
    try {
      // Find closed deals assigned to this fronter that we haven't shown yet
      const recent = await base44.entities.FronterLead.filter({
        status: 'closed_deal',
        assignedTo: username,
        closedDealAt: { $gte: new Date(Date.now() - 5 * 60 * 1000).toISOString() }
      }, '-closedDealAt', 5);

      const recentDeals = recent || [];
      // Check localStorage for already-dismissed deals
      const dismissed = JSON.parse(localStorage.getItem(`fronter_congrats_dismissed_${username}`) || '[]');
      const newDeal = recentDeals.find(d => !dismissed.includes(d.id));
      if (newDeal) {
        setDeal(newDeal);
        setShow(true);
      }
    } catch {}
  }, [username]);

  useEffect(() => {
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [check]);

  const dismiss = () => {
    if (deal) {
      const dismissed = JSON.parse(localStorage.getItem(`fronter_congrats_dismissed_${username}`) || '[]');
      dismissed.push(deal.id);
      // Keep only last 50
      localStorage.setItem(`fronter_congrats_dismissed_${username}`, JSON.stringify(dismissed.slice(-50)));
    }
    setShow(false);
    setDeal(null);
  };

  if (!show || !deal) return null;

  return (
    <>
      <style>{`
        @keyframes congrats-fade-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes congrats-confetti { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(300px) rotate(360deg); opacity: 0; } }
        @keyframes congrats-glow { 0%,100% { box-shadow: 0 0 30px rgba(16,185,129,0.4), 0 20px 60px rgba(0,0,0,0.7); } 50% { box-shadow: 0 0 50px rgba(16,185,129,0.6), 0 20px 60px rgba(0,0,0,0.7); } }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
        {/* Confetti */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: '10%', left: `${5 + i * 4.5}%`,
            width: '8px', height: '8px', borderRadius: '2px',
            background: ['#10b981', '#f59e0b', '#a78bfa', '#60a5fa', '#f472b6'][i % 5],
            animation: `congrats-confetti ${1.5 + (i % 3) * 0.5}s ease-out ${i * 0.1}s infinite`,
          }} />
        ))}
        <div style={{
          background: 'linear-gradient(135deg, #0d1b2a, #0a0f1e)',
          border: '2px solid rgba(16,185,129,0.4)',
          borderRadius: '16px',
          padding: '40px 48px',
          textAlign: 'center',
          animation: 'congrats-fade-in 0.4s ease-out',
          animationFillMode: 'both',
          maxWidth: '440px',
          position: 'relative',
        }}>
          <button onClick={dismiss} style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '24px', padding: 0, lineHeight: 1 }}>×</button>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <div style={{ color: GOLD, fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', fontFamily: 'Georgia, serif' }}>Congratulations!</div>
          <div style={{ color: '#e8e0d0', fontSize: '16px', lineHeight: 1.6, fontFamily: 'Georgia, serif' }}>
            Congrats, <span style={{ color: GOLD, fontWeight: 'bold' }}>{fronterFirstName || username}</span>, your{' '}
            <span style={{ color: GOLD, fontWeight: 'bold' }}>{deal.firstName}</span> deal has been signed and executed.
          </div>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', marginTop: '12px', fontFamily: 'Georgia, serif' }}>Way to Go! 🏆</div>
          <button onClick={dismiss} style={{ marginTop: '24px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '8px', padding: '12px 36px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>Awesome! 🎊</button>
        </div>
      </div>
    </>
  );
}