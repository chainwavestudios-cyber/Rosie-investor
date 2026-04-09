import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import analytics from '@/lib/analytics';
import { getPortalSettings, loadPortalSettings } from '@/lib/portalSettings';
import RosieVoiceAgent from '@/components/RosieVoiceAgent';
import { InvestorUpdateDB, DocusignRequestDB } from '@/api/entities';

const LOGO_URL = "https://media.base44.com/images/public/69cd2741578c9b5ce655395b/39a31f9b9_Untitleddesign3.png";

const GOLD = '#b8933a';
const GOLD2 = '#d4aa50';
const DARK = '#0a0f1e';
const DARKER = '#060c18';

const h2 = { color: '#e8e0d0', fontSize: '20px', marginTop: 0, marginBottom: '16px', fontFamily: 'Georgia, serif', fontWeight: 'normal' };
const bodyText = { color: '#8a9ab8', lineHeight: 1.7, fontSize: '14px', marginBottom: '16px' };
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

  const handleSubmit = async () => {
    try {
      await DocusignRequestDB.create({
        ...form,
        submittedByUsername: sessionStorage.getItem('rosie_portal_auth')
          ? JSON.parse(sessionStorage.getItem('rosie_portal_auth')).username
          : 'unknown',
      });
    } catch (e) {
      console.error('DocuSign save failed:', e);
    }
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


const PPM_PDF_URL = 'https://media.base44.com/files/public/69cd2741578c9b5ce655395b/4be131d5b_RosieAI_PPM_revised3.pdf';

const PPM_INDEX = [
  { id: 'cover',         label: 'Cover Page',                       page: 1  },
  { id: 'notices',       label: 'Notices',                          page: 2  },
  { id: 'summary',       label: 'Summary of Terms',                 page: 4  },
  { id: 'focus',         label: 'Focus of the Offering',            page: 5  },
  { id: 'revenue',       label: 'Revenue Projections & Milestones', page: 6  },
  { id: 'subscribe',     label: 'How to Subscribe',                 page: 7  },
  { id: 'intro',         label: 'Rosie AI Introduction',            page: 9  },
  { id: 'positioning',   label: 'Unique Positioning',               page: 10 },
  { id: 'leadership',    label: 'Leadership & Architects',          page: 12 },
  { id: 'orgchart',      label: 'Organizational Chart',             page: 14 },
  { id: 'capitalization',label: 'Capitalization & Management',      page: 15 },
  { id: 'fiduciary',     label: 'Fiduciary Responsibilities',        page: 16 },
  { id: 'risk-mgmt',     label: 'Risk Management & Exit Strategy',  page: 18 },
  { id: 'terms',         label: 'Terms of the Offering',            page: 19 },
  { id: 'subscribing',   label: 'Subscribing to the Offering',      page: 20 },
  { id: 'proceeds',      label: 'Use of Investor Proceeds',         page: 22 },
  { id: 'rights',        label: 'Rights & Liabilities',             page: 25 },
  { id: 'alloc',         label: 'Allocation & Distributions',       page: 26 },
  { id: 'sub-proc',      label: 'Subscription Procedures',          page: 28 },
  { id: 'risk-factors',  label: 'Risk Factors',                     page: 42 },
  { id: 'erisa',         label: 'ERISA Considerations',             page: 50 },
  { id: 'state-notices', label: 'State-Specific Legal Notices',     page: 44 },
  { id: 'additional',    label: 'Additional Information',           page: 53 },
];

// ─── Tab: Investment Offering (PDF PPM) ──────────────────────────────────
function InvestmentOffering() {
  const [activeSection, setActiveSection] = useState('cover');
  const docIdRef = useRef(null);

  useEffect(() => {
    docIdRef.current = analytics.trackDocumentOpen('Private Placement Memorandum', 'ppm');
    analytics.trackDocumentPageView(docIdRef.current, 1);
    analytics.trackSection('offering-cover');
    return () => { if (docIdRef.current) analytics.trackDocumentClose(docIdRef.current); };
  }, []);

  const goToSection = (sec) => {
    if (sec.id === activeSection) return;
    if (docIdRef.current) analytics.trackDocumentPageView(docIdRef.current, sec.page);
    analytics.trackSection('offering-' + sec.id);
    setActiveSection(sec.id);
  };

  const handleDownload = () => {
    analytics.trackDownload('RosieAI_PPM.pdf', 'pdf');
    const a = document.createElement('a');
    a.href = PPM_PDF_URL;
    a.download = 'RosieAI_PPM.pdf';
    a.target = '_blank';
    a.click();
  };

  const activeSec = PPM_INDEX.find(s => s.id === activeSection) || PPM_INDEX[0];
  const iframeSrc = `https://docs.google.com/viewer?url=${encodeURIComponent(PPM_PDF_URL)}&embedded=true#page=${activeSec.page}`;

  return (
    <div style={{ display: 'flex', gap: '0', minHeight: '700px' }}>
      {/* Sidebar index */}
      <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', maxHeight: '80vh' }}>
        <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', padding: '0 0 10px 16px' }}>Table of Contents</div>
        {PPM_INDEX.map(sec => (
          <button key={sec.id} onClick={() => goToSection(sec)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: activeSection === sec.id ? 'rgba(184,147,58,0.12)' : 'transparent',
            border: 'none', borderLeft: activeSection === sec.id ? `3px solid ${GOLD}` : '3px solid transparent',
            padding: '10px 14px', cursor: 'pointer', transition: 'all 0.12s',
          }}>
            <div style={{ color: activeSection === sec.id ? GOLD : '#c4cdd8', fontSize: '12px', lineHeight: 1.3 }}>{sec.label}</div>
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '2px' }}>p. {sec.page}</div>
          </button>
        ))}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '8px' }}>
          <button onClick={handleDownload} style={{ width: '100%', background: 'rgba(184,147,58,0.15)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '10px', cursor: 'pointer', fontSize: '12px' }}>
            ↓ Download PPM
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
          <div>
            <span style={{ color: GOLD, fontWeight: 'bold', fontSize: '14px' }}>Rosie AI — Private Placement Memorandum</span>
            <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '12px' }}>53 pages · 506c PPM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '12px' }}>
            <span>Viewing: {activeSec.label} (p.{activeSec.page})</span>
            <button onClick={handleDownload} style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', marginLeft: '8px' }}>
              ↓ Download
            </button>
          </div>
        </div>
        <iframe
          key={activeSection}
          src={iframeSrc}
          style={{ flex: 1, width: '100%', minHeight: '640px', border: 'none', background: '#fff' }}
          title="Investment Offering PPM"
        />
      </div>
    </div>
  );
}

