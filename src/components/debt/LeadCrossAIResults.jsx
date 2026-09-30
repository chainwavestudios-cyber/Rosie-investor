/**
 * LeadCrossAIResults.jsx — Enrichment results matrix for a single lead.
 * Shows enriched emails and phones with confidence-score badges (Green/Yellow/Red),
 * source traceability, and company/domain resolution details.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const GREEN = '#4ade80';
const BLUE = '#60a5fa';

function confidenceColor(c) {
  if (c >= 70) return GREEN;
  if (c >= 50) return AMBER;
  return RED;
}

function confidenceLabel(c) {
  if (c >= 90) return 'HIGH';
  if (c >= 70) return 'HIGH';
  if (c >= 50) return 'MEDIUM';
  return 'LOW';
}

export default function LeadCrossAIResults({ lead, onReenrich, enriching }) {
  const [showSources, setShowSources] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);

  const emails = lead?.enrichedEmailsJson ? (() => { try { return JSON.parse(lead.enrichedEmailsJson); } catch { return []; } })() : [];
  const phones = lead?.enrichedPhonesJson ? (() => { try { return JSON.parse(lead.enrichedPhonesJson); } catch { return []; } })() : [];
  const sources = lead?.leadCrossSourcesJson ? (() => { try { return JSON.parse(lead.leadCrossSourcesJson); } catch { return []; } })() : [];

  const status = lead?.leadCrossStatus || 'pending';

  if (status === 'pending' && emails.length === 0 && phones.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0' }}>
        <div style={{ color: '#4a5568', fontSize: '13px', marginBottom: '16px' }}>
          LeadCross AI enrichment has not been run yet. This will cross-reference
          public web indexes to find verified emails and phone numbers.
        </div>
        <button onClick={onReenrich} disabled={enriching} style={{
          background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e',
          border: 'none', borderRadius: '4px', padding: '10px 28px', cursor: enriching ? 'not-allowed' : 'pointer',
          fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: enriching ? 0.5 : 1,
        }}>
          {enriching ? '⏳ Enriching…' : '🚀 Run LeadCross AI Enrichment'}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>LeadCross AI</span>
          <span style={{ padding: '2px 10px', borderRadius: '3px', background: `${status === 'enriched' ? GREEN : status === 'processing' ? AMBER : '#4a5568'}22`, color: status === 'enriched' ? GREEN : status === 'processing' ? AMBER : '#6b7280', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {status === 'processing' ? '⏳ Processing…' : status}
          </span>
          {lead?.leadCrossEnrichedAt && (
            <span style={{ color: '#4a5568', fontSize: '10px' }}>
              {new Date(lead.leadCrossEnrichedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </div>
        <button onClick={onReenrich} disabled={enriching} style={{
          background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px',
          padding: '6px 16px', cursor: enriching ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: enriching ? 0.5 : 1,
        }}>
          {enriching ? '⏳ Re-enriching…' : '🔄 Re-run'}
        </button>
      </div>

      {/* Company resolution */}
      {(lead?.companyName || lead?.companyDomain) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          {lead?.companyName && <InfoBox label="Company" value={lead.companyName} color={BLUE} />}
          {lead?.companyDomain && <InfoBox label="Domain" value={lead.companyDomain} color={GOLD} />}
          {lead?.jobTitle && <InfoBox label="Job Title" value={lead.jobTitle} color="#a78bfa" />}
        </div>
      )}

      {/* Email matrix */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
          📧 Email Enrichment Matrix — {emails.length} found
        </div>
        {emails.length === 0 ? (
          <div style={{ color: '#4a5568', fontSize: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            No emails found. LeadCross AI could not verify any email variations via public web cross-referencing.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {emails.sort((a, b) => b.confidence - a.confidence).map((e, i) => {
              const color = confidenceColor(e.confidence);
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '3px', background: `${color}22`, color, fontSize: '9px', fontWeight: 'bold', flexShrink: 0 }}>{confidenceLabel(e.confidence)} {e.confidence}%</span>
                  <span style={{ color: '#e8e0d0', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', flex: 1 }}>{e.email}</span>
                  <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0 }}>{e.pattern}</span>
                  <span style={{ padding: '1px 6px', borderRadius: '2px', background: 'rgba(96,165,250,0.1)', color: BLUE, fontSize: '8px', textTransform: 'uppercase', flexShrink: 0 }}>{e.validationType?.replace(/_/g, ' ')}</span>
                  {e.sourceFound && (
                    <button onClick={() => { setSelectedSource({ type: 'email', url: e.sourceFound, label: e.email }); setShowSources(true); }} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '10px', textDecoration: 'underline', flexShrink: 0 }}>source ↗</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Phone matrix */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
          📞 Phone Enrichment Matrix — {phones.length} found
        </div>
        {phones.length === 0 ? (
          <div style={{ color: '#4a5568', fontSize: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
            No phone numbers found via public web cross-referencing.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {phones.sort((a, b) => b.confidence - a.confidence).map((p, i) => {
              const color = confidenceColor(p.confidence);
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '3px', background: `${color}22`, color, fontSize: '9px', fontWeight: 'bold', flexShrink: 0 }}>{confidenceLabel(p.confidence)} {p.confidence}%</span>
                  <span style={{ color: '#e8e0d0', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', flex: 1 }}>{p.phone}</span>
                  <span style={{ padding: '1px 6px', borderRadius: '2px', background: 'rgba(245,158,11,0.1)', color: AMBER, fontSize: '8px', textTransform: 'uppercase', flexShrink: 0 }}>{p.type?.replace(/_/g, ' ')}</span>
                  {p.locationMatch && <span style={{ color: GREEN, fontSize: '9px', flexShrink: 0 }}>✓ area match</span>}
                  {p.source && (
                    <button onClick={() => { setSelectedSource({ type: 'phone', url: p.source, label: p.phone }); setShowSources(true); }} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '10px', textDecoration: 'underline', flexShrink: 0 }}>source ↗</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Source traceability */}
      {sources.length > 0 && (
        <div>
          <button onClick={() => setShowSources(p => !p)} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
            📌 Source Traceability ({sources.length} sources) {showSources ? '−' : '+'}
          </button>
          {showSources && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
              {sources.map((s, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '3px', padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ padding: '1px 6px', borderRadius: '2px', background: 'rgba(96,165,250,0.1)', color: BLUE, fontSize: '8px', textTransform: 'uppercase', flexShrink: 0 }}>{s.type?.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#8a9ab8', fontSize: '11px', flex: 1 }}>{s.snippet}</span>
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: '10px', textDecoration: 'underline', flexShrink: 0 }}>view ↗</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Source detail popup */}
      {selectedSource && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedSource(null)}>
          <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', maxWidth: '500px', width: '90%', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Source Traceability</div>
            <div style={{ color: '#e8e0d0', fontSize: '14px', marginBottom: '10px' }}>{selectedSource.label}</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '6px' }}>Found at:</div>
            <a href={selectedSource.url} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: '12px', wordBreak: 'break-all' }}>{selectedSource.url}</a>
            <div style={{ marginTop: '14px', textAlign: 'right' }}>
              <button onClick={() => setSelectedSource(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '11px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value, color }) {
  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: '4px', padding: '10px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color, fontSize: '13px', fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}