/**
 * TrainingPage.jsx — Training scheduler for the two training sessions.
 * Shows Training A (tonight 8:30 PM EST) and Training B (tomorrow 1:00 PM EST).
 * Interviewer searches for fronters by name, adds them to a session list, and
 * submits to create/update a Google Calendar event with attendees + email reminders.
 * Requires super admin access.
 */
import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';
import TrainingSessionCard from '@/components/interviews/TrainingSessionCard';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';

function getTrainingTimes() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  const tonight = new Date();
  tonight.setHours(20, 30, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(13, 0, 0, 0);
  return {
    A: fmt.format(tonight),
    B: fmt.format(tomorrow),
  };
}

export default function TrainingPage() {
  const { user, loading, isAuthenticated, isSuperAdmin, logout } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [allFronters, setAllFronters] = useState([]);
  const [attendeesA, setAttendeesA] = useState([]);
  const [attendeesB, setAttendeesB] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const times = getTrainingTimes();

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [fronters, attA, attB] = await Promise.all([
        base44.entities.DebtCoachUser.filter({ role: 'fronter' }).catch(() => []),
        base44.entities.TrainingAttendee.filter({ sessionType: 'A' }).catch(() => []),
        base44.entities.TrainingAttendee.filter({ sessionType: 'B' }).catch(() => []),
      ]);
      setAllFronters(Array.isArray(fronters) ? fronters : (fronters?.items || []));
      setAttendeesA(Array.isArray(attA) ? attA : (attA?.items || []));
      setAttendeesB(Array.isArray(attB) ? attB : (attB?.items || []));
    } catch {}
    setLoadingData(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (!isSuperAdmin) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', fontFamily: 'Georgia, serif' }}>
      <div style={{ color: RED, fontSize: '18px', fontWeight: 'bold' }}>Access Denied</div>
      <div style={{ color: '#8a9ab8', fontSize: '14px' }}>Super admin access required.</div>
      <button onClick={() => navigate('/debt-call-coach-login')} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '13px' }}>Go to Login</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>TRAINING SCHEDULER</div>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>|</span>
          <span style={{ color: '#8a9ab8', fontSize: '13px' }}>{user?.username}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/interviews')} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>🎤 Interviews</button>
          <button onClick={() => navigate('/fronter')} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>← Fronter Dashboard</button>
          <button onClick={() => { logout(); navigate('/debt-call-coach-login', { replace: true }); }} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '30px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📅</div>
          <h1 style={{ color: '#e8e0d0', fontSize: '24px', marginBottom: '6px' }}>Training Session Scheduler</h1>
          <p style={{ color: '#8a9ab8', fontSize: '14px' }}>Search for fronters, add them to a training session, and submit to create a calendar event with reminders.</p>
        </div>

        {loadingData ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '14px' }}>Loading fronters…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            <TrainingSessionCard
              sessionType="A"
              sessionName="Debt Solutions Training A"
              sessionTime={times.A}
              accent={GOLD}
              allFronters={allFronters}
              existingAttendees={attendeesA}
              addedBy={user?.username}
              onSubmitted={loadData}
            />
            <TrainingSessionCard
              sessionType="B"
              sessionName="Debt Solutions Training B"
              sessionTime={times.B}
              accent={BLUE}
              allFronters={allFronters}
              existingAttendees={attendeesB}
              addedBy={user?.username}
              onSubmitted={loadData}
            />
          </div>
        )}

        {/* Info note */}
        <div style={{ marginTop: '24px', background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', padding: '14px 18px', color: '#8a9ab8', fontSize: '12px', lineHeight: 1.6 }}>
          <strong style={{ color: BLUE }}>ℹ️ How it works:</strong> Search for a fronter by name, click the ＋ to add them to the pending list, then hit Submit. This creates a Google Calendar event (or updates the existing one) with all attendees, sends calendar invitations, and emails a reminder to each attendee. Two calendar events are maintained: <strong style={{ color: GOLD }}>Training A</strong> (tonight 8:30 PM EST) and <strong style={{ color: BLUE }}>Training B</strong> (tomorrow 1:00 PM EST).
        </div>
      </div>
    </div>
  );
}