// ─── PDF Documents ───────────────────────────────────────────────────────
const PDF_DOCS = [
  {
    id: 'subscription',
    name: 'Subscription Agreement',
    type: 'subscription',
    badge: 'Required',
    desc: 'SAFE Note — Subscription Agreement · 7 pages · Rosie AI LLC',
    url: 'https://media.base44.com/files/public/69cd2741578c9b5ce655395b/088aa5ef3_RosieAI_Subscription_Agreement.pdf',
    totalPages: 7,
  },
  {
    id: 'accreditation',
    name: 'Investor Questionnaire',
    type: 'accreditation',
    badge: 'Required',
    desc: 'Accredited Investor Questionnaire · 7 pages · SEC Rule 501(a)',
    url: 'https://media.base44.com/files/public/69cd2741578c9b5ce655395b/903902aa1_RosieAI_Investor_Questionnaire.pdf',
    totalPages: 7,
  },
];

// ─── Tab: Subscription Agreements ────────────────────────────────────────
function SubscriptionAgreements() {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDocusign, setShowDocusign] = useState(false);
  const docIdRef = useRef(null);

  const openDoc = (doc) => {
    // Close previous
    if (docIdRef.current) analytics.trackDocumentClose(docIdRef.current);
    docIdRef.current = analytics.trackDocumentOpen(doc.name, doc.type);
    analytics.trackDocumentPageView(docIdRef.current, 1);
    analytics.trackSection('subscription-view-' + doc.type);
    setSelectedDoc(doc);
  };

  const closeDoc = () => {
    if (docIdRef.current) { analytics.trackDocumentClose(docIdRef.current); docIdRef.current = null; }
    setSelectedDoc(null);
  };

  const handleDownload = (doc) => {
    analytics.trackDownload(doc.name + '.pdf', 'pdf');
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name + '.pdf';
    a.target = '_blank';
    a.click();
  };

  return (
    <div id="portal-tab-content" style={{ position: 'relative' }}>
      {showDocusign && <DocusignModal onClose={() => setShowDocusign(false)} />}

      <div style={{ display: 'flex', gap: '0', minHeight: '600px' }}>
        {/* Sidebar */}
        <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', padding: '0 0 12px 16px', marginBottom: '4px' }}>Documents</div>
          {PDF_DOCS.map(doc => (
            <button key={doc.id} onClick={() => openDoc(doc)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: selectedDoc?.id === doc.id ? 'rgba(184,147,58,0.12)' : 'transparent',
              border: 'none', borderLeft: selectedDoc?.id === doc.id ? `3px solid ${GOLD}` : '3px solid transparent',
              padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ color: selectedDoc?.id === doc.id ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: selectedDoc?.id === doc.id ? 'bold' : 'normal', marginBottom: '3px' }}>{doc.name}</div>
              <div style={{ color: '#4a5568', fontSize: '11px' }}>{doc.badge} · {doc.totalPages} pages</div>
            </button>
          ))}

          <div style={{ padding: '16px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Downloads</div>
            {PDF_DOCS.map(doc => (
              <button key={doc.id} onClick={() => handleDownload(doc)} style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                border: 'none', color: '#8a9ab8', padding: '6px 0', cursor: 'pointer', fontSize: '12px',
              }}>
                ↓ {doc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main viewer */}
        <div style={{ flex: 1, paddingLeft: '0' }}>
          {!selectedDoc ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '500px', gap: '16px' }}>
              <div style={{ fontSize: '48px' }}>📄</div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>Select a document from the sidebar to view it</div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                {PDF_DOCS.map(doc => (
                  <button key={doc.id} onClick={() => openDoc(doc)} style={{ background: 'rgba(184,147,58,0.12)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '10px 20px', cursor: 'pointer', fontSize: '12px' }}>
                    📖 {doc.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
                <div>
                  <span style={{ color: GOLD, fontWeight: 'bold', fontSize: '14px' }}>{selectedDoc.name}</span>
                  <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '12px' }}>{selectedDoc.totalPages} pages</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleDownload(selectedDoc)} style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '2px', padding: '7px 16px', cursor: 'pointer', fontSize: '12px' }}>↓ Download PDF</button>
                  <button onClick={closeDoc} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', borderRadius: '2px', padding: '7px 12px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                </div>
              </div>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedDoc.url)}&embedded=true`}
                style={{ flex: 1, width: '100%', minHeight: '560px', border: 'none', background: '#fff' }}
                title={selectedDoc.name}
              />
            </div>
          )}
        </div>
      </div>

      {/* DocuSign CTA */}
      <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(184,147,58,0.06)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '2px', marginTop: '24px' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>✍️</div>
        <h3 style={{ color: GOLD, marginBottom: '12px', fontFamily: 'Georgia, serif', fontWeight: 'normal' }}>Ready to Subscribe?</h3>
        <p style={{ color: '#8a9ab8', fontSize: '13px', margin: '0 auto 24px', maxWidth: '400px' }}>After reviewing the documents above, request a DocuSign package to execute your subscription electronically. Our team will respond within 1 business day.</p>
        <button
          onClick={() => { analytics.trackSection('subscription-docusign-request'); setShowDocusign(true); }}
          style={{ background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: DARK, border: 'none', borderRadius: '2px', padding: '14px 36px', cursor: 'pointer', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '700' }}>
          Request DocuSign
        </button>
      </div>
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
function InvestorUpdates({ isAdmin }) {
  const [updates, setUpdates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', content: '', category: 'General Update' });

  useEffect(() => { loadUpdates(); }, []);

  async function loadUpdates() {
    setLoading(true);
    try {
      const arr = await InvestorUpdateDB.list();
      if (arr.length === 0) {
        // Seed sample updates on first load
        await seedSampleUpdates();
        const seeded = await InvestorUpdateDB.list();
        setUpdates(seeded);
      } else {
        setUpdates(arr);
      }
    } catch (e) {
      console.error('loadUpdates:', e);
    } finally {
      setLoading(false);
    }
  }

  async function seedSampleUpdates() {
    const samples = [
      { title: 'Q1 2025 Performance Update', content: 'We are pleased to report strong Q1 2025 results. Revenue grew 47% QoQ to $95K MRR. We onboarded 12 new enterprise clients in solar and insurance verticals. Product shipped 3 major releases including our new Workflow Manager and Apify integration.', category: 'Financial Update', author: 'Management Team', publishedAt: '2025-04-01T00:00:00.000Z' },
      { title: 'New Partnership: Major Telecom Provider', content: 'Rosie AI has signed a strategic partnership with a top-10 US telecom provider, granting us preferred API access and co-marketing opportunities. This partnership is expected to reduce our per-call infrastructure cost by an additional 30% and open access to their enterprise client network.', category: 'Partnership', author: 'Management Team', publishedAt: '2025-03-15T00:00:00.000Z' },
      { title: 'Product Launch: Rosie 2.0', content: 'Today we launched Rosie 2.0, our most significant platform update to date. Highlights include our new real-time conversation AI engine with less than 150ms latency, redesigned campaign management dashboard, and native HubSpot and Salesforce bi-directional sync. Early feedback from beta users has been exceptional.', category: 'Product Update', author: 'Product Team', publishedAt: '2025-02-28T00:00:00.000Z' },
    ];
    for (const s of samples) {
      try { await InvestorUpdateDB.create(s); } catch {}
    }
  }

  async function postUpdate() {
    try {
      await InvestorUpdateDB.create({ title: form.title, content: form.content, category: form.category, author: 'Admin' });
      setForm({ title: '', content: '', category: 'General Update' });
      setShowForm(false);
      loadUpdates();
    } catch (e) {
      console.error('postUpdate:', e);
    }
  }

  async function deleteUpdate(id) {
    if (!window.confirm('Delete this update?')) return;
    try {
      await InvestorUpdateDB.delete(id);
      setUpdates(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      console.error('deleteUpdate:', e);
    }
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
  const { portalUser, portalLogout, isAdmin, isPortalLoading } = usePortalAuth();
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();

  useEffect(() => {
    if (isPortalLoading) return; // wait for auth init
    if (!portalUser) { navigate('/portal-login'); return; }

    // Start a session if there isn't one (e.g. auth restored from sessionStorage,
    // user opened a new tab, or analytics session was otherwise missing)
    if (!analytics.getCurrentSession()) {
      analytics.startSession(portalUser.email, portalUser.name, portalUser.username);
    }

    analytics.trackPageView('portal');
    analytics.trackSection('home');

    // Track session end on tab close / navigate away
    const handleUnload = () => analytics.endSession();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [portalUser, isPortalLoading]);

  useEffect(() => {
    // Each tab switch = new section
    analytics.trackSection(activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    portalLogout();
    navigate('/');
  };

  if (isPortalLoading) {
    return (
      <div style={{ minHeight:'100vh', background:'#060c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:'28px', height:'28px', border:'3px solid rgba(184,147,58,0.2)', borderTop:'3px solid #b8933a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }
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
        {activeTab === 'home' && <PortalHome setActiveTab={setActiveTab} portalUser={portalUser} />}
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
    loadPortalSettings().then(setS);
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

// ─── Portal Home ──────────────────────────────────────────────────────────
function PortalHome({ setActiveTab, portalUser }) {
  const [s, setS] = useState(getPortalSettings());
  useEffect(() => {
    loadPortalSettings().then(setS);
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
      <RosieVoiceAgent userName={portalUser?.name || portalUser?.username || 'Investor'} />
    </div>
  );
}