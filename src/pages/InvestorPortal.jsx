import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings } from '@/lib/portalSettings';

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";

const GOLD = '#b8933a';
const GOLD2 = '#d4aa50';
const DARK = '#0a0f1e';
const DARKER = '#060c18';

// ─── Investor Calculator ───────────────────────────────────────────────────
function InvestorCalculator() {
  const [investment, setInvestment] = useState(50000);
  const [multiple, setMultiple] = useState(5);
  const roi = investment * multiple;
  const profit = roi - investment;

  return (
    <div style={{
      background: 'rgba(184,147,58,0.06)', border: '1px solid rgba(184,147,58,0.2)',
      borderRadius: '2px', padding: '32px', marginTop: '40px'
    }}>
      <h3 style={{ color: GOLD, fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 24px' }}>
        Investment Return Calculator
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div>
          <label style={{ color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Investment Amount
          </label>
          <input
            type="number"
            value={investment}
            onChange={e => setInvestment(Number(e.target.value))}
            min={25000}
            step={5000}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '2px', padding: '12px 16px', color: '#e8e0d0', fontSize: '16px',
              outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Return Multiple (x)
          </label>
          <input
            type="range" min={2} max={20} value={multiple}
            onChange={e => setMultiple(Number(e.target.value))}
            style={{ width: '100%', accentColor: GOLD, marginTop: '8px' }}
          />
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold', textAlign: 'center' }}>{multiple}x</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {[
          { label: 'Initial Investment', value: `$${investment.toLocaleString()}`, color: '#8a9ab8' },
          { label: 'Projected Return', value: `$${roi.toLocaleString()}`, color: GOLD },
          { label: 'Net Profit', value: `$${profit.toLocaleString()}`, color: '#4ade80' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', textAlign: 'center', borderRadius: '2px' }}>
            <div style={{ color: '#5a6a7e', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
            <div style={{ color, fontSize: '20px', fontWeight: 'bold' }}>{value}</div>
          </div>
        ))}
      </div>
      <p style={{ color: '#4a5568', fontSize: '11px', marginTop: '16px', textAlign: 'center' }}>
        * Projections are illustrative only and do not constitute a guarantee of returns.
      </p>
    </div>
  );
}

// ─── Subscription Docusign Popup ──────────────────────────────────────────
function DocusignModal({ onClose }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', mailingAddress: '',
    amountToInvest: '', investmentType: 'Cash', fundingType: 'Wire'
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    analytics.trackDownload('DocuSign Request - ' + form.firstName + ' ' + form.lastName, 'docusign_request');
    setSubmitted(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.3)',
        borderRadius: '2px', padding: '40px', maxWidth: '560px', width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)'
      }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h3 style={{ color: GOLD, marginBottom: '12px' }}>Request Submitted</h3>
            <p style={{ color: '#8a9ab8', lineHeight: 1.6 }}>
              Your DocuSign request has been received. Our team will send you the subscription agreement within 1 business day.
            </p>
            <button onClick={onClose} style={{ marginTop: '24px', background: GOLD, color: DARK, border: 'none', padding: '12px 32px', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '2px', fontSize: '11px', textTransform: 'uppercase' }}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <h3 style={{ color: GOLD, margin: 0, letterSpacing: '2px', textTransform: 'uppercase', fontSize: '13px' }}>
                Request DocuSign
              </h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {[
                { key: 'firstName', label: 'First Name' },
                { key: 'lastName', label: 'Last Name' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Mailing Address</label>
              <input value={form.mailingAddress} onChange={e => setForm({ ...form, mailingAddress: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Amount to Invest ($)</label>
              <input type="number" value={form.amountToInvest} onChange={e => setForm({ ...form, amountToInvest: e.target.value })} style={inputStyle} placeholder="e.g. 50000" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
              <div>
                <label style={labelStyle}>Investment Type</label>
                <select value={form.investmentType} onChange={e => setForm({ ...form, investmentType: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option>Cash</option>
                  <option>IRA</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Funding Type</label>
                <select value={form.fundingType} onChange={e => setForm({ ...form, fundingType: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option>Wire</option>
                  <option>Check</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!form.firstName || !form.lastName || !form.email}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
                border: 'none', borderRadius: '2px', padding: '14px',
                color: DARK, fontWeight: '700', fontSize: '12px',
                letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer'
              }}>
              Submit Request
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', color: '#8a9ab8', fontSize: '10px',
  letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px'
};
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px',
  padding: '10px 14px', color: '#e8e0d0', fontSize: '14px',
  outline: 'none', boxSizing: 'border-box'
};

// ─── PDF Download helper ──────────────────────────────────────────────────
function downloadTabAsPDF(title) {
  analytics.trackDownload(title + '.pdf', 'pdf');
  const content = document.getElementById('portal-tab-content');
  if (!content) return;
  
  // Simple print-based PDF
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: Georgia, serif; color: #1a1a2e; padding: 40px; }
      h1 { color: #b8933a; } h2 { color: #1a1a2e; }
      * { print-color-adjust: exact; }
    </style>
    </head><body>
    <h1>Rosie AI — ${title}</h1>
    <p style="color:#888;font-size:12px;">Generated: ${new Date().toLocaleDateString()}</p>
    ${content.innerText.replace(/\n/g, '<br/>')}
    </body></html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ─── Tab: Investment Offering ─────────────────────────────────────────────
function InvestmentOffering() {
  const [activeSection, setActiveSection] = useState('overview');
  const sectionRef = useRef(null);

  const sections = [
    { id: 'overview', label: 'Executive Overview' },
    { id: 'opportunity', label: 'The Opportunity' },
    { id: 'product', label: 'Product & Technology' },
    { id: 'market', label: 'Market Analysis' },
    { id: 'traction', label: 'Traction & Metrics' },
    { id: 'team', label: 'Team' },
    { id: 'financials', label: 'Financial Projections' },
    { id: 'terms', label: 'Investment Terms' },
    { id: 'use-of-funds', label: 'Use of Funds' },
    { id: 'risk', label: 'Risk Factors' },
  ];

  useEffect(() => {
    analytics.trackSection('investment-' + activeSection);
  }, [activeSection]);

  const sectionContent = {
    overview: (
      <div>
        <h2 style={h2}>Executive Overview</h2>
        <p style={bodyText}>Rosie AI is an enterprise-grade AI voice agent platform designed to power the full revenue cycle for SMBs and mid-market companies. Our platform automates inbound and outbound calls, qualifies leads in real-time, routes prospects, and closes deals — all without human intervention.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '28px 0' }}>
          {[
            { label: 'Target Raise', value: '$2.5M', sub: 'SAFE Note' },
            { label: 'Valuation Cap', value: '$15M', sub: 'Pre-Money' },
            { label: 'Min Investment', value: '$25,000', sub: 'Per Investor' },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: 'rgba(184,147,58,0.08)', border: '1px solid rgba(184,147,58,0.2)', padding: '20px', textAlign: 'center', borderRadius: '2px' }}>
              <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
              <div style={{ color: GOLD, fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
              <div style={{ color: '#4a5568', fontSize: '11px', marginTop: '4px' }}>{sub}</div>
            </div>
          ))}
        </div>
        <p style={bodyText}>Rosie leverages proprietary AI models tuned for natural sales conversations, integrating seamlessly with leading CRM platforms (Salesforce, HubSpot, Zoho) and telephony providers. Our cost advantage is 15x vs. industry standard human SDRs, with full AI call stacks at $0.01/minute.</p>
      </div>
    ),
    opportunity: (
      <div>
        <h2 style={h2}>The Opportunity</h2>
        <p style={bodyText}>The AI voice agent market is at an inflection point. As enterprises demand scale, speed, and cost efficiency in their go-to-market motions, Rosie AI fills a $40B+ total addressable market by 2032 (38.46% CAGR).</p>
        <ul style={{ color: '#c4cdd8', lineHeight: 2, paddingLeft: '20px' }}>
          <li>Traditional SDRs cost $6,000–$10,000/month fully loaded; Rosie costs pennies per call</li>
          <li>75% of sales calls go unanswered — Rosie's 24/7 agents capture all opportunities</li>
          <li>Growing demand across insurance, real estate, solar, healthcare, and SaaS verticals</li>
          <li>AI voice API market expanding from $4.1B (2025) to $40B (2032)</li>
        </ul>
      </div>
    ),
    product: (
      <div>
        <h2 style={h2}>Product & Technology</h2>
        <p style={bodyText}>Rosie's platform is built on a proprietary AI stack with the following core capabilities:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '20px 0' }}>
          {[
            { title: 'AI Voice Engine', desc: 'Natural language processing optimized for sales conversations with <200ms latency' },
            { title: 'Workflow Manager', desc: 'No-code campaign builder for complex multi-step outreach sequences' },
            { title: 'CRM Integration', desc: 'Native connectors for Salesforce, HubSpot, Zoho, and custom APIs' },
            { title: 'Apify Web Scraping', desc: 'Automated prospect enrichment from 50+ data sources' },
            { title: 'SMS Campaigns', desc: 'Omnichannel follow-up combining voice and SMS touchpoints' },
            { title: 'Real-Time Analytics', desc: 'Live dashboards with call scoring, conversion tracking, and ROI analysis' },
          ].map(({ title, desc }) => (
            <div key={title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '2px' }}>
              <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>{title}</div>
              <div style={{ color: '#8a9ab8', fontSize: '13px', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    market: (
      <div>
        <h2 style={h2}>Market Analysis</h2>
        <p style={bodyText}>Our target market spans five high-velocity verticals with acute demand for AI-driven outreach automation:</p>
        {[
          { segment: 'AI Voice API Market', size: '$40B', cagr: '38.46%', year: '2032' },
          { segment: 'Solar Industry Outreach', size: '$190B', cagr: '17.35%', year: '2032' },
          { segment: 'Insurance Lead Gen', size: 'High Value', cagr: '30.82%', year: '2032' },
          { segment: 'SaaS Sales Automation', size: 'Enterprise', cagr: '35.64%', year: '2032' },
        ].map(({ segment, size, cagr, year }) => (
          <div key={segment} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#c4cdd8', fontSize: '14px' }}>{segment}</span>
            <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
              <div><div style={{ color: GOLD, fontWeight: 'bold' }}>{size}</div><div style={{ color: '#4a5568', fontSize: '11px' }}>by {year}</div></div>
              <div><div style={{ color: '#4ade80', fontWeight: 'bold' }}>{cagr}</div><div style={{ color: '#4a5568', fontSize: '11px' }}>CAGR</div></div>
            </div>
          </div>
        ))}
      </div>
    ),
    traction: (
      <div>
        <h2 style={h2}>Traction & Metrics</h2>
        <p style={bodyText}>Rosie AI has demonstrated strong early product-market fit with the following key metrics:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', margin: '24px 0' }}>
          {[
            { label: 'Active Clients', value: '47+', icon: '👥' },
            { label: 'Calls Processed', value: '1.2M+', icon: '📞' },
            { label: 'Avg Cost Per Call', value: '$0.01', icon: '💰' },
            { label: 'Conversion Lift vs SDR', value: '3.2x', icon: '📈' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: 'rgba(184,147,58,0.06)', border: '1px solid rgba(184,147,58,0.15)', padding: '24px', textAlign: 'center', borderRadius: '2px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
              <div style={{ color: GOLD, fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>{value}</div>
              <div style={{ color: '#6b7280', fontSize: '12px', letterSpacing: '1px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    team: (
      <div>
        <h2 style={h2}>Team</h2>
        <p style={bodyText}>Our team combines deep expertise in AI, enterprise SaaS, and sales technology:</p>
        <div style={{ marginTop: '20px' }}>
          {[
            { name: 'Leadership Team', role: 'Serial entrepreneurs with 3+ successful exits in AI & SaaS' },
            { name: 'Engineering', role: 'Former engineers from Google, Amazon Web Services, and Twilio' },
            { name: 'Sales & GTM', role: 'Built and scaled SDR teams at Fortune 500 companies' },
            { name: 'Advisors', role: 'Board-level executives from leading AI and telecom companies' },
          ].map(({ name, role }) => (
            <div key={name} style={{ display: 'flex', gap: '16px', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(184,147,58,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: GOLD, fontSize: '18px' }}>👤</div>
              <div>
                <div style={{ color: '#e8e0d0', fontWeight: 'bold', marginBottom: '4px' }}>{name}</div>
                <div style={{ color: '#8a9ab8', fontSize: '13px' }}>{role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    financials: (
      <div>
        <h2 style={h2}>Financial Projections</h2>
        <p style={bodyText}>Pro-forma projections based on current growth trajectory and planned deployment of raised capital:</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(184,147,58,0.3)' }}>
              {['Metric', '2025 (Act.)', '2026', '2027', '2028'].map(h => (
                <th key={h} style={{ color: GOLD, padding: '10px 8px', textAlign: h === 'Metric' ? 'left' : 'right', fontSize: '11px', letterSpacing: '1px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['ARR', '$380K', '$2.1M', '$7.8M', '$22M'],
              ['Customers', '47', '280', '850', '2,400'],
              ['Gross Margin', '72%', '76%', '79%', '82%'],
              ['MoM Growth', '18%', '22%', '15%', '12%'],
            ].map(([metric, ...vals]) => (
              <tr key={metric} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ color: '#c4cdd8', padding: '12px 8px' }}>{metric}</td>
                {vals.map((v, i) => <td key={i} style={{ color: i === 0 ? '#8a9ab8' : '#e8e0d0', padding: '12px 8px', textAlign: 'right' }}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    terms: (
      <div>
        <h2 style={h2}>Investment Terms</h2>
        {[
          ['Instrument', 'SAFE Note (Simple Agreement for Future Equity)'],
          ['Total Round Size', '$2,500,000'],
          ['Valuation Cap', '$15,000,000 (Pre-Money)'],
          ['Discount Rate', '20% at next priced round'],
          ['Minimum Investment', '$25,000'],
          ['Target Close', 'Q2 2025'],
          ['Pro-Rata Rights', 'Yes, for investors $100K+'],
          ['Information Rights', 'Quarterly financials + annual audit'],
          ['Most Favored Nation', 'Standard MFN clause included'],
        ].map(([term, value]) => (
          <div key={term} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#8a9ab8', fontSize: '13px' }}>{term}</span>
            <span style={{ color: '#e8e0d0', fontSize: '13px', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
          </div>
        ))}
      </div>
    ),
    'use-of-funds': (
      <div>
        <h2 style={h2}>Use of Funds</h2>
        <p style={bodyText}>The $2.5M raise will be deployed across three primary investment areas over 18 months:</p>
        <div style={{ marginTop: '24px' }}>
          {[
            { label: 'Product & Engineering', pct: 45, color: GOLD, detail: 'AI model improvements, platform scaling, new integrations' },
            { label: 'Sales & Marketing', pct: 35, color: '#4ade80', detail: 'GTM expansion, channel partnerships, brand awareness' },
            { label: 'Operations & G&A', pct: 20, color: '#60a5fa', detail: 'Infrastructure, compliance, team growth' },
          ].map(({ label, pct, color, detail }) => (
            <div key={label} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#c4cdd8', fontSize: '13px' }}>{label}</span>
                <span style={{ color, fontWeight: 'bold' }}>{pct}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '2px', height: '8px' }}>
                <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: '2px' }} />
              </div>
              <div style={{ color: '#4a5568', fontSize: '12px', marginTop: '4px' }}>{detail}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    risk: (
      <div>
        <h2 style={h2}>Risk Factors</h2>
        <p style={bodyText}>Investing in early-stage companies involves significant risk. Prospective investors should carefully consider the following:</p>
        {[
          'Early-stage company with limited operating history',
          'AI regulatory environment is evolving rapidly',
          'Competitive landscape includes well-funded incumbents',
          'Dependence on key personnel and technology partners',
          'Revenue concentration risk in early customer base',
          'Capital requirements may exceed current projections',
          'Illiquid investment — no public market for shares',
        ].map((risk, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: '#ef4444', flexShrink: 0 }}>⚠</span>
            <span style={{ color: '#8a9ab8', fontSize: '13px', lineHeight: 1.5 }}>{risk}</span>
          </div>
        ))}
        <p style={{ color: '#4a5568', fontSize: '11px', marginTop: '20px', lineHeight: 1.6 }}>
          This is not an offer to sell securities. Investment in Rosie AI is available only to accredited investors under applicable securities laws. Please consult your financial and legal advisors.
        </p>
      </div>
    ),
  };

  return (
    <div style={{ display: 'flex', gap: '0', minHeight: '600px' }}>
      {/* Sidebar */}
      <div style={{
        width: '220px', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        paddingRight: '0',
      }}>
        {sections.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveSection(id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: activeSection === id ? 'rgba(184,147,58,0.12)' : 'transparent',
            border: 'none', borderLeft: activeSection === id ? `3px solid ${GOLD}` : '3px solid transparent',
            padding: '12px 16px', color: activeSection === id ? GOLD : '#6b7280',
            fontSize: '12px', letterSpacing: '0.5px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div id="portal-tab-content" style={{ flex: 1, paddingLeft: '36px', paddingRight: '8px', overflowY: 'auto' }}>
        {sectionContent[activeSection]}
      </div>

      {/* Floating Download */}
      <button
        onClick={() => downloadTabAsPDF('Investment Offering')}
        style={{
          position: 'fixed', bottom: '32px', right: '32px',
          background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
          color: DARK, border: 'none', borderRadius: '2px',
          padding: '14px 24px', cursor: 'pointer',
          fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase',
          fontWeight: '700', boxShadow: '0 8px 32px rgba(184,147,58,0.4)',
          display: 'flex', alignItems: 'center', gap: '8px',
          zIndex: 100,
        }}
      >
        ↓ Download PDF
      </button>
    </div>
  );
}

const h2 = { color: '#e8e0d0', fontSize: '20px', marginTop: 0, marginBottom: '16px', fontFamily: 'Georgia, serif', fontWeight: 'normal' };
const bodyText = { color: '#8a9ab8', lineHeight: 1.7, fontSize: '14px', marginBottom: '16px' };

// ─── Tab: Subscription Agreements ────────────────────────────────────────
function SubscriptionAgreements() {
  const [showDocusign, setShowDocusign] = useState(false);

  return (
    <div id="portal-tab-content" style={{ position: 'relative' }}>
      {showDocusign && <DocusignModal onClose={() => setShowDocusign(false)} />}

      <h2 style={h2}>Subscription Agreements</h2>
      <p style={bodyText}>
        To participate in the Rosie AI investment round, you must complete and execute a Subscription Agreement. 
        Review the documents below carefully. To proceed, request a DocuSign package or download the agreement for your records.
      </p>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '44px', height: '44px', background: 'rgba(184,147,58,0.15)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📄</div>
            <div>
              <div style={{ color: '#e8e0d0', fontWeight: 'bold', marginBottom: '4px' }}>SAFE Note — Subscription Agreement</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>Rev. March 2025 · 12 pages · PDF</div>
            </div>
          </div>
          <button
            onClick={() => { analytics.trackDownload('Subscription Agreement.pdf', 'pdf'); alert('Downloading Subscription Agreement...'); }}
            style={{ background: 'transparent', border: `1px solid ${GOLD}`, color: GOLD, borderRadius: '2px', padding: '8px 20px', cursor: 'pointer', fontSize: '12px', letterSpacing: '1px' }}>
            ↓ Download
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '44px', height: '44px', background: 'rgba(184,147,58,0.15)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📋</div>
            <div>
              <div style={{ color: '#e8e0d0', fontWeight: 'bold', marginBottom: '4px' }}>Investor Accreditation Letter</div>
              <div style={{ color: '#6b7280', fontSize: '12px' }}>Required · 3 pages · PDF</div>
            </div>
          </div>
          <button
            onClick={() => { analytics.trackDownload('Accreditation Letter.pdf', 'pdf'); alert('Downloading Accreditation Letter...'); }}
            style={{ background: 'transparent', border: `1px solid ${GOLD}`, color: GOLD, borderRadius: '2px', padding: '8px 20px', cursor: 'pointer', fontSize: '12px', letterSpacing: '1px' }}>
            ↓ Download
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(184,147,58,0.06)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '2px' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>✍️</div>
        <h3 style={{ color: GOLD, marginBottom: '12px', fontFamily: 'Georgia, serif', fontWeight: 'normal' }}>Ready to Subscribe?</h3>
        <p style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
          Request a DocuSign package and our team will send you a fully executed digital subscription agreement within 1 business day.
        </p>
        <button
          onClick={() => setShowDocusign(true)}
          style={{
            background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
            color: DARK, border: 'none', borderRadius: '2px',
            padding: '14px 36px', cursor: 'pointer',
            fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
            fontWeight: '700',
          }}>
          Request DocuSign
        </button>
      </div>

      {/* Floating Download */}
      <button
        onClick={() => downloadTabAsPDF('Subscription Agreements')}
        style={{
          position: 'fixed', bottom: '32px', right: '32px',
          background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
          color: DARK, border: 'none', borderRadius: '2px',
          padding: '14px 24px', cursor: 'pointer',
          fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase',
          fontWeight: '700', boxShadow: '0 8px 32px rgba(184,147,58,0.4)',
          zIndex: 100,
        }}>
        ↓ Download PDF
      </button>
    </div>
  );
}

// ─── Tab: Market Data ─────────────────────────────────────────────────────
function MarketData() {
  const [activeView, setActiveView] = useState('ma');

  useEffect(() => { analytics.trackSection('market-' + activeView); }, [activeView]);

  const maDeals = [
    { acquirer: 'Salesforce', target: 'Slack', year: '2021', value: '$27.7B', sector: 'SaaS/Collaboration', multiple: '26x ARR' },
    { acquirer: 'Microsoft', target: 'Nuance', year: '2021', value: '$19.7B', sector: 'AI Voice/NLP', multiple: '10x ARR' },
    { acquirer: 'Adobe', target: 'Figma', year: '2022', value: '$20B', sector: 'SaaS/Design', multiple: '50x ARR' },
    { acquirer: 'ServiceNow', target: 'Intellibot', year: '2021', value: '$1.35B', sector: 'AI Automation', multiple: '12x ARR' },
    { acquirer: 'Zoom', target: 'Kites', year: '2021', value: 'Undisclosed', sector: 'AI Voice', multiple: 'N/A' },
    { acquirer: 'HubSpot', target: 'The Hustle', year: '2021', value: '$27M', sector: 'Content/SaaS', multiple: 'N/A' },
    { acquirer: 'Twilio', target: 'Segment', year: '2020', value: '$3.2B', sector: 'Data/SaaS', multiple: '12x ARR' },
    { acquirer: 'RingCentral', target: 'Hopin', year: '2022', value: '$50M', sector: 'AI Video/Voice', multiple: 'Distressed' },
  ];

  const comparables = [
    { company: 'Gong.io', type: 'Revenue Intelligence AI', arr: '$300M+', valuation: '$7.25B', multiple: '24x', stage: 'Late Stage' },
    { company: 'Chorus.ai', type: 'Conversation Intelligence', arr: '$50M', valuation: '$575M', multiple: '11.5x', stage: 'Acquired by ZoomInfo' },
    { company: 'Outreach.io', type: 'Sales Engagement AI', arr: '$220M', valuation: '$4.4B', multiple: '20x', stage: 'Late Stage' },
    { company: 'Salesloft', type: 'Revenue Workflow AI', arr: '$200M+', valuation: '$2.3B', multiple: '11.5x', stage: 'Late Stage' },
    { company: 'Drift', type: 'Conversational AI', arr: '$100M', valuation: '$1.1B', multiple: '11x', stage: 'Acquired by Salesloft' },
    { company: 'Loom', type: 'Video AI Messaging', arr: '$45M', valuation: '$1.53B', multiple: '34x', stage: 'Acquired by Atlassian' },
    { company: 'Lavender', type: 'AI Email Coaching', arr: '$10M', valuation: '$N/A', multiple: 'N/A', stage: 'Series A' },
    { company: 'Rosie AI', type: 'AI Voice Agent Platform', arr: '$380K', valuation: '$15M (Cap)', multiple: '39x (Cap)', stage: '🔵 Current Round' },
  ];

  return (
    <div id="portal-tab-content">
      <h2 style={h2}>Market Data</h2>
      <p style={bodyText}>Comprehensive market analysis covering SaaS M&A activity, comparable company valuations, and AI voice segment growth data to contextualize the Rosie AI investment opportunity.</p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {[['ma', 'M&A Transactions'], ['comp', 'Comparable Companies'], ['trends', 'Market Trends']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveView(id)} style={{
            padding: '8px 20px', background: activeView === id ? GOLD : 'rgba(255,255,255,0.05)',
            color: activeView === id ? DARK : '#8a9ab8', border: 'none', borderRadius: '2px',
            cursor: 'pointer', fontSize: '12px', letterSpacing: '1px', fontWeight: activeView === id ? 'bold' : 'normal'
          }}>{label}</button>
        ))}
      </div>

      {activeView === 'ma' && (
        <div>
          <h3 style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>
            Notable SaaS & AI M&A Transactions (2020–2024)
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(184,147,58,0.3)' }}>
                  {['Acquirer', 'Target', 'Year', 'Value', 'Sector', 'Multiple'].map(h => (
                    <th key={h} style={{ color: GOLD, padding: '10px 12px', textAlign: 'left', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maDeals.map((deal, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ color: '#e8e0d0', padding: '12px 12px' }}>{deal.acquirer}</td>
                    <td style={{ color: '#c4cdd8', padding: '12px 12px' }}>{deal.target}</td>
                    <td style={{ color: '#6b7280', padding: '12px 12px' }}>{deal.year}</td>
                    <td style={{ color: GOLD, padding: '12px 12px', fontWeight: 'bold' }}>{deal.value}</td>
                    <td style={{ color: '#8a9ab8', padding: '12px 12px' }}>{deal.sector}</td>
                    <td style={{ color: '#4ade80', padding: '12px 12px' }}>{deal.multiple}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'comp' && (
        <div>
          <h3 style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>
            Comparable Company Analysis — AI Sales & Voice Tech
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(184,147,58,0.3)' }}>
                  {['Company', 'Category', 'ARR', 'Valuation', 'ARR Multiple', 'Stage'].map(h => (
                    <th key={h} style={{ color: GOLD, padding: '10px 12px', textAlign: 'left', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparables.map((c, i) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: c.company === 'Rosie AI' ? 'rgba(184,147,58,0.1)' : 'transparent'
                  }}>
                    <td style={{ color: c.company === 'Rosie AI' ? GOLD : '#e8e0d0', padding: '12px 12px', fontWeight: c.company === 'Rosie AI' ? 'bold' : 'normal' }}>{c.company}</td>
                    <td style={{ color: '#8a9ab8', padding: '12px 12px' }}>{c.type}</td>
                    <td style={{ color: '#c4cdd8', padding: '12px 12px' }}>{c.arr}</td>
                    <td style={{ color: '#e8e0d0', padding: '12px 12px' }}>{c.valuation}</td>
                    <td style={{ color: '#4ade80', padding: '12px 12px' }}>{c.multiple}</td>
                    <td style={{ color: '#6b7280', padding: '12px 12px' }}>{c.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'trends' && (
        <div>
          <h3 style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>
            AI Voice & SaaS Market Trends
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {[
              { title: 'AI Voice Market', stat: '$40B by 2032', desc: 'Growing at 38.46% CAGR driven by enterprise automation demand' },
              { title: 'SaaS M&A Multiples', stat: '10–50x ARR', desc: 'Premium multiples for AI-native platforms vs. traditional SaaS' },
              { title: 'Sales Automation Adoption', stat: '68% of enterprise', desc: 'Use AI tools in their SDR workflow as of 2024' },
              { title: 'Average Cost Reduction', stat: '15x cheaper', desc: 'AI voice vs. human SDR in equivalent qualified pipeline generation' },
            ].map(({ title, stat, desc }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', borderRadius: '2px' }}>
                <div style={{ color: GOLD, fontSize: '12px', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>{title}</div>
                <div style={{ color: '#e8e0d0', fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>{stat}</div>
                <div style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Investor Updates ────────────────────────────────────────────────
const UPDATES_KEY = 'rosie_investor_updates';

function InvestorUpdates({ isAdmin }) {
  const [updates, setUpdates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'General Update' });

  useEffect(() => {
    loadUpdates();
  }, []);

  function loadUpdates() {
    try {
      const raw = localStorage.getItem(UPDATES_KEY);
      const arr = raw ? JSON.parse(raw) : getSampleUpdates();
      setUpdates(arr.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch {
      setUpdates(getSampleUpdates());
    }
  }

  function getSampleUpdates() {
    return [
      { id: 1, title: 'Q1 2025 Performance Update', content: 'We are pleased to report strong Q1 2025 results. Revenue grew 47% QoQ to $95K MRR. We onboarded 12 new enterprise clients in solar and insurance verticals. Product shipped 3 major releases including our new Workflow Manager and Apify integration.', date: '2025-04-01', category: 'Financial Update', author: 'Management Team' },
      { id: 2, title: 'New Partnership: Major Telecom Provider', content: 'Rosie AI has signed a strategic partnership with a top-10 US telecom provider, granting us preferred API access and co-marketing opportunities. This partnership is expected to reduce our per-call infrastructure cost by an additional 30% and open access to their enterprise client network.', date: '2025-03-15', category: 'Partnership', author: 'Management Team' },
      { id: 3, title: 'Product Launch: Rosie 2.0', content: 'Today we launched Rosie 2.0, our most significant platform update to date. Highlights include our new real-time conversation AI engine with <150ms latency, redesigned campaign management dashboard, and native HubSpot and Salesforce bi-directional sync. Early feedback from beta users has been exceptional.', date: '2025-02-28', category: 'Product Update', author: 'Product Team' },
    ];
  }

  function postUpdate() {
    const newUpdate = {
      id: Date.now(),
      title: form.title,
      content: form.content,
      category: form.category,
      date: new Date().toISOString().split('T')[0],
      author: 'Admin',
    };
    const current = [...updates, newUpdate].sort((a, b) => new Date(b.date) - new Date(a.date));
    setUpdates(current);
    localStorage.setItem(UPDATES_KEY, JSON.stringify(current));
    setForm({ title: '', content: '', category: 'General Update' });
    setShowForm(false);
  }

  function deleteUpdate(id) {
    if (!window.confirm('Delete this update?')) return;
    const filtered = updates.filter(u => u.id !== id);
    setUpdates(filtered);
    localStorage.setItem(UPDATES_KEY, JSON.stringify(filtered));
  }

  const categoryColors = {
    'Financial Update': '#4ade80',
    'Product Update': '#60a5fa',
    'Partnership': '#f59e0b',
    'General Update': '#8a9ab8',
    'Important Notice': '#ef4444',
  };

  return (
    <div id="portal-tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h2 style={{ ...h2, marginBottom: '8px' }}>Investor Updates</h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>Chronological updates from the Rosie AI management team</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} style={{
            background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: DARK,
            border: 'none', borderRadius: '2px', padding: '10px 20px', cursor: 'pointer',
            fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '700'
          }}>
            + Post Update
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <div style={{ background: 'rgba(184,147,58,0.08)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '2px', padding: '24px', marginBottom: '28px' }}>
          <h4 style={{ color: GOLD, marginTop: 0, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>New Update</h4>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Update Title" style={{ ...inputStyle, marginBottom: '12px' }} />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, marginBottom: '12px' }}>
            {Object.keys(categoryColors).map(c => <option key={c}>{c}</option>)}
          </select>
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Update content..." rows={6}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={postUpdate} disabled={!form.title || !form.content} style={{
              background: GOLD, color: DARK, border: 'none', borderRadius: '2px', padding: '10px 24px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px'
            }}>Post</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {updates.map((update, idx) => (
          <div key={update.id} style={{ display: 'flex', gap: '20px', paddingBottom: '32px', position: 'relative' }}>
            {/* Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px', flexShrink: 0 }}>
              <div style={{ width: '12px', height: '12px', background: GOLD, borderRadius: '50%', marginTop: '6px', flexShrink: 0 }} />
              {idx < updates.length - 1 && <div style={{ width: '1px', flex: 1, background: 'rgba(255,255,255,0.08)', marginTop: '4px' }} />}
            </div>

            {/* Content */}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '2px',
                    background: `${categoryColors[update.category]}22`,
                    color: categoryColors[update.category] || '#8a9ab8',
                    fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
                    marginBottom: '8px'
                  }}>{update.category}</span>
                  <h3 style={{ color: '#e8e0d0', margin: '0', fontSize: '16px', fontFamily: 'Georgia, serif', fontWeight: 'normal' }}>{update.title}</h3>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: GOLD, fontSize: '13px' }}>{new Date(update.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  <div style={{ color: '#4a5568', fontSize: '11px', marginTop: '2px' }}>{update.author}</div>
                </div>
              </div>
              <p style={{ color: '#8a9ab8', fontSize: '13px', lineHeight: 1.7, margin: '0 0 12px' }}>{update.content}</p>
              {isAdmin && (
                <button onClick={() => deleteUpdate(update.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: '0', opacity: 0.6 }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'home', label: 'Overview' },
  { id: 'offering', label: 'Investment Offering' },
  { id: 'subscription', label: 'Subscription Agreements' },
  { id: 'market', label: 'Market Data' },
  { id: 'updates', label: 'Investor Updates' },
];

export default function InvestorPortal() {
  const { portalUser, portalLogout, isAdmin } = usePortalAuth();
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();

  useEffect(() => {
    if (!portalUser) { navigate('/portal-login'); return; }
    analytics.trackPageView('portal');
    analytics.trackSection('home');
  }, [portalUser]);

  useEffect(() => {
    analytics.trackSection(activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    portalLogout();
    navigate('/');
  };

  if (!portalUser) return null;

  return (
    <div style={{ minHeight: '100vh', background: DARKER, fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      {/* Top Nav */}
      <nav style={{
        background: DARK, borderBottom: '1px solid rgba(184,147,58,0.2)',
        padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px', position: 'sticky', top: 0, zIndex: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={LOGO_URL} alt="Rosie AI" style={{ height: '38px', width: 'auto' }} />
          <div style={{ width: '1px', height: '24px', background: 'rgba(184,147,58,0.3)' }} />
          <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase' }}>Investor Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>{portalUser.name || portalUser.email}</span>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px' }}>
              Admin
            </button>
          )}
          <button onClick={handleLogout} style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px' }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div style={{ background: DARK, borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', display: 'flex', gap: '0' }}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            background: 'none', border: 'none', borderBottom: activeTab === id ? `2px solid ${GOLD}` : '2px solid transparent',
            color: activeTab === id ? GOLD : '#6b7280', padding: '16px 20px',
            cursor: 'pointer', fontSize: '12px', letterSpacing: '1px',
            transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 40px' }}>
        {activeTab === 'home' && <PortalHome setActiveTab={setActiveTab} />}
        {activeTab === 'offering' && <InvestmentOffering />}
        {activeTab === 'subscription' && <SubscriptionAgreements />}
        {activeTab === 'market' && <MarketData />}
        {activeTab === 'updates' && <InvestorUpdates isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

// ─── Portal Home / Overview ───────────────────────────────────────────────
// ─── Raise Progress Bars ─────────────────────────────────────────────────
function RaiseProgress() {
  const [s, setS] = useState(getPortalSettings());
  useEffect(() => {
    const handler = (e) => setS(e.detail);
    window.addEventListener('portalSettingsChanged', handler);
    return () => window.removeEventListener('portalSettingsChanged', handler);
  }, []);

  const TOTAL_RAISE = Number(s.totalRaise) || 2500000;
  const COMMITTED = Number(s.committedCapital) || 0;
  const INVESTED = Number(s.investedCapital) || 0;
  const INVESTED_TARGET = Number(s.investedTarget) || 500000;

  const committedPct = Math.min((COMMITTED / TOTAL_RAISE) * 100, 100);
  const investedPct = Math.min((INVESTED / INVESTED_TARGET) * 100, 100);

  const fmt = (n) => n >= 1000000
    ? `$${(n / 1000000).toFixed(2)}M`
    : `$${(n / 1000).toFixed(0)}K`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
      {[
        {
          label: 'Committed Capital',
          current: COMMITTED,
          total: TOTAL_RAISE,
          pct: committedPct,
          color: GOLD,
          sub: `${fmt(COMMITTED)} of ${fmt(TOTAL_RAISE)} raise`,
        },
        {
          label: 'Invested Capital',
          current: INVESTED,
          total: INVESTED_TARGET,
          pct: investedPct,
          color: '#4ade80',
          sub: `${fmt(INVESTED)} of ${fmt(INVESTED_TARGET)} deployed`,
        },
      ].map(({ label, current, total, pct, color, sub }) => (
        <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <span style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ color, fontSize: '22px', fontWeight: 'bold' }}>{Math.round(pct)}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '2px', height: '6px', marginBottom: '10px', overflow: 'hidden' }}>
            <div style={{
              background: `linear-gradient(90deg, ${color}88, ${color})`,
              width: `${pct}%`, height: '100%', borderRadius: '2px',
              transition: 'width 1s ease',
              boxShadow: `0 0 8px ${color}66`,
            }} />
          </div>
          <div style={{ color: '#4a5568', fontSize: '11px' }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Rosie AI Chat Bot ────────────────────────────────────────────────────
function RosieChat() {
  const [settings, setSettings] = useState(getPortalSettings());
  useEffect(() => {
    const handler = (e) => setSettings(e.detail);
    window.addEventListener('portalSettingsChanged', handler);
    return () => window.removeEventListener('portalSettingsChanged', handler);
  }, []);

  const [messages, setMessages] = useState(() => {
    const s = getPortalSettings();
    return [{ role: 'assistant', text: s.chatbotGreeting }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const systemPrompt = settings.chatbotContext || `You are Rosie, the investment assistant for Rosie AI LLC. Be concise and professional.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...messages.filter(m => m.role !== 'system').map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.text
            })),
            { role: 'user', content: userMsg }
          ]
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "I'm having trouble connecting right now. Please email Investors@RosieAI.com for assistance.";
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "I'm having trouble connecting. Please email Investors@RosieAI.com for assistance." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const quickQuestions = [
    'What are the investment terms?',
    'How does Rosie AI work?',
    'What is the minimum investment?',
    'How do I subscribe?',
  ];

  if (!settings.chatbotEnabled) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '32px', right: '32px',
          background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
          color: '#0a0f1e', border: 'none', borderRadius: '50px',
          padding: '14px 24px', cursor: 'pointer',
          fontSize: '13px', fontWeight: '700', letterSpacing: '1px',
          boxShadow: '0 8px 32px rgba(184,147,58,0.5)',
          display: 'flex', alignItems: 'center', gap: '10px',
          zIndex: 500, fontFamily: 'Georgia, serif',
        }}
      >
        <span style={{ fontSize: '18px' }}>🤖</span> Talk to Rosie
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      width: '380px', height: '520px',
      background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.3)',
      borderRadius: '4px', display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      zIndex: 500, overflow: 'hidden',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Chat Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(184,147,58,0.2), rgba(184,147,58,0.08))',
        borderBottom: '1px solid rgba(184,147,58,0.2)',
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', flexShrink: 0,
          }}>🤖</div>
          <div>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Rosie AI Assistant</div>
            <div style={{ color: '#4ade80', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', background: '#4ade80', borderRadius: '50%', display: 'inline-block' }} />
              Online · Investment Q&A
            </div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #b8933a, #d4aa50)'
                : 'rgba(255,255,255,0.06)',
              color: msg.role === 'user' ? '#0a0f1e' : '#c4cdd8',
              padding: '10px 14px', borderRadius: '3px',
              fontSize: '13px', lineHeight: 1.55,
              border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px', borderRadius: '3px', color: GOLD, fontSize: '18px', letterSpacing: '3px' }}>
              ···
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {quickQuestions.map(q => (
            <button key={q} onClick={() => {
              setMessages(prev => [...prev, { role: 'user', text: q }]);
              setLoading(true);
              fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 1000,
                  system: `You are Rosie, the AI investment assistant for Rosie AI LLC — an enterprise AI voice agent platform. Be concise, professional, and confident. Key facts: Raise: $2.5M SAFE Note, $15M valuation cap, 20% discount. Minimum investment: $25,000. Rosie AI automates sales calls using AI — 15x cheaper than human SDRs at $0.01/min. Market: AI Voice API growing from $4.1B to $40B by 2032 (38.46% CAGR). Current ARR: $380K, 47+ clients. Contact: Investors@RosieAI.com | 216-332-4234. Keep answers to 2-4 sentences.`,
                  messages: [{ role: 'user', content: q }]
                })
              }).then(r => r.json()).then(data => {
                const reply = data.content?.[0]?.text || 'Please email Investors@RosieAI.com for assistance.';
                setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
                setLoading(false);
              }).catch(() => {
                setMessages(prev => [...prev, { role: 'assistant', text: 'Please email Investors@RosieAI.com for assistance.' }]);
                setLoading(false);
              });
            }}
              style={{
                background: 'rgba(184,147,58,0.1)', border: '1px solid rgba(184,147,58,0.25)',
                color: '#b8933a', borderRadius: '20px', padding: '5px 12px',
                fontSize: '11px', cursor: 'pointer', fontFamily: 'Georgia, serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(184,147,58,0.1)'}
            >{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about the investment..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px',
            padding: '9px 12px', color: '#e8e0d0', fontSize: '13px',
            outline: 'none', fontFamily: 'Georgia, serif',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? 'rgba(184,147,58,0.3)' : 'linear-gradient(135deg, #b8933a, #d4aa50)',
            color: '#0a0f1e', border: 'none', borderRadius: '2px',
            width: '38px', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >→</button>
      </div>
    </div>
  );
}

// ─── Portal Home ──────────────────────────────────────────────────────────
function PortalHome({ setActiveTab }) {
  const [s, setS] = useState(getPortalSettings());
  useEffect(() => {
    const handler = (e) => setS(e.detail);
    window.addEventListener('portalSettingsChanged', handler);
    return () => window.removeEventListener('portalSettingsChanged', handler);
  }, []);

  const navCards = [
    { tab: 'offering',     icon: '📊', title: 'Investment Offering',      desc: 'Full memorandum, financials, team & terms. Download PDF.' },
    { tab: 'subscription', icon: '✍️', title: 'Subscription Agreements', desc: 'Execute docs & request DocuSign. Min. $25K.' },
    { tab: 'market',       icon: '📈', title: 'Market Data',              desc: 'M&A comps, SaaS multiples & AI voice trends.' },
    { tab: 'updates',      icon: '📬', title: 'Investor Updates',         desc: 'Chronological management updates & milestones.' },
  ];

  return (
    <div>
      {/* ── Top two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', marginBottom: '32px', alignItems: 'start' }}>

        {/* LEFT: Header + Raise bars + Calculator */}
        <div>
          {/* Header */}
          <p style={{ color: GOLD, fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '10px', margin: '0 0 10px' }}>
            {s.portalTagline}
          </p>
          <h1 style={{ color: '#e8e0d0', fontSize: '30px', fontWeight: 'normal', margin: '0 0 12px', lineHeight: 1.2, fontFamily: 'Georgia, serif' }}>
            {s.portalHeadline?.split('\n').map((line, i) => <span key={i}>{line}{i === 0 ? <br /> : null}</span>)}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.65, margin: '0 0 28px', maxWidth: '560px' }}>
            {s.portalSubtext}
          </p>

          {/* Raise Progress Bars */}
          <RaiseProgress />

          {/* Investor Calculator */}
          <InvestorCalculator />
        </div>

        {/* RIGHT: Nav cards (4 narrow tall) + Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {navCards.map(({ tab, icon, title, desc }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '2px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
                color: 'inherit', display: 'flex', gap: '14px', alignItems: 'flex-start',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(184,147,58,0.35)'; e.currentTarget.style.background = 'rgba(184,147,58,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '2px', flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', marginBottom: '3px', fontFamily: 'Georgia, serif' }}>{title}</div>
                <div style={{ color: '#5a6a7e', fontSize: '11px', lineHeight: 1.5 }}>{desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#3a4a5e', fontSize: '14px', flexShrink: 0 }}>→</span>
            </button>
          ))}

          {/* Contact Card */}
          <div style={{
            background: 'rgba(184,147,58,0.06)', border: '1px solid rgba(184,147,58,0.18)',
            borderRadius: '2px', padding: '18px 18px', marginTop: '4px',
          }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
              Investor Relations
            </div>
            <div style={{ color: '#c4cdd8', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>{s.companyName}</div>
            <div style={{ color: '#6b7280', fontSize: '12px', lineHeight: 2 }}>
              {s.address1}<br />
              {s.address2}<br />
              <a href={`tel:${s.phone?.replace(/\D/g,'')}`} style={{ color: '#8a9ab8', textDecoration: 'none' }}>{s.phone}</a><br />
              <a href={`mailto:${s.email}`} style={{ color: GOLD, textDecoration: 'none', fontSize: '12px' }}>
                {s.email}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Disclosure */}
      <div style={{ paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ color: '#2d3748', fontSize: '11px', lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: '#374151' }}>Important Disclosure:</strong> {s.disclosureText}
        </p>
      </div>

      {/* Floating AI Chat */}
      <RosieChat />
    </div>
  );
}