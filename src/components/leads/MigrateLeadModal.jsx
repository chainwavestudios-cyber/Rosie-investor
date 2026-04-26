import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

export default function MigrateLeadModal({ lead, history, onClose, onMigrated }) {
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState('');

  // Username already generated from email/access tab
  const existingUsername = lead.portalPasscode || '';
  const lastNameSlug = (lead.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  const portalPassword = `${lastNameSlug}#2026`;

  const handleMigrate = async () => {
    setMigrating(true); setError('');
    try {
      let investorUser = null;

      // 1. Find existing InvestorUser (created when email was sent or access tab used)
      if (existingUsername) {
        const existing = await base44.entities.InvestorUser.filter({ username: existingUsername });
        if (existing?.length > 0) {
          // Upgrade existing info-site user to portal access
          await base44.entities.InvestorUser.update(existing[0].id, {
            siteAccess:     'portal',
            role:           'investor',
            status:         'prospect',
            phone:          lead.phone || existing[0].phone || '',
            state:          lead.state || existing[0].state || '',
            engagementScore: lead.engagementScore || 0,
            portalPasscode: existingUsername,
            leadId:         lead.id,
          });
          investorUser = { ...existing[0], siteAccess: 'portal' };
        }
      }

      // 2. If no existing user, create one with portal access
      if (!investorUser) {
        const nameSlug = (lead.firstName || 'user').toLowerCase().replace(/[^a-z]/g, '');
        const last4 = (lead.phone || '').replace(/\D/g, '').slice(-4) || '0000';
        const newUsername = `${nameSlug}${last4}`;

        investorUser = await base44.entities.InvestorUser.create({
          name:           `${lead.firstName} ${lead.lastName}`,
          username:       newUsername,
          email:          (lead.email || '').toLowerCase(),
          password:       portalPassword,
          phone:          lead.phone || '',
          state:          lead.state || '',
          notes:          lead.notes || '',
          role:           'investor',
          status:         'prospect',
          siteAccess:     'portal',
          investmentType: 'cash',
          engagementScore: lead.engagementScore || 0,
          portalPasscode: newUsername,
          leadId:         lead.id,
          starRating:     0,
        });
      }

      // 3. Migrate all lead history → ContactNotes in admin History tab
      for (const h of (history || [])) {
        try {
          // Map lead history types to contact note types
          const noteType = (() => {
            if (['call', 'connected'].includes(h.type)) return 'call';
            if (h.type === 'sms') return 'sms';
            if (h.type === 'email' || (h.content || '').includes('Email sent')) return 'email';
            return 'note';
          })();
          // Format the label for clarity
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

      // 4. Mark lead as archived/migrated — no longer editable
      await base44.entities.Lead.update(lead.id, {
        status:                  'converted',
        migratedToPortal:        true,
        convertedToInvestorUserId: investorUser.id,
      });

      // 5. Log migration
      await base44.entities.LeadHistory.create({
        leadId:  lead.id,
        type:    'status_change',
        content: `✅ Migrated to CRM as Potential Investor. Username: ${investorUser.username}. Score: ${lead.engagementScore || 0} pts.`,
      });

      // 6. Pipeline stage
      try {
        const STAGE_KEY = 'prospect_pipeline_stages';
        const stageMap = JSON.parse(localStorage.getItem(STAGE_KEY) || '{}');
        stageMap[investorUser.id] = 'reviewing';
        localStorage.setItem(STAGE_KEY, JSON.stringify(stageMap));
      } catch {}

      onMigrated && onMigrated(investorUser);
    } catch (e) {
      setError('Migration failed: ' + (e.response?.data?.error || e.message));
    }
    setMigrating(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'520px', fontFamily:'Georgia, serif', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>🚀 Migrate to Potential Investor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>

        <div style={{ padding:'24px' }}>
          {/* Summary */}
          <div style={{ background:'rgba(184,147,58,0.07)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'4px', padding:'14px 16px', marginBottom:'20px' }}>
            <div style={{ color:GOLD, fontSize:'12px', fontWeight:'bold', marginBottom:'8px' }}>Migration Summary for {lead.firstName} {lead.lastName}</div>
            <ul style={{ margin:0, padding:'0 0 0 16px', color:'#8a9ab8', fontSize:'12px', lineHeight:2 }}>
              <li>All history, notes, and calls will be migrated to their CRM card</li>
              <li>Website tracking (investors site + consumer site) continues</li>
              <li>Lead will be <strong style={{ color:'#f59e0b' }}>archived</strong> and no longer editable in Leads</li>
              <li>Portal access will be <strong style={{ color:'#4ade80' }}>activated</strong></li>
            </ul>
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
                ⚠️ No username found — a new one will be auto-generated from their name and phone number
              </div>
            )}
          </div>

          {error && <div style={{ color:'#ef4444', fontSize:'12px', marginBottom:'14px' }}>{error}</div>}

          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={handleMigrate} disabled={migrating}
              style={{ flex:1, background:'linear-gradient(135deg,#a78bfa,#7c3aed)', color:'#fff', border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
              {migrating ? 'Migrating…' : '🚀 Confirm Migration'}
            </button>
            <button onClick={onClose}
              style={{ padding:'12px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}