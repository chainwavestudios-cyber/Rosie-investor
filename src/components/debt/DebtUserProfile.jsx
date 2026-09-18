/**
 * DebtUserProfile.jsx — User profile tab showing AI-built profiles from calls.
 * Lists all debt leads with their animal type, intent score, traits, and recommended approach.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

const ANIMAL_COLORS = { duck: '#ef4444', cow: '#4ade80', unknown: '#6b7280' };
const ANIMAL_EMOJI = { duck: '🦆', cow: '🐄', unknown: '❓' };

export default function DebtUserProfile() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.DebtLead.list('-updated_date', 200);
      setLeads(all || []);
      if (all?.length > 0 && !selected) setSelected(all[0]);
    } catch {}
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, []);

  const profile = selected?.profileJson ? (() => { try { return JSON.parse(selected.profileJson); } catch { return null; } })() : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>
      {/* Lead list */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>👤 Debt Leads</div>
          <button onClick={load} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>↻</button>
        </div>
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
          ) : leads.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No debt leads yet. Start a live call to create one.</div>
          ) : leads.map(lead => {
            const p = lead.profileJson ? (() => { try { return JSON.parse(lead.profileJson); } catch { return null; } })() : null;
            const animal = p?.animalType || lead.animalType || 'unknown';
            return (
              <button key={lead.id} onClick={() => setSelected(lead)} style={{ width: '100%', background: selected?.id === lead.id ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ fontSize: '20px' }}>{ANIMAL_EMOJI[animal]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{lead.firstName} {lead.lastName}</div>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>{lead.callCount || 0} calls · {lead.status}</div>
                </div>
                {lead.intentScore != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: ANIMAL_COLORS[animal], fontSize: '14px', fontWeight: 'bold' }}>{lead.intentScore}</div>
                    <div style={{ color: '#4a5568', fontSize: '8px' }}>INTENT</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile detail */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '24px' }}>
        {!selected ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '80px 0', fontSize: '13px' }}>Select a lead to view their AI-built profile.</div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, color: '#e8e0d0', fontSize: '20px', fontWeight: 'normal' }}>{selected.firstName} {selected.lastName}</h2>
                <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>{selected.phone} · {selected.email}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ background: `${ANIMAL_COLORS[profile?.animalType || selected.animalType || 'unknown']}18`, border: `1px solid ${ANIMAL_COLORS[profile?.animalType || selected.animalType || 'unknown']}44`, borderRadius: '4px', padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px' }}>{ANIMAL_EMOJI[profile?.animalType || selected.animalType || 'unknown']}</div>
                  <div style={{ color: ANIMAL_COLORS[profile?.animalType || selected.animalType || 'unknown'], fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>{(profile?.animalType || selected.animalType || 'unknown')}</div>
                </div>
                {selected.intentScore != null && (
                  <div style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '4px', padding: '8px 14px', textAlign: 'center' }}>
                    <div style={{ color: '#f472b6', fontSize: '20px', fontWeight: 'bold' }}>{selected.intentScore}</div>
                    <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Intent</div>
                  </div>
                )}
              </div>
            </div>

            {/* Debt summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
              <StatBox label="Total Debt" value={selected.debtAmount ? `$${selected.debtAmount.toLocaleString()}` : '—'} />
              <StatBox label="Creditors" value={selected.creditorCount || '—'} />
              <StatBox label="Monthly Income" value={selected.monthlyIncome ? `$${selected.monthlyIncome.toLocaleString()}` : '—'} />
              <StatBox label="Credit Score" value={selected.creditScore || '—'} />
            </div>

            {profile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {profile.overallIntentLabel && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Overall Intent</div>
                    <div style={{ color: profile.overallIntentLabel === 'hot' ? '#4ade80' : profile.overallIntentLabel === 'warm' ? '#f59e0b' : '#ef4444', fontSize: '14px', fontWeight: 'bold', textTransform: 'capitalize' }}>{profile.overallIntentLabel}</div>
                  </div>
                )}
                {profile.keyObservations?.length > 0 && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Key Observations</div>
                    {profile.keyObservations.map((o, i) => <div key={i} style={{ color: '#8a9ab8', fontSize: '12px', marginBottom: '4px', lineHeight: 1.5 }}>• {o}</div>)}
                  </div>
                )}
                {profile.recommendedApproach && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Recommended Approach</div>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.6, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '4px', padding: '12px' }}>{profile.recommendedApproach}</div>
                  </div>
                )}
                {profile.traits && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Behavioral Traits</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {Object.entries(profile.traits).filter(([, v]) => v).map(([k]) => (
                        <span key={k} style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px', color: GOLD, fontSize: '11px' }}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.lastCallSummary && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Last Call Summary</div>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6 }}>{profile.lastCallSummary}</div>
                  </div>
                )}
                {profile.animalConfidence != null && (
                  <div>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Animal Confidence</div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${profile.animalConfidence}%`, height: '100%', background: ANIMAL_COLORS[profile.animalType || 'unknown'], borderRadius: '3px' }} />
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>{profile.animalConfidence}% confident</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>No AI profile yet. Run a live call to build this profile automatically.</div>
            )}

            {selected.notes && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Notes</div>
                <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
      <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}