import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

export default function MigrateLeadModal({ lead, history, onClose, onMigrated }) {
  const [username, setUsername] = useState(
    `${lead.firstName.toLowerCase().replace(/\s/g,'')}${lead.lastName.toLowerCase().replace(/\s/g,'')}`
  );
  const [password, setPassword] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState('');

  const handleMigrate = async () => {
    if (!username.trim() || !password.trim()) { setError('Username and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setMigrating(true); setError('');

    try {
      // 1. Create the InvestorUser record (migrate score + badges)
      const newUser = await base44.entities.InvestorUser.create({
        name: `${lead.firstName} ${lead.lastName}`,
        username: username.trim().toLowerCase(),
        email: (lead.email || '').toLowerCase(),
        password: password.trim(),
        phone: lead.phone || '',
        state: lead.state || '',
        notes: lead.notes || '',
        role: 'investor',
        status: 'prospect',
        investmentType: 'cash',
        engagementScore: lead.engagementScore || 0,
        starRating: 0,
      });

      // 2. Migrate all lead history → ContactNotes on the new user
      for (const h of (history || [])) {
        try {
          await base44.entities.ContactNote.create({
            investorId: newUser.id,
            investorEmail: newUser.email,
            type: ['call'].includes(h.type) ? 'call' : 'note',
            content: `[Migrated from Leads] ${h.content || ''}`,
            createdAt: h.created_date,
            createdBy: h.createdBy || 'admin',
          });
        } catch {}
      }

      // 3. Mark lead as converted
      await base44.entities.Lead.update(lead.id, {
        status: 'converted',
        convertedToInvestorUserId: newUser.id,
      });

      // 4. Log final migration note
      await base44.entities.LeadHistory.create({
        leadId: lead.id,
        type: 'status_change',
        content: `Migrated to CRM as Potential Investor. Portal username: ${username.trim().toLowerCase()}. Score migrated: ${lead.engagementScore || 0} pts.`,
      });

      // 5. Place in first pipeline stage ('reviewing') via localStorage
      try {
        const STAGE_KEY = 'prospect_pipeline_stages';
        const stageMap = JSON.parse(localStorage.getItem(STAGE_KEY) || '{}');
        stageMap[newUser.id] = 'reviewing';
        localStorage.setItem(STAGE_KEY, JSON.stringify(stageMap));
      } catch {}

      onMigrated && onMigrated(newUser);
    } catch (e) {
      setError('Migration failed: ' + (e.response?.data?.error || e.message));
    }
    setMigrating(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10001, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.4)', borderRadius:'4px', width:'100%', maxWidth:'520px', boxShadow:'0 40px 120px rgba(0,0,0,0.9)', fontFamily:'Georgia, serif' }}>

        {/* Header */}
        <div style={{ padding:'24px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.2)' }}>
          <div>
            <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'3px', textTransform:'uppercase', marginBottom:'6px' }}>Migrate Lead → CRM</div>
            <div style={{ color:'#e8e0d0', fontSize:'18px' }}>{lead.firstName} {lead.lastName}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px' }}>×</button>
        </div>

        <div style={{ padding:'28px' }}>
          {/* Info banner */}
          <div style={{ background:'rgba(184,147,58,0.08)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'2px', padding:'16px', marginBottom:'24px' }}>
            <div style={{ color:GOLD, fontSize:'11px', letterSpacing:'1px', marginBottom:'6px' }}>What will happen:</div>
            <ul style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:2, margin:0, paddingLeft:'16px' }}>
              <li>A new <strong style={{ color:'#e8e0d0' }}>Potential Investor</strong> will be created in CRM/Clients</li>
              <li>All lead history &amp; notes will be migrated to their contact card</li>
              <li>They will receive a portal login with the credentials below</li>
              <li>The lead will be marked as converted in the Leads tab</li>
              <li>Engagement score (<strong style={{ color: GOLD }}>{lead.engagementScore || 0} pts</strong>) will carry over to CRM</li>
              <li>They will be placed in the <strong style={{ color: '#60a5fa' }}>Reviewing Info</strong> stage of the pipeline</li>
            </ul>
          </div>

          {/* Contact summary */}
          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'2px', padding:'14px 16px', marginBottom:'20px', display:'flex', gap:'16px', flexWrap:'wrap' }}>
            {[['Name', `${lead.firstName} ${lead.lastName}`], ['Email', lead.email||'—'], ['Phone', lead.phone||'—'], ['State', lead.state||'—']].map(([l,v]) => (
              <div key={l}><div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'2px' }}>{l}</div><div style={{ color:'#c4cdd8', fontSize:'13px' }}>{v}</div></div>
            ))}
          </div>

          {/* Portal credentials */}
          <div style={{ marginBottom:'16px' }}>
            <label style={ls}>Portal Username</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="portal-username" style={inp} />
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={ls}>Portal Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Set a strong password" style={inp} />
          </div>

          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'2px', padding:'10px 14px', color:'#ff8a8a', fontSize:'13px', marginBottom:'16px' }}>{error}</div>
          )}

          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={handleMigrate} disabled={migrating} style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'13px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
              {migrating ? 'Migrating…' : '🚀 Migrate to CRM'}
            </button>
            <button onClick={onClose} style={{ padding:'13px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}