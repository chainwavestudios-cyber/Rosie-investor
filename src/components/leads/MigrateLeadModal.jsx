import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

function StepRow({ done, active, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'5px 0' }}>
      <div style={{
        width:'20px', height:'20px', borderRadius:'50%', flexShrink:0,
        background: done ? '#4ade80' : active ? GOLD : 'rgba(255,255,255,0.08)',
        border: `2px solid ${done ? '#4ade80' : active ? GOLD : 'rgba(255,255,255,0.15)'}`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color: done ? DARK : GOLD,
      }}>
        {done ? '✓' : active ? '·' : ''}
      </div>
      <span style={{ color: done ? '#4ade80' : active ? GOLD : '#4a5568', fontSize:'12px' }}>{label}</span>
    </div>
  );
}

const STEPS = [
  'Creating CRM account',
  'Migrating call & note history',
  'Migrating email logs',
  'Migrating appointments',
  'Migrating site visits',
  'Migrating investor site sessions',
  'Linking website access',
  'Archiving lead',
  'Placing in pipeline',
];

export default function MigrateLeadModal({ lead, history, onClose, onMigrated }) {
  const [migrating, setMigrating]     = useState(false);
  const [error, setError]             = useState('');
  const [step, setStep]               = useState(0);      // 0=confirm 1=migrating 2=done
  const [currentStep, setCurrentStep] = useState('');
  const [doneSteps, setDoneSteps]     = useState([]);

  const existingUsername = lead.portalPasscode || '';
  const lastNameSlug     = (lead.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  const portalPassword   = `${lastNameSlug}#2026`;

  const markDone = (label) => setDoneSteps(prev => [...prev, label]);

  const handleMigrate = async () => {
    setMigrating(true); setStep(1); setError(''); setDoneSteps([]);
    try {

      // ── 1. Create or upgrade InvestorUser ────────────────────────────
      setCurrentStep('Creating CRM account');
      let investorUser = null;

      if (existingUsername) {
        const existing = await base44.entities.InvestorUser.filter({ username: existingUsername });
        if (existing?.length > 0) {
          await base44.entities.InvestorUser.update(existing[0].id, {
            name:                 `${lead.firstName} ${lead.lastName}`,
            email:                (lead.email || '').toLowerCase(),
            phone:                lead.phone   || existing[0].phone   || '',
            state:                lead.state   || existing[0].state   || '',
            address:              lead.address || existing[0].address || '',
            notes:                lead.notes   || existing[0].notes   || '',
            siteAccess:           'portal',
            role:                 'investor',
            status:               'prospect',
            engagementScore:      lead.engagementScore      || 0,
            portalPasscode:       existingUsername,
            leadId:               lead.id,
            badgeEmailOpened:     lead.badgeEmailOpened     || false,
            badgeConsumerWebsite: lead.badgeConsumerWebsite || false,
            badgeInvestorPage:    lead.badgeInvestorPage    || false,
          });
          investorUser = { ...existing[0], siteAccess: 'portal', status: 'prospect' };
        }
      }

      if (!investorUser) {
        const nameSlug    = (lead.firstName || 'user').toLowerCase().replace(/[^a-z]/g, '');
        const last4       = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
        const newUsername = `${nameSlug}${last4}`;
        investorUser = await base44.entities.InvestorUser.create({
          name:                 `${lead.firstName} ${lead.lastName}`,
          username:             newUsername,
          email:                (lead.email || '').toLowerCase(),
          password:             portalPassword,
          phone:                lead.phone   || '',
          state:                lead.state   || '',
          address:              lead.address || '',
          notes:                lead.notes   || '',
          role:                 'investor',
          status:               'prospect',
          siteAccess:           'portal',
          investmentType:       'cash',
          engagementScore:      lead.engagementScore      || 0,
          portalPasscode:       newUsername,
          leadId:               lead.id,
          starRating:           0,
          badgeEmailOpened:     lead.badgeEmailOpened     || false,
          badgeConsumerWebsite: lead.badgeConsumerWebsite || false,
          badgeInvestorPage:    lead.badgeInvestorPage    || false,
        });
      }
      markDone('Creating CRM account');

      // ── 2. Migrate LeadHistory → ContactNotes ────────────────────────
      setCurrentStep('Migrating call & note history');
      const allHistory = history?.length
        ? history
        : await base44.entities.LeadHistory.filter({ leadId: lead.id }).catch(() => []);

      for (const h of allHistory) {
        try {
          const noteType = (() => {
            if (['call', 'connected'].includes(h.type)) return 'call';
            if (h.type === 'sms')                        return 'sms';
            if (h.type === 'voicemail')                  return 'voicemail';
            if (h.type === 'email' || (h.content || '').includes('Email sent')) return 'email';
            return 'note';
          })();
          const typeLabel = h.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          await base44.entities.ContactNote.create({
            investorId:    investorUser.id,
            investorEmail: investorUser.email,
            type:          noteType,
            content:       `[From Lead History · ${typeLabel}] ${h.content || ''}`,
            createdAt:     h.created_date,
            createdBy:     h.createdBy || 'admin',
          });
        } catch {}
      }
      markDone('Migrating call & note history');

      // ── 3. Migrate EmailLogs ──────────────────────────────────────────
      setCurrentStep('Migrating email logs');
      try {
        const emailLogs = await base44.entities.EmailLog.filter({ leadId: lead.id });
        for (const log of emailLogs) {
          try {
            await base44.entities.EmailLog.update(log.id, { investorId: investorUser.id });
            await base44.entities.ContactNote.create({
              investorId:    investorUser.id,
              investorEmail: investorUser.email,
              type:          'email',
              content:       `[Email Log] Status: ${log.status}${log.openedAt ? ' · Opened: ' + new Date(log.openedAt).toLocaleString() : ''}${log.clickedUrl ? ' · Clicked: ' + log.clickedUrl : ''}`,
              createdAt:     log.sentAt,
              createdBy:     log.sentBy || 'admin',
            });
          } catch {}
        }
      } catch {}
      markDone('Migrating email logs');

      // ── 4. Migrate Appointments ───────────────────────────────────────
      setCurrentStep('Migrating appointments');
      try {
        const appts = await base44.entities.Appointment.filter({ investorId: lead.id }).catch(() => []);
        for (const appt of appts) {
          try {
            await base44.entities.Appointment.update(appt.id, {
              investorId:    investorUser.id,
              investorEmail: investorUser.email,
              investorName:  investorUser.name,
            });
            await base44.entities.ContactNote.create({
              investorId:    investorUser.id,
              investorEmail: investorUser.email,
              type:          'note',
              content:       `[Appointment] ${appt.title} · ${appt.type} · ${appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleString() : ''} · ${appt.status || 'scheduled'}${appt.notes ? ' — ' + appt.notes : ''}`,
              createdAt:     appt.scheduledAt,
              createdBy:     appt.createdBy || 'admin',
            });
          } catch {}
        }
      } catch {}
      markDone('Migrating appointments');

      // ── 5. Migrate SiteVisits (consumer site) ────────────────────────
      setCurrentStep('Migrating site visits');
      try {
        const visits = await base44.entities.SiteVisit.filter({ leadId: lead.id });
        for (const visit of visits) {
          try { await base44.entities.SiteVisit.update(visit.id, { investorId: investorUser.id }); } catch {}
        }
        if (visits.length > 0) {
          const totalTime = visits.reduce((s, v) => s + (v.timeOnPage || 0), 0);
          await base44.entities.ContactNote.create({
            investorId:    investorUser.id,
            investorEmail: investorUser.email,
            type:          'note',
            content:       `[Site Visits Migrated] ${visits.length} page visits · Total time: ${Math.round(totalTime / 60)}m`,
            createdAt:     new Date().toISOString(),
            createdBy:     'system',
          });
        }
      } catch {}
      markDone('Migrating site visits');

      // ── 6. Migrate AnalyticsSessions (investor site) ─────────────────
      setCurrentStep('Migrating investor site sessions');
      try {
        const username = existingUsername || investorUser.username;
        if (username) {
          const sessions = await base44.entities.AnalyticsSession.filter({ username });
          for (const session of sessions) {
            try {
              await base44.entities.AnalyticsSession.update(session.id, {
                investorId: investorUser.id,
                userEmail:  investorUser.email,
                userName:   investorUser.name,
              });
            } catch {}
          }
          if (sessions.length > 0) {
            const totalSecs  = sessions.reduce((s, x) => s + (x.durationSeconds || 0), 0);
            const totalPages = sessions.reduce((s, x) => s + (x.pages?.length || 0), 0);
            await base44.entities.ContactNote.create({
              investorId:    investorUser.id,
              investorEmail: investorUser.email,
              type:          'note',
              content:       `[Investor Site Sessions] ${sessions.length} sessions · ${totalPages} pages · ${Math.round(totalSecs / 60)}m total`,
              createdAt:     new Date().toISOString(),
              createdBy:     'system',
            });
          }
        }
      } catch {}
      markDone('Migrating investor site sessions');

      // ── 7. Ensure full portal access ─────────────────────────────────
      setCurrentStep('Linking website access');
      try {
        await base44.entities.InvestorUser.update(investorUser.id, {
          siteAccess:     'portal',
          portalPasscode: existingUsername || investorUser.username,
        });
      } catch {}
      markDone('Linking website access');

      // ── 8. Archive & lock the lead ───────────────────────────────────
      setCurrentStep('Archiving lead');
      await base44.entities.Lead.update(lead.id, {
        status:                    'converted',
        migratedToPortal:          true,
        convertedToInvestorUserId: investorUser.id,
        archivedAt:                new Date().toISOString(),
      });
      await base44.entities.LeadHistory.create({
        leadId:  lead.id,
        type:    'status_change',
        content: `✅ Fully migrated to CRM. Username: ${investorUser.username}. Score: ${lead.engagementScore || 0} pts. All history, appointments, emails, and site data transferred.`,
      });
      markDone('Archiving lead');

      // ── 9. Place in first pipeline stage ─────────────────────────────
      setCurrentStep('Placing in pipeline');
      try {
        const STAGE_KEY = 'prospect_pipeline_stages';
        const stageMap  = JSON.parse(localStorage.getItem(STAGE_KEY) || '{}');
        stageMap[investorUser.id] = 'reviewing';
        localStorage.setItem(STAGE_KEY, JSON.stringify(stageMap));
      } catch {}
      markDone('Placing in pipeline');

      setStep(2);
      onMigrated && onMigrated(investorUser);

    } catch (e) {
      setError('Migration failed: ' + (e.response?.data?.error || e.message));
      setStep(0);
    }
    setMigrating(false);
  };

  // ── CONFIRM ──────────────────────────────────────────────────────────────
  if (step === 0) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'540px', fontFamily:'Georgia, serif', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>

        <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>🚀 Migrate to Potential Investor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>

        <div style={{ padding:'24px' }}>

          {/* Who */}
          <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'20px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'14px 16px' }}>
            <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}44,${GOLD}22)`, border:`2px solid ${GOLD}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>
              {lead.firstName?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ color:'#e8e0d0', fontSize:'15px' }}>{lead.firstName} {lead.lastName}</div>
              <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'2px' }}>{lead.email}{lead.phone ? ` · ${lead.phone}` : ''}</div>
            </div>
          </div>

          {/* What migrates */}
          <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.18)', borderRadius:'4px', padding:'14px 16px', marginBottom:'20px' }}>
            <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Everything that will be migrated</div>
            {[
              ['📞', 'All calls, notes & status history'],
              ['✉️', 'Email logs (sent, opened, clicked)'],
              ['📅', 'Appointments & scheduled callbacks'],
              ['🌐', 'Consumer site visits & time on page'],
              ['💼', 'Investor site sessions & pages viewed'],
              ['🔑', 'Portal login (upgraded to full access)'],
              ['⭐', `Engagement score (${lead.engagementScore || 0} pts)`],
            ].map(([icon, label]) => (
              <div key={label} style={{ display:'flex', gap:'10px', alignItems:'center', padding:'4px 0', color:'#8a9ab8', fontSize:'12px' }}>
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>

          {/* After */}
          <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'4px', padding:'12px 16px', marginBottom:'20px', fontSize:'12px', color:'#8a9ab8', lineHeight:1.8 }}>
            <span style={{ color:'#60a5fa', fontWeight:'bold' }}>After migration: </span>
            Lead card becomes <strong style={{ color:'#f59e0b' }}>archived & read-only</strong>. Contact lands in <strong style={{ color:'#60a5fa' }}>Reviewing Info</strong> — the first stage of the pipeline — as a <strong style={{ color:'#a78bfa' }}>Potential Investor</strong>.
          </div>

          {/* Credentials */}
          <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'14px 16px', marginBottom:'20px' }}>
            <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Portal Credentials</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>Username</div>
                <div style={{ color:GOLD, fontFamily:'monospace', fontSize:'13px' }}>{existingUsername || `${lead.firstName?.toLowerCase()}****`}</div>
              </div>
              <div>
                <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>Password</div>
                <div style={{ color:'#e8e0d0', fontFamily:'monospace', fontSize:'13px' }}>{portalPassword}</div>
              </div>
            </div>
            {!existingUsername && (
              <div style={{ color:'#f59e0b', fontSize:'10px', marginTop:'8px' }}>
                ⚠️ No username yet — will be auto-generated from name + phone
              </div>
            )}
          </div>

          {error && <div style={{ color:'#ef4444', fontSize:'12px', marginBottom:'14px' }}>{error}</div>}

          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={handleMigrate}
              style={{ flex:1, background:'linear-gradient(135deg,#a78bfa,#7c3aed)', color:'#fff', border:'none', borderRadius:'2px', padding:'13px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
              🚀 Confirm Migration
            </button>
            <button onClick={onClose}
              style={{ padding:'13px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── MIGRATING ────────────────────────────────────────────────────────────
  if (step === 1) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'420px', padding:'32px', fontFamily:'Georgia, serif', boxShadow:'0 40px 100px rgba(0,0,0,0.9)' }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ width:'48px', height:'48px', border:`3px solid rgba(184,147,58,0.2)`, borderTop:`3px solid ${GOLD}`, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
          <div style={{ color:GOLD, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>Migrating…</div>
          <div style={{ color:'#6b7280', fontSize:'12px', marginTop:'6px' }}>{currentStep}</div>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {STEPS.map(s => <StepRow key={s} label={s} done={doneSteps.includes(s)} active={currentStep === s} />)}
        </div>
      </div>
    </div>
  );

  // ── DONE ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', width:'100%', maxWidth:'420px', padding:'40px', fontFamily:'Georgia, serif', textAlign:'center', boxShadow:'0 40px 100px rgba(0,0,0,0.9)' }}>
        <div style={{ fontSize:'56px', marginBottom:'16px' }}>✅</div>
        <h3 style={{ color:'#4ade80', fontFamily:'Georgia,serif', fontWeight:'normal', fontSize:'20px', margin:'0 0 10px' }}>Migration Complete</h3>
        <p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:'0 0 8px' }}>
          <strong style={{ color:'#e8e0d0' }}>{lead.firstName} {lead.lastName}</strong> is now a <strong style={{ color:'#a78bfa' }}>Potential Investor</strong> in your CRM.
        </p>
        <p style={{ color:'#6b7280', fontSize:'12px', margin:'0 0 28px' }}>
          Stage: <strong style={{ color:'#60a5fa' }}>Reviewing Info</strong> · Lead card archived & locked
        </p>
        <button onClick={onClose}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 36px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
          Done
        </button>
      </div>
    </div>
  );
}