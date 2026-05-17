/**
 * MockAdminDashboard — shown to the 'nbtech' demo user.
 * Displays a realistic-looking admin dashboard using only mock data.
 * No real leads, contacts, or investor data is accessible.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import { MOCK_LEADS, MOCK_INVESTORS } from '@/lib/mockData';

const LOGO = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png';
const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STAGE_COLORS = {
  reviewing: '#60a5fa',
  read:      '#a78bfa',
  callback:  '#f59e0b',
  preclose:  '#4ade80',
  load:      GOLD,
};

const STATUS_COLORS = {
  lead:               '#60a5fa',
  intro_email_sent:   '#f59e0b',
  opened_intro_email: '#4ade80',
  prospect:           '#a78bfa',
  not_available:      '#6b7280',
  callback_later:     '#a78bfa',
  not_interested:     '#ef4444',
  converted:          '#4ade80',
};

function LeadsView() {
  const [selectedLead, setSelectedLead] = useState(null);
  const [tab, setTab] = useState('all');

  const nbTechLeads = MOCK_LEADS.filter(l => l.leadType === 'nb_tech');
  const prospectLeads = MOCK_LEADS.filter(l => l.status === 'prospect');

  const visibleLeads = tab === 'nb_tech' ? nbTechLeads
    : tab === 'prospects' ? prospectLeads
    : MOCK_LEADS;

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '20px' }}>
        {[['all', `All Leads (${MOCK_LEADS.length})`], ['prospects', `Prospects (${prospectLeads.length})`], ['nb_tech', `NB Tech (${nbTechLeads.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: 'none', border: 'none', borderBottom: tab === id ? `2px solid ${GOLD}` : '2px solid transparent', color: tab === id ? GOLD : '#6b7280', padding: '10px 18px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visibleLeads.map(lead => (
          <div key={lead.id}
            onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
            style={{ background: selectedLead?.id === lead.id ? 'rgba(184,147,58,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedLead?.id === lead.id ? 'rgba(184,147,58,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(184,147,58,0.15)', border: `2px solid rgba(184,147,58,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', color: GOLD, flexShrink: 0 }}>
                  {lead.firstName[0]}{lead.lastName[0]}
                </div>
                <div>
                  <div style={{ color: '#e8e0d0', fontWeight: 'bold', fontSize: '14px' }}>
                    {lead.firstName} {lead.lastName}
                    {lead.leadType === 'nb_tech' && <span style={{ marginLeft: '6px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '3px', padding: '1px 6px', fontSize: '9px', fontWeight: 'bold' }}>NB</span>}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '11px' }}>{lead.city}, {lead.state} · {lead.phone}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: `${STATUS_COLORS[lead.status] || '#6b7280'}22`, color: STATUS_COLORS[lead.status] || '#6b7280', border: `1px solid ${STATUS_COLORS[lead.status] || '#6b7280'}44`, borderRadius: '12px', padding: '3px 10px', fontSize: '10px', letterSpacing: '0.5px' }}>
                  {lead.status.replace(/_/g, ' ')}
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${GOLD}`, background: `rgba(184,147,58,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>{lead.engagementScore}</span>
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {selectedLead?.id === lead.id && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {[
                  ['📧 Email', lead.email],
                  ['📞 Phone', lead.phone],
                  ['🏙 City', `${lead.city}, ${lead.state}`],
                  ['📅 Last Called', lead.lastCalledAt ? new Date(lead.lastCalledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'],
                  ['📊 Calls', `${lead.callAttempts} attempts`],
                  ['⏰ Best Time', lead.bestTimeToCall],
                  ['🎂 Age', lead.ageCategory],
                  ['🏁 Pipeline Stage', lead.leadPipelineStage?.replace(/_/g, ' ') || '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ color: '#4a5568', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px' }}>{value || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineView() {
  const STAGES = ['reviewing', 'read', 'callback', 'preclose', 'load'];
  const STAGE_LABELS = { reviewing: 'Reviewing', read: 'Read Info', callback: 'Call Back', preclose: 'Pre-Close', load: 'Load' };
  const [pipelineType, setPipelineType] = useState('prospect');

  const visibleLeads = MOCK_LEADS.filter(l =>
    l.leadPipelineOwner === 'nbtech' && (pipelineType === 'nb_tech' ? l.leadType === 'nb_tech' : l.status === 'prospect' && l.leadType !== 'nb_tech')
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[['prospect', '🚀 Prospect Pipeline'], ['nb_tech', '💡 NB Tech Pipeline']].map(([id, label]) => (
          <button key={id} onClick={() => setPipelineType(id)}
            style={{ background: pipelineType === id ? (id === 'nb_tech' ? 'rgba(99,102,241,0.2)' : 'rgba(167,139,250,0.15)') : 'rgba(255,255,255,0.04)', border: `1px solid ${pipelineType === id ? (id === 'nb_tech' ? 'rgba(99,102,241,0.5)' : 'rgba(167,139,250,0.4)') : 'rgba(255,255,255,0.1)'}`, color: pipelineType === id ? (id === 'nb_tech' ? '#818cf8' : '#a78bfa') : '#6b7280', borderRadius: '4px', padding: '5px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: pipelineType === id ? 'bold' : 'normal' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', alignItems: 'start' }}>
        {STAGES.map(stageId => {
          const color = STAGE_COLORS[stageId] || GOLD;
          const cards = visibleLeads.filter(l => (l.leadPipelineStage || 'reviewing') === stageId);
          return (
            <div key={stageId} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', minHeight: '300px' }}>
              <div style={{ padding: '10px 10px 8px', borderBottom: `2px solid ${color}44` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>{STAGE_LABELS[stageId]}</span>
                  <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>{cards.length}</span>
                </div>
              </div>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {cards.map(lead => (
                  <div key={lead.id} style={{ background: '#0d1b2a', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: '4px', padding: '9px 10px' }}>
                    <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>
                      {lead.firstName} {lead.lastName}
                      {lead.leadType === 'nb_tech' && <span style={{ marginLeft: '4px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', borderRadius: '3px', padding: '0 4px', fontSize: '8px' }}>NB</span>}
                    </div>
                    {lead.phone && <div style={{ color: '#60a5fa', fontSize: '10px', fontFamily: 'monospace', marginTop: '3px' }}>📞 {lead.phone}</div>}
                    <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '3px' }}>{lead.city}, {lead.state}</div>
                  </div>
                ))}
                {cards.length === 0 && (
                  <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', padding: '20px 6px', fontStyle: 'italic', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '4px' }}>Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InvestorsView() {
  return (
    <div>
      <h3 style={{ color: '#e8e0d0', fontWeight: 'normal', fontSize: '16px', margin: '0 0 16px' }}>Potential Investors</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {MOCK_INVESTORS.map(inv => (
          <div key={inv.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: inv.status === 'investor' ? 'rgba(74,222,128,0.15)' : 'rgba(167,139,250,0.15)', border: `2px solid ${inv.status === 'investor' ? '#4ade80' : '#a78bfa'}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: inv.status === 'investor' ? '#4ade80' : '#a78bfa', flexShrink: 0 }}>
                {inv.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div style={{ color: '#e8e0d0', fontWeight: 'bold', fontSize: '14px' }}>{inv.name}</div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>{inv.email} {inv.company ? `· ${inv.company}` : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: inv.status === 'investor' ? 'rgba(74,222,128,0.12)' : 'rgba(167,139,250,0.12)', color: inv.status === 'investor' ? '#4ade80' : '#a78bfa', fontSize: '10px', padding: '3px 10px', borderRadius: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {inv.status === 'investor' ? '✅ Investor' : '🔷 Potential Investor'}
              </span>
              {inv.investmentAmount && (
                <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '13px' }}>${Number(inv.investmentAmount).toLocaleString()}</span>
              )}
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${GOLD}`, background: `rgba(184,147,58,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>{inv.engagementScore}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MockAdminDashboard() {
  const { portalUser, portalLogout } = usePortalAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('leads');

  const VIEWS = [
    { id: 'leads', label: 'Leads' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'crm', label: 'CRM / Clients' },
  ];

  const stats = [
    { label: 'Leads', value: MOCK_LEADS.length, icon: '🎯', color: '#60a5fa' },
    { label: 'Prospects', value: MOCK_LEADS.filter(l => l.status === 'prospect').length, icon: '⭐', color: '#a78bfa' },
    { label: 'NB Tech', value: MOCK_LEADS.filter(l => l.leadType === 'nb_tech').length, icon: '💡', color: '#818cf8' },
    { label: 'Investors', value: MOCK_INVESTORS.filter(i => i.status === 'investor').length, icon: '✅', color: '#4ade80' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#060c18', fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      {/* Nav */}
      <nav style={{ background: DARK, borderBottom: '1px solid rgba(184,147,58,0.2)', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px', gap: '8px' }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <img src={LOGO} alt="Rosie AI" style={{ height: '28px', width: 'auto' }} />
            <div style={{ width: '1px', height: '16px', background: 'rgba(184,147,58,0.3)' }} />
            <span style={{ color: GOLD, fontSize: '8px', letterSpacing: '3px', textTransform: 'uppercase' }}>Admin Dashboard</span>
          </div>
          {/* Center: KPI strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', flex: 1, justifyContent: 'center' }}>
            {stats.map(({ label, value, icon, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                <span style={{ fontSize: '11px' }}>{icon}</span>
                <div>
                  <div style={{ color, fontSize: '13px', fontWeight: 'bold', lineHeight: 1.1 }}>{value}</div>
                  <div style={{ color: '#4a5568', fontSize: '7px', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Right */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#4a5568', fontSize: '11px', marginRight: '4px' }}>👤 {portalUser?.name}</span>
            <button onClick={() => { portalLogout(); navigate('/'); }} style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px' }}>Logout</button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', scrollbarWidth: 'none' }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ background: 'none', border: 'none', borderBottom: view === v.id ? `2px solid ${GOLD}` : '2px solid transparent', color: view === v.id ? GOLD : '#6b7280', padding: '10px 18px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 0.15s' }}>
              {v.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Mock data notice */}
      <div style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px' }}>💡</span>
        <span style={{ color: '#818cf8', fontSize: '11px', letterSpacing: '0.5px' }}>NB Tech Demo — displaying sample data only</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 32px' }}>
        {view === 'leads'    && <LeadsView />}
        {view === 'pipeline' && <PipelineView />}
        {view === 'crm'      && <InvestorsView />}
      </div>
    </div>
  );
}