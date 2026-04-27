import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const INVESTORS_SITE = 'https://investors.rosieai.tech';

const STEPS = [
  'Creating CRM account',
  'Migrating call & note history',
  'Migrating email logs',
  'Migrating appointments',
  'Migrating site visits',
  'Archiving lead',
  'Sending portal access email',
];

function StepRow({ done, active, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'5px 0' }}>
      <div style={{ width:'20px', height:'20px', borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', background: done ? '#4ade80' : active ? GOLD : 'rgba(255,255,255,0.08)', border:`2px solid ${done ? '#4ade80' : active ? GOLD : 'rgba(255,255,255,0.15)'}`, color: done ? DARK : GOLD }}>
        {done ? '✓' : active ? '·' : ''}
      </div>
      <span style={{ color: done ? '#4ade80' : active ? GOLD : '#4a5568', fontSize:'12px' }}>{label}</span>
    </div>
  );
}

export default function MigrateLeadModal({ lead, history, onClose, onMigrated }) {
  const [error, setError]               = useState('');
  const [step, setStep]                 = useState(0);
  const [currentStep, setCurrentStep]   = useState('');
  const [doneSteps, setDoneSteps]       = useState([]);

  const nameSlug   = (lead.firstName || 'user').toLowerCase().replace(/[^a-z]/g, '');
  const last4      = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
  const lastSlug   = (lead.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  const username   = lead.portalPasscode || `${nameSlug}${last4}`;
  const password   = `${lastSlug}#2026`;
  const loginUrl   = `${INVESTORS_SITE}/portal-login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const mark = (label) => setDoneSteps(prev => [...prev, label]);

  const hashPw = async (pw) => {
    try {
      const salt = crypto.randomUUID().replace(/-/g, '');
      const enc  = new TextEncoder();
      const buf  = await crypto.subtle.digest('SHA-256', enc.encode(salt + pw));
      const hex  = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      return salt + ':' + hex;
    } catch { return pw; }
  };

  const run = async () => {
    setStep(1); setError(''); setDoneSteps([]);

    try {
      // ── 1. Create or update InvestorUser ─────────────────────────────
      setCurrentStep('Creating CRM account');
      let iu = null;

      // Try to find existing by username — if found, preserve all data (no password overwrite)
      try {
        const existing = await base44.entities.InvestorUser.filter({ username });
        if (existing?.length > 0) {
          iu = existing[0];
          console.log('[MigrateLeadModal] Existing InvestorUser found — preserving all data.');
        }
      } catch {}

      // Create fresh if none found
      if (!iu) {
        const hashed = await hashPw(password);
        iu = await base44.entities.InvestorUser.create({
          name:            `${lead.firstName} ${lead.lastName}`,
          username,
          password: hashed,
          email:           (lead.email || '').toLowerCase(),
          phone:           lead.phone   || '',
          address:         lead.address || '',
          notes:           lead.notes   || '',
          role:            'investor',
          status:          'prospect',
          pipelineStage:   'reviewing',
          investmentType:  'cash',
          engagementScore: lead.engagementScore || 0,
          starRating:      0,
          leadId:          lead.id,
          migratedAt:      new Date().toISOString(),
          lastActivityAt:  new Date().toISOString(),
        });
      }
      mark('Creating CRM account');

      // ── 2. Migrate LeadHistory → ContactNotes ─────────────────────────
      setCurrentStep('Migrating call & note history');
      const allHistory = history?.length
        ? history
        : await base44.entities.LeadHistory.filter({ leadId: lead.id }).catch(() => []);

      for (const h of (allHistory || [])) {
        try {
          const noteType = ['call','connected'].includes(h.type) ? 'call'
            : h.type === 'sms' ? 'sms'
            : h.type === 'voicemail' ? 'voicemail'
            : (h.type === 'email' || (h.content||'').includes('Email sent')) ? 'email'
            : 'note';
          const label = (h.type||'note').replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
          await base44.entities.ContactNote.create({
            investorId:    iu.id,
            investorEmail: iu.email,
            type:          noteType,
            content:       `[Lead History · ${label}] ${h.content || ''}`,
            createdAt:     h.created_date,
            createdBy:     h.createdBy || 'admin',
          });
        } catch {}
      }
      mark('Migrating call & note history');

      // ── 3. Migrate EmailLogs ───────────────────────────────────────────
      setCurrentStep('Migrating email logs');
      try {
        const logs = await base44.entities.EmailLog.filter({ leadId: lead.id });
        for (const log of (logs||[])) {
          try {
            await base44.entities.EmailLog.update(log.id, { investorId: iu.id });
            await base44.entities.ContactNote.create({
              investorId:    iu.id,
              investorEmail: iu.email,
              type:          'email',
              content:       `[Email Log] ${log.status}${log.openedAt?' · Opened '+new Date(log.openedAt).toLocaleDateString():''}`,
              createdAt:     log.sentAt,
              createdBy:     log.sentBy || 'admin',
            });
          } catch {}
        }
      } catch {}
      mark('Migrating email logs');

      // ── 4. Migrate Appointments ────────────────────────────────────────
      setCurrentStep('Migrating appointments');
      try {
        const appts = await base44.entities.Appointment.filter({ investorId: lead.id }).catch(()=>[]);
        for (const a of (appts||[])) {
          try {
            await base44.entities.Appointment.update(a.id, { investorId: iu.id, investorEmail: iu.email, investorName: iu.name });
            await base44.entities.ContactNote.create({
              investorId:    iu.id,
              investorEmail: iu.email,
              type:          'note',
              content:       `[Appointment] ${a.title||''} · ${a.type||''} · ${a.scheduledAt?new Date(a.scheduledAt).toLocaleString():''} · ${a.status||'scheduled'}`,
              createdAt:     a.scheduledAt,
              createdBy:     'admin',
            });
          } catch {}
        }
      } catch {}
      mark('Migrating appointments');

      // ── 5. Migrate SiteVisits ──────────────────────────────────────────
      setCurrentStep('Migrating site visits');
      try {
        const visits = await base44.entities.SiteVisit.filter({ leadId: lead.id }).catch(()=>[]);
        for (const v of (visits||[])) {
          try { await base44.entities.SiteVisit.update(v.id, { investorId: iu.id }); } catch {}
        }
        if (visits?.length > 0) {
          const mins = Math.round(visits.reduce((s,v)=>s+(v.timeOnPage||0),0)/60);
          await base44.entities.ContactNote.create({
            investorId:    iu.id,
            investorEmail: iu.email,
            type:          'note',
            content:       `[Site Visits] ${visits.length} visits · ${mins}m total`,
            createdAt:     new Date().toISOString(),
            createdBy:     'system',
          });
        }
      } catch {}
      mark('Migrating site visits');

      // ── 6. Archive lead ────────────────────────────────────────────────
      setCurrentStep('Archiving lead');
      await base44.entities.Lead.update(lead.id, {
        status:                    'converted',
        migratedToPortal:          true,
        convertedToInvestorUserId: iu.id,
      });
      await base44.entities.LeadHistory.create({
        leadId:  lead.id,
        type:    'status_change',
        content: `✅ Migrated to CRM. Username: ${username}. Pipeline: Reviewing Info.`,
      });
      await base44.entities.ContactNote.create({
        investorId:    iu.id,
        investorEmail: iu.email,
        type:          'note',
        content:       `✅ Migrated from lead pipeline into Reviewing Info stage. Engagement: ${lead.engagementScore||0} pts.`,
        createdAt:     new Date().toISOString(),
        createdBy:     'system',
      });
      mark('Archiving lead');

      // ── 7. Send portal access email ────────────────────────────────────
      setCurrentStep('Sending portal access email');
      try {
        await base44.functions.invoke('sendPortalAccessEmail', {
          leadId:    lead.id,
          investorId: iu.id,
          toEmail:   lead.email,
          toName:    `${lead.firstName} ${lead.lastName}`,
          firstName: lead.firstName,
          username,
          password,
          loginUrl,
        });
        // Log to lead history
        await base44.entities.LeadHistory.create({
          leadId:  lead.id,
          type:    'note',
          content: `📧 Portal access email sent. Username: ${username}`,
        }).catch(() => {});
      } catch (emailErr) {
        console.warn('Portal email failed (non-fatal):', emailErr);
      }
      mark('Sending portal access email');

      setStep(2);
      onMigrated && onMigrated(iu);

    } catch (e) {
      console.error('Migration error:', e);
      setError('Migration failed: ' + (e?.message || String(e)));
      setStep(0);
    }
  };

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  if (step === 0) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'520px', fontFamily:'Georgia, serif', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>

        <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>🚀 Migrate to Potential Investor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>

        <div style={{ padding:'22px' }}>
          {/* Contact */}
          <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'18px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'12px 14px' }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:`linear-gradient(135deg,${GOLD}44,${GOLD}22)`, border:`2px solid ${GOLD}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
              {lead.firstName?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ color:'#e8e0d0', fontSize:'14px' }}>{lead.firstName} {lead.lastName}</div>
              <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'2px' }}>{lead.email}{lead.phone ? ` · ${lead.phone}` : ''}</div>
            </div>
          </div>

          {/* What migrates */}
          <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.18)', borderRadius:'4px', padding:'12px 14px', marginBottom:'14px' }}>
            <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>What migrates</div>
            {[['📞','All calls, notes & history'],['✉️','Email logs'],['📅','Appointments'],['🌐','Site visits'],['🔑','Full portal access granted'],['⭐',`Engagement score (${lead.engagementScore||0} pts)`]].map(([icon,label])=>(
              <div key={label} style={{ display:'flex', gap:'8px', alignItems:'center', padding:'3px 0', color:'#8a9ab8', fontSize:'12px' }}>
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>

          {/* Credentials */}
          <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'12px 14px', marginBottom:'14px' }}>
            <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Portal credentials (emailed on confirm)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>Username</div>
                <div style={{ color:GOLD, fontFamily:'monospace', fontSize:'13px' }}>{username}</div>
              </div>
              <div>
                <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>Password</div>
                <div style={{ color:'#e8e0d0', fontFamily:'monospace', fontSize:'13px' }}>{password}</div>
              </div>
            </div>
          </div>

          {/* After */}
          <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'4px', padding:'10px 14px', marginBottom:'18px', fontSize:'11px', color:'#8a9ab8', lineHeight:1.7 }}>
            Lead archived & locked · Placed in <strong style={{ color:'#60a5fa' }}>Reviewing Info</strong> pipeline · Portal credentials emailed automatically
          </div>

          {error && (
            <div style={{ color:'#ef4444', fontSize:'12px', marginBottom:'14px', padding:'8px 12px', background:'rgba(239,68,68,0.08)', borderRadius:'4px', border:'1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={run}
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

  // ── MIGRATING ──────────────────────────────────────────────────────────────
  if (step === 1) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'400px', padding:'32px', fontFamily:'Georgia, serif' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ width:'44px', height:'44px', border:`3px solid rgba(184,147,58,0.2)`, borderTop:`3px solid ${GOLD}`, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 14px' }} />
          <div style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Migrating</div>
          <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'4px' }}>{currentStep}</div>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {STEPS.map(s => <StepRow key={s} label={s} done={doneSteps.includes(s)} active={currentStep===s} />)}
        </div>
      </div>
    </div>
  );

  // ── DONE ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', width:'100%', maxWidth:'400px', padding:'40px', fontFamily:'Georgia, serif', textAlign:'center' }}>
        <div style={{ fontSize:'52px', marginBottom:'14px' }}>✅</div>
        <h3 style={{ color:'#4ade80', fontWeight:'normal', fontSize:'19px', margin:'0 0 10px' }}>Migration Complete</h3>
        <p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:'0 0 6px' }}>
          <strong style={{ color:'#e8e0d0' }}>{lead.firstName} {lead.lastName}</strong> is now a <strong style={{ color:'#a78bfa' }}>Potential Investor</strong>.
        </p>
        <p style={{ color:'#6b7280', fontSize:'12px', margin:'0 0 6px' }}>Stage: <strong style={{ color:'#60a5fa' }}>Reviewing Info</strong></p>
        <p style={{ color:'#6b7280', fontSize:'12px', margin:'0 0 26px' }}>📧 Portal access email sent to <strong style={{ color:'#e8e0d0' }}>{lead.email}</strong></p>
        <button onClick={onClose}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'11px 32px', cursor:'pointer', fontWeight:'700', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>
          Done
        </button>
      </div>
    </div>
  );
}