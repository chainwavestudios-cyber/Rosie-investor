/**
 * FronterClosedDealCelebration.jsx — Full-screen confetti + popup when a deal closes.
 * Shows agent name and weekly sales count. Uses canvas-confetti.
 */
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';

export default function FronterClosedDealCelebration({ agentName, username, onClose }) {
  const [weeklySales, setWeeklySales] = useState(0);

  useEffect(() => {
    // Fire confetti from both sides for 3 seconds
    const colors = ['#10b981', '#f59e0b', '#60a5fa', '#a78bfa', '#ef4444'];
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    // Big center burst
    confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors });

    // Count this week's closed deals by this agent
    const countSales = async () => {
      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const raw = await base44.entities.FronterLead.filter({
          status: 'closed_deal',
          closedDealBy: username,
          closedDealAt: { $gte: weekStart.toISOString() }
        }, '-closedDealAt', 100);
        const sales = Array.isArray(raw) ? raw : (raw?.items || []);
        setWeeklySales(sales.length);
      } catch {}
    };
    countSales();
  }, [username]);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, pointerEvents: 'none' }}>
      <div style={{
        background: 'linear-gradient(135deg, #0d1b2a, #1a2b4a)',
        border: `2px solid ${GOLD}`,
        borderRadius: '12px',
        padding: '40px 60px',
        textAlign: 'center',
        boxShadow: '0 20px 80px rgba(0,0,0,0.8)',
        pointerEvents: 'auto',
        maxWidth: '90vw',
      }}>
        <div style={{ fontSize: '60px', marginBottom: '10px' }}>🎉💰🎉</div>
        <h2 style={{ color: GOLD, fontSize: '28px', margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>Congratulations {agentName}!</h2>
        <p style={{ color: '#e8e0d0', fontSize: '16px', margin: '0 0 6px' }}>Your open just converted into a sale!</p>
        <p style={{ color: '#f59e0b', fontSize: '22px', fontWeight: 'bold', margin: '0 0 6px' }}>
          You have {weeklySales} sale{weeklySales !== 1 ? 's' : ''} this week!
        </p>
        <p style={{ color: '#60a5fa', fontSize: '14px', margin: '0 0 24px' }}>Keep it up! 🚀</p>
        <button onClick={onClose} style={{
          background: 'linear-gradient(135deg,#10b981,#22c55e)',
          color: '#0a0f1e',
          border: 'none',
          borderRadius: '6px',
          padding: '12px 36px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
        }}>Awesome! 🎉</button>
      </div>
    </div>
  );
}