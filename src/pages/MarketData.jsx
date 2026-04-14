import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LOGO = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png';
const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const DARKER = '#060c18';

const maDeals = [
  { acquirer:'Salesforce',   target:'Slack',       year:'2021', value:'$27.7B',      sector:'SaaS / Collaboration',  multiple:'26x ARR' },
  { acquirer:'Microsoft',    target:'Nuance',       year:'2021', value:'$19.7B',      sector:'AI Voice / NLP',         multiple:'10x ARR' },
  { acquirer:'Adobe',        target:'Figma',        year:'2022', value:'$20B',        sector:'SaaS / Design',          multiple:'50x ARR' },
  { acquirer:'ServiceNow',   target:'Intellibot',   year:'2021', value:'$1.35B',      sector:'AI Automation',          multiple:'12x ARR' },
  { acquirer:'Zoom',         target:'Kites',        year:'2021', value:'Undisclosed', sector:'AI Voice',               multiple:'N/A' },
  { acquirer:'Twilio',       target:'Segment',      year:'2020', value:'$3.2B',       sector:'Data / SaaS',            multiple:'12x ARR' },
  { acquirer:'Salesforce',   target:'Tableau',      year:'2019', value:'$15.7B',      sector:'Data Analytics',         multiple:'8x ARR' },
  { acquirer:'Google',       target:'Looker',       year:'2020', value:'$2.6B',       sector:'Business Intelligence',  multiple:'10x ARR' },
];

const comparables = [
  { company:'Gong.io',       type:'Revenue Intelligence AI',   arr:'$300M+',  valuation:'$7.25B',    multiple:'24x',       stage:'Late Stage' },
  { company:'Chorus.ai',     type:'Conversation Intelligence', arr:'$50M',    valuation:'$575M',     multiple:'11.5x',     stage:'Acquired by ZoomInfo' },
  { company:'Outreach.io',   type:'Sales Engagement AI',       arr:'$220M',   valuation:'$4.4B',     multiple:'20x',       stage:'Late Stage' },
  { company:'Salesloft',     type:'Revenue Workflow AI',       arr:'$200M+',  valuation:'$2.3B',     multiple:'11.5x',     stage:'Late Stage' },
  { company:'Drift',         type:'Conversational Marketing',  arr:'$100M+',  valuation:'$1B',       multiple:'10x',       stage:'Acquired by Salesloft' },
  { company:'Dialpad',       type:'AI Business Communications',arr:'$200M+',  valuation:'$2.2B',     multiple:'11x',       stage:'Late Stage' },
  { company:'Rosie AI',      type:'AI Voice Agent Platform',   arr:'$380K',   valuation:'$15M (Cap)',multiple:'39x (Cap)', stage:'🔵 Current Round' },
];

const trends = [
  { title:'AI Voice Market Size',        stat:'$40B by 2032',   desc:'Growing at 38.46% CAGR, driven by enterprise automation demand across sales, support, and customer success.' },
  { title:'SaaS M&A Multiples',          stat:'10–50x ARR',     desc:'Premium multiples paid for AI-native platforms versus traditional SaaS, with voice and NLP commanding the highest premiums.' },
  { title:'Sales Automation Adoption',   stat:'68% of enterprise', desc:'Large enterprises using AI tools in their SDR workflow as of 2024, up from 21% in 2021.' },
  { title:'AI SDR Cost Advantage',       stat:'15x cheaper',    desc:'AI voice agents vs. human SDR in equivalent qualified pipeline generation, driving rapid enterprise adoption.' },
  { title:'Conversational AI Funding',   stat:'$4.5B in 2023',  desc:'Global VC investment into conversational AI startups, a 3x increase from 2020 levels.' },
  { title:'Voice Search & Engagement',   stat:'1B+ voice queries/day', desc:'Daily voice-based searches and interactions globally, reflecting consumer comfort with voice-first interfaces.' },
];

