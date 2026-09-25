/**
 * DebtCallCoach.jsx — Standalone debt settlement call coaching platform.
 * Tabs: Live Call (headset coaching + lead card) | Knowledge Base | User Profiles.
 */
import { useState } from 'react';
import DebtLiveCall from '@/components/debt/DebtLiveCall';
import DebtKBManager from '@/components/debt/DebtKBManager';
import DebtUserProfile from '@/components/debt/DebtUserProfile';
import DebtPitchTab from '@/components/debt/DebtPitchTab';
import DebtBobTrainer from '@/components/debt/DebtBobTrainer';
import WCRChecklist from '@/components/debt/WCRChecklist';
import ProfileTimerWatcher from '@/components/debt/ProfileTimerWatcher';
import ClientProfileModal from '@/components/debt/ClientProfileModal';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

const TABS = [
  { id: 'live', label: '📞 Live Call' },
  { id: 'bob', label: '🤖 BOB Training' },
  { id: 'pitches', label: '🎤 Pitches' },
  { id: 'kb', label: '🧠 Knowledge Base' },
  { id: 'profile', label: '👤 User Profiles' },
];

export default function DebtCallCoach() {
  const [tab, setTab] = useState('live');
  const [timerLead, setTimerLead] = useState(null);

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, color: '#e8e0d0', padding: '24px 32px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal', color: '#e8e0d0' }}>💳 Debt Settlement Call Coach</h1>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
          Live Headset Coaching · Deepgram AI · Debt Settlement KB
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 18px', background: tab === t.id ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'live' && <DebtLiveCall />}
      {tab === 'bob' && <DebtBobTrainer />}
      {tab === 'pitches' && <DebtPitchTab />}
      {tab === 'kb' && <DebtKBManager />}
      {tab === 'profile' && <DebtUserProfile />}

      {/* Floating WCR Checklist — available on all tabs */}
      <WCRChecklist />

      {/* Profile Timer Watcher — shows popup reminders, can reopen profile */}
      <ProfileTimerWatcher onOpenProfile={(lead) => setTimerLead(lead)} />

      {/* Profile opened from timer popup */}
      {timerLead && (
        <ClientProfileModal lead={timerLead} onClose={() => setTimerLead(null)} onSave={() => {}} />
      )}
    </div>
  );
}