export default function MarketData() {
  const [activeView, setActiveView] = useState('overview');
  const navigate = useNavigate();

  const views = [
    ['overview',  'Overview'],
    ['ma',        'M&A Transactions'],
    ['comp',      'Comparable Companies'],
    ['trends',    'Market Trends'],
  ];

  return (
    <div style={{ minHeight:'100vh', background:DARKER, fontFamily:'Georgia, serif', color:'#e8e0d0' }}>

      {/* Nav */}
      <nav style={{ background:DARK, borderBottom:'1px solid rgba(184,147,58,0.2)', padding:'0 40px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'64px', position:'sticky', top:0, zIndex:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <img src={LOGO} alt="Rosie AI" style={{ height:'38px', cursor:'pointer' }} onClick={() => navigate('/')} />
          <div style={{ width:'1px', height:'24px', background:'rgba(184,147,58,0.3)' }} />
          <span style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase' }}>Market Analysis</span>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={() => navigate('/')} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'7px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>← Back</button>
          <button onClick={() => navigate('/portal-login')} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'7px 18px', cursor:'pointer', fontSize:'11px', fontWeight:'700', letterSpacing:'2px', textTransform:'uppercase' }}>🔐 Investor Portal</button>
        </div>
      </nav>

      {/* Sub-nav tabs */}
      <div style={{ background:DARK, borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 40px', display:'flex', gap:'0', overflowX:'auto' }}>
        {views.map(([id, label]) => (
          <button key={id} onClick={() => setActiveView(id)}
            style={{ background:'none', border:'none', borderBottom:activeView===id?`2px solid ${GOLD}`:'2px solid transparent', color:activeView===id?GOLD:'#6b7280', padding:'15px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'1px', whiteSpace:'nowrap', fontFamily:'Georgia, serif' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'56px 40px' }}>

        {/* OVERVIEW */}
        {activeView === 'overview' && (
          <div>
            <p style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase', margin:'0 0 12px' }}>Competitive Landscape</p>
            <h1 style={{ color:'#e8e0d0', fontSize:'36px', fontWeight:'normal', margin:'0 0 16px', lineHeight:1.2 }}>AI Voice & Revenue<br />Intelligence Market</h1>
            <p style={{ color:'#6b7280', fontSize:'15px', lineHeight:1.7, maxWidth:'620px', margin:'0 0 56px' }}>
              A comprehensive analysis of the AI voice agent and sales automation market — covering M&A activity, comparable company valuations, and the macro trends driving adoption.
            </p>

            {/* Stat hero row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'20px', marginBottom:'56px' }}>
              {[
                { stat:'$40B', label:'AI Voice Market by 2032', sub:'38.46% CAGR', color:GOLD },
                { stat:'39x',  label:'Rosie AI Valuation Cap Multiple', sub:'vs. $380K ARR', color:'#4ade80' },
                { stat:'15x',  label:'Cost Advantage vs. Human SDR', sub:'in qualified pipeline', color:'#60a5fa' },
              ].map(({ stat, label, sub, color }) => (
                <div key={label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'32px 28px' }}>
                  <div style={{ color, fontSize:'44px', fontWeight:'bold', marginBottom:'8px', lineHeight:1 }}>{stat}</div>
                  <div style={{ color:'#e8e0d0', fontSize:'14px', marginBottom:'4px' }}>{label}</div>
                  <div style={{ color:'#4a5568', fontSize:'11px', letterSpacing:'1px' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Quick nav cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>
              {[
                { id:'ma',     icon:'🤝', title:'M&A Transactions', desc:'8 landmark acquisitions including Salesforce/Slack, Microsoft/Nuance, and Adobe/Figma — establishing the valuation floor for AI-native platforms.' },
                { id:'comp',   icon:'📊', title:'Comparable Companies', desc:'Direct peer comparisons across ARR, valuation, and revenue multiples — situating Rosie AI within the competitive landscape.' },
                { id:'trends', icon:'📈', title:'Market Trends', desc:'Six key macro tailwinds driving AI voice adoption across enterprise sales, customer success, and marketing automation.' },
              ].map(({ id, icon, title, desc }) => (
                <button key={id} onClick={() => setActiveView(id)}
                  style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'24px', textAlign:'left', cursor:'pointer', color:'inherit', display:'flex', flexDirection:'column', gap:'10px', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(184,147,58,0.35)'; e.currentTarget.style.background='rgba(184,147,58,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.background='rgba(255,255,255,0.02)'; }}>
                  <span style={{ fontSize:'28px' }}>{icon}</span>
                  <div style={{ color:GOLD, fontSize:'14px', fontWeight:'bold' }}>{title}</div>
                  <div style={{ color:'#5a6a7e', fontSize:'12px', lineHeight:1.6 }}>{desc}</div>
                  <div style={{ color:GOLD, fontSize:'12px', marginTop:'4px' }}>View analysis →</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* M&A TRANSACTIONS */}
        {activeView === 'ma' && (
          <div>
            <p style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase', margin:'0 0 10px' }}>Precedent Transactions</p>
            <h2 style={{ color:'#e8e0d0', fontSize:'28px', fontWeight:'normal', margin:'0 0 10px' }}>M&A Transactions</h2>
            <p style={{ color:'#6b7280', fontSize:'14px', lineHeight:1.7, maxWidth:'600px', margin:'0 0 36px' }}>
              Landmark acquisitions in SaaS, AI voice, and revenue intelligence — establishing the valuation benchmarks that define exit multiples for AI-native platforms.
            </p>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                    {['Acquirer','Target','Year','Deal Value','Sector','Revenue Multiple'].map(h => (
                      <th key={h} style={{ color:GOLD, padding:'12px 16px', textAlign:'left', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maDeals.map((d, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ color:'#e8e0d0', padding:'16px', fontWeight:'bold' }}>{d.acquirer}</td>
                      <td style={{ color:'#c4cdd8', padding:'16px' }}>{d.target}</td>
                      <td style={{ color:'#6b7280', padding:'16px' }}>{d.year}</td>
                      <td style={{ color:GOLD, padding:'16px', fontWeight:'bold', fontSize:'15px' }}>{d.value}</td>
                      <td style={{ color:'#8a9ab8', padding:'16px' }}>{d.sector}</td>
                      <td style={{ color:'#4ade80', padding:'16px', fontWeight:'bold' }}>{d.multiple}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'2px', padding:'20px 24px', marginTop:'32px' }}>
              <p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:0 }}>
                <strong style={{ color:GOLD }}>Key takeaway:</strong> AI voice and NLP acquisitions commanded 10–26x ARR, with design/productivity tools reaching 50x. The precedent set by Microsoft/Nuance ($19.7B, 10x ARR) is directly relevant to Rosie AI's positioning in the AI voice agent space.
              </p>
            </div>
          </div>
        )}

        {/* COMPARABLE COMPANIES */}
        {activeView === 'comp' && (
          <div>
            <p style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase', margin:'0 0 10px' }}>Peer Group Analysis</p>
            <h2 style={{ color:'#e8e0d0', fontSize:'28px', fontWeight:'normal', margin:'0 0 10px' }}>Comparable Companies</h2>
            <p style={{ color:'#6b7280', fontSize:'14px', lineHeight:1.7, maxWidth:'600px', margin:'0 0 36px' }}>
              Revenue intelligence, conversational AI, and sales automation peers — benchmarking ARR, valuation, and revenue multiples against Rosie AI's current round.
            </p>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                    {['Company','Category','ARR','Valuation','Rev. Multiple','Stage'].map(h => (
                      <th key={h} style={{ color:GOLD, padding:'12px 16px', textAlign:'left', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c, i) => {
                    const isRosie = c.company === 'Rosie AI';
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background:isRosie?'rgba(184,147,58,0.08)':'transparent' }}
                        onMouseEnter={e => { if (!isRosie) e.currentTarget.style.background='rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { if (!isRosie) e.currentTarget.style.background='transparent'; }}>
                        <td style={{ padding:'16px' }}>
                          <div style={{ color:isRosie?GOLD:'#e8e0d0', fontWeight:isRosie?'bold':'normal', fontSize: isRosie?'14px':'13px' }}>{c.company}</div>
                          {isRosie && <div style={{ color:'#4ade80', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>← Current Opportunity</div>}
                        </td>
                        <td style={{ color:'#8a9ab8', padding:'16px' }}>{c.type}</td>
                        <td style={{ color:'#c4cdd8', padding:'16px', fontWeight:'bold' }}>{c.arr}</td>
                        <td style={{ color:'#e8e0d0', padding:'16px' }}>{c.valuation}</td>
                        <td style={{ color:'#4ade80', padding:'16px', fontWeight:'bold' }}>{c.multiple}</td>
                        <td style={{ color:'#6b7280', padding:'16px' }}>{c.stage}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'2px', padding:'20px 24px', marginTop:'32px' }}>
              <p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:0 }}>
                <strong style={{ color:GOLD }}>Key takeaway:</strong> Comparable companies in this space have been valued at 10–24x ARR at maturity. Rosie AI's $15M valuation cap at $380K ARR implies a 39x forward multiple — reflecting early-stage premium consistent with pre-revenue AI infrastructure plays that later attracted strategic acquirers.
              </p>
            </div>
          </div>
        )}

        {/* MARKET TRENDS */}
        {activeView === 'trends' && (
          <div>
            <p style={{ color:GOLD, fontSize:'10px', letterSpacing:'4px', textTransform:'uppercase', margin:'0 0 10px' }}>Macro Tailwinds</p>
            <h2 style={{ color:'#e8e0d0', fontSize:'28px', fontWeight:'normal', margin:'0 0 10px' }}>Market Trends</h2>
            <p style={{ color:'#6b7280', fontSize:'14px', lineHeight:1.7, maxWidth:'600px', margin:'0 0 36px' }}>
              Six structural forces driving enterprise adoption of AI voice agents — the same tailwinds that produced multi-billion dollar exits in conversational AI over the past four years.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'40px' }}>
              {trends.map(({ title, stat, desc }) => (
                <div key={title} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'2px', padding:'28px' }}>
                  <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>{title}</div>
                  <div style={{ color:'#e8e0d0', fontSize:'28px', fontWeight:'bold', marginBottom:'10px', lineHeight:1.1 }}>{stat}</div>
                  <div style={{ color:'#6b7280', fontSize:'13px', lineHeight:1.6 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.15)', borderRadius:'2px', padding:'20px 24px' }}>
              <p style={{ color:'#8a9ab8', fontSize:'13px', lineHeight:1.7, margin:0 }}>
                <strong style={{ color:GOLD }}>Key takeaway:</strong> The convergence of enterprise automation demand, falling AI infrastructure costs, and proven M&A exit activity creates a favorable environment for AI voice platforms entering the market in 2024–2025. Rosie AI is positioned at the intersection of all six trends.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Footer CTA */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'48px 40px', textAlign:'center', marginTop:'40px' }}>
        <p style={{ color:'#4a5568', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'16px' }}>Accredited Investors</p>
        <h3 style={{ color:'#e8e0d0', fontSize:'22px', fontWeight:'normal', margin:'0 0 12px', fontFamily:'Georgia, serif' }}>Ready to review the full investment opportunity?</h3>
        <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 28px' }}>Access the Private Placement Memorandum, financials, and subscription documents in the Investor Portal.</p>
        <button onClick={() => navigate('/portal-login')}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'14px 36px', cursor:'pointer', fontSize:'12px', fontWeight:'700', letterSpacing:'3px', textTransform:'uppercase' }}>
          🔐 Access Investor Portal
        </button>
      </div>
    </div>
  );
}