/**
 * SmartLeadsTab.jsx — The Smart Leads AI director dashboard.
 * Sub-tabs: AI Chat | Settings | Scheduler | Enrichment | Feedback
 *
 * The AI chatbot is the primary interface for refining the scraper.
 * Settings shows all keywords/phrases (editable manually or by AI).
 * Scheduler controls the automated scraping schedule.
 * Enrichment controls whether leads are auto-enriched (disabled by default).
 * Feedback shows rejection feedback the AI has learned from.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import SmartLeadsChat from '@/components/debt/SmartLeadsChat';
import SmartLeadsSettings from '@/components/debt/SmartLeadsSettings';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const SUB_TABS = [
  { id: 'chat', label: '🧠 AI Chat' },
  { id: 'settings', label: '⚙️ Settings' },
  { id: 'scheduler', label: '⏰ Scheduler' },
  { id: 'enrichment', label: '🔍 Enrichment' },
  { id: 'feedback', label: '📊 Feedback' },
];

export default function SmartLeadsTab() {
  const { user: coachUser } = useDebtCoachAuth();
  const [subTab, setSubTab] = useState('chat');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingEnrichment, setSavingEnrichment] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('smartLeadsChat', { action: 'get_config' });
      setConfig((res?.data || res)?.config || null);
    } catch (e) { console.error('Failed to load config:', e); }
    setLoading(false);
  }, []);

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const all = await base44.entities.SmartLeadFeedback.list('-created_date', 50);
      setFeedback(all || []);
    } catch (e) { console.error('Failed to load feedback:', e); }
    setFeedbackLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (subTab === 'feedback') loadFeedback(); }, [subTab, loadFeedback]);

  const updateSchedule = async (updates) => {
    setSavingSchedule(true);
    try {
      await base44.functions.invoke('smartLeadsChat', { action: 'update_config', updates, username: coachUser?.username });
      loadConfig();
    } catch (e) { alert('Failed to update schedule: ' + (e?.message || String(e))); }
    setSavingSchedule(false);
  };

  const updateEnrichment = async (updates) => {
    setSavingEnrichment(true);
    try {
      await base44.functions.invoke('smartLeadsChat', { action: 'update_config', updates, username: coachUser?.username });
      loadConfig();
    } catch (e) { alert('Failed to update enrichment: ' + (e?.message || String(e))); }
    setSavingEnrichment(false);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280', fontSize: '14px' }}>Loading Smart Leads…</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: `linear-gradient(135deg,${GOLD},#22c55e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🧠</div>
        <div>
          <div style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold' }}>Smart Leads</div>
          <div style={{ color: '#6b7280', fontSize: '12px' }}>AI director that learns what leads you need and refines the scraper automatically</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '16px', overflowX: 'auto' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            borderBottom: `2px solid ${subTab === t.id ? GOLD : 'transparent'}`,
            color: subTab === t.id ? GOLD : '#6b7280', cursor: 'pointer',
            fontSize: '13px', fontWeight: subTab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Chat tab */}
      {subTab === 'chat' && (
        <div style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
          <SmartLeadsChat coachUser={coachUser} onConfigUpdated={loadConfig} />
        </div>
      )}

      {/* Settings tab */}
      {subTab === 'settings' && (
        <SmartLeadsSettings config={config} onConfigChange={loadConfig} />
      )}

      {/* Scheduler tab */}
      {subTab === 'scheduler' && (
        <SchedulerTab config={config} onSave={updateSchedule} saving={savingSchedule} />
      )}

      {/* Enrichment tab */}
      {subTab === 'enrichment' && (
        <EnrichmentTab config={config} onSave={updateEnrichment} saving={savingEnrichment} />
      )}

      {/* Feedback tab */}
      {subTab === 'feedback' && (
        <FeedbackTab feedback={feedback} loading={feedbackLoading} onRefresh={loadFeedback} />
      )}
    </div>
  );
}

// ─── Scheduler Tab ────────────────────────────────────────────────────────────
function SchedulerTab({ config, onSave, saving }) {
  const [cron, setCron] = useState(config?.scheduleCron || '0 0,6,12,18 * * *');
  const [enabled, setEnabled] = useState(config?.scheduleEnabled ?? true);

  useEffect(() => {
    setCron(config?.scheduleCron || '0 0,6,12,18 * * *');
    setEnabled(config?.scheduleEnabled ?? true);
  }, [config]);

  const PRESETS = [
    { label: '4x Daily (12am, 6am, 12pm, 6pm)', cron: '0 0,6,12,18 * * *' },
    { label: '2x Daily (8am, 8pm)', cron: '0 8,20 * * *' },
    { label: 'Daily (8am)', cron: '0 8 * * *' },
    { label: 'Every 6 hours', cron: '0 */6 * * *' },
    { label: 'Every 3 hours', cron: '0 */3 * * *' },
    { label: 'Every hour', cron: '0 * * * *' },
  ];

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '20px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>⏰ Scraping Schedule</div>

        {/* Enable/disable */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setEnabled(p => !p)} style={{
            width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
            background: enabled ? GOLD : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{ position: 'absolute', top: '3px', left: enabled ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
          <div>
            <div style={{ color: enabled ? GOLD : '#8a9ab8', fontSize: '13px', fontWeight: 'bold' }}>{enabled ? 'Scheduled scraping is ON' : 'Scheduled scraping is OFF'}</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>When enabled, the scraper runs automatically on the schedule below</div>
          </div>
        </div>

        {/* Presets */}
        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>Schedule Presets</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {PRESETS.map(p => (
              <button key={p.cron} onClick={() => setCron(p.cron)} style={{
                padding: '8px 12px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer',
                background: cron === p.cron ? `${GOLD}12` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${cron === p.cron ? GOLD + '44' : 'rgba(255,255,255,0.08)'}`,
                color: cron === p.cron ? GOLD : '#8a9ab8', fontSize: '12px',
              }}>
                {cron === p.cron ? '✓ ' : ''}{p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom cron */}
        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>Custom Cron Expression</label>
          <input value={cron} onChange={e => setCron(e.target.value)} style={inp} placeholder="0 0,6,12,18 * * *" />
          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>Format: minute hour day month weekday (UTC). Use America/New_York offset.</div>
        </div>

        {/* Save */}
        <button onClick={() => onSave({ scheduleEnabled: enabled, scheduleCron: cron })} disabled={saving} style={{
          background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px',
          padding: '10px 24px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold',
          letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1,
        }}>
          {saving ? '⏳ Saving…' : '💾 Save Schedule'}
        </button>
      </div>

      <div style={{ marginTop: '12px', padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px' }}>
        <div style={{ color: AMBER, fontSize: '11px' }}>⚠️ Note: Changing the schedule updates the workflow cron. The next automated scrape will use the new schedule.</div>
      </div>
    </div>
  );
}

// ─── Enrichment Tab ──────────────────────────────────────────────────────────
function EnrichmentTab({ config, onSave, saving }) {
  const [autoEnrich, setAutoEnrich] = useState(config?.autoEnrich ?? false);
  const [enrichmentEnabled, setEnrichmentEnabled] = useState(config?.enrichmentEnabled ?? false);

  useEffect(() => {
    setAutoEnrich(config?.autoEnrich ?? false);
    setEnrichmentEnabled(config?.enrichmentEnabled ?? false);
  }, [config]);

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '20px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>🔍 Lead Enrichment Settings</div>

        {/* Warning */}
        <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px' }}>
          <div style={{ color: AMBER, fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>⚠️ Enrichment is OFF by default</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
            We haven't fully dialed in finding the right leads yet. Auto-enrichment is disabled so you can review and reject irrelevant leads first.
            When you're confident the scraper is finding good leads, enable enrichment to automatically resolve identities and find contact info.
          </div>
        </div>

        {/* Auto-enrich toggle */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setAutoEnrich(p => !p)} style={{
            width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
            background: autoEnrich ? GOLD : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{ position: 'absolute', top: '3px', left: autoEnrich ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
          <div>
            <div style={{ color: autoEnrich ? GOLD : '#8a9ab8', fontSize: '13px', fontWeight: 'bold' }}>Auto-Enrich After Scraping</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>When ON, new leads are automatically enriched after each scrape. When OFF, you manually enrich leads.</div>
          </div>
        </div>

        {/* Enrichment enabled toggle */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setEnrichmentEnabled(p => !p)} style={{
            width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
            background: enrichmentEnabled ? GOLD : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{ position: 'absolute', top: '3px', left: enrichmentEnabled ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
          <div>
            <div style={{ color: enrichmentEnabled ? GOLD : '#8a9ab8', fontSize: '13px', fontWeight: 'bold' }}>Enrichment Available</div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>When ON, the "Enrich" button appears on leads. When OFF, enrichment is completely hidden.</div>
          </div>
        </div>

        {/* Save */}
        <button onClick={() => onSave({ autoEnrich, enrichmentEnabled })} disabled={saving} style={{
          background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px',
          padding: '10px 24px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold',
          letterSpacing: '1px', textTransform: 'uppercase', opacity: saving ? 0.5 : 1,
        }}>
          {saving ? '⏳ Saving…' : '💾 Save Enrichment Settings'}
        </button>
      </div>
    </div>
  );
}

// ─── Feedback Tab ────────────────────────────────────────────────────────────
function FeedbackTab({ feedback, loading, onRefresh }) {
  const CATEGORY_LABELS = {
    not_relevant: 'Not Relevant', wrong_demographic: 'Wrong Demographic', spam_or_bot: 'Spam/Bot',
    too_old: 'Too Old', wrong_debt_type: 'Wrong Debt Type', wrong_debt_amount: 'Wrong Debt Amount',
    already_enrolled: 'Already Enrolled', duplicate: 'Duplicate', other: 'Other',
  };
  const CATEGORY_COLORS = {
    not_relevant: RED, wrong_demographic: AMBER, spam_or_bot: PURPLE,
    too_old: BLUE, wrong_debt_type: RED, wrong_debt_amount: AMBER,
    already_enrolled: GOLD, duplicate: '#6b7280', other: '#8a9ab8',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📊 Rejection Feedback — {feedback.length} total</div>
        <button onClick={onRefresh} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Loading feedback…</div>
      ) : feedback.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
          No rejection feedback yet. When you reject a lead from the Lead Gen tab, the feedback appears here and the Smart Leads AI learns from it.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {feedback.map((f, i) => {
            const leadData = (() => { try { return JSON.parse(f.leadDataJson || '{}'); } catch { return {}; } })();
            const color = CATEGORY_COLORS[f.rejectionCategory] || '#8a9ab8';
            return (
              <div key={f.id || i} style={{ background: '#0d1b2a', border: `1px solid ${color}22`, borderRadius: '6px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '3px', background: `${color}18`, color, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>{CATEGORY_LABELS[f.rejectionCategory] || f.rejectionCategory}</span>
                    <span style={{ color: '#6b7280', fontSize: '11px' }}>{leadData.platform} · {leadData.userHandle}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {f.processedByAI ? (
                      <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>🧠 AI Processed</span>
                    ) : (
                      <span style={{ color: AMBER, fontSize: '10px', fontWeight: 'bold' }}>⏳ Pending AI</span>
                    )}
                    <span style={{ color: '#4a5568', fontSize: '10px' }}>{new Date(f.created_date).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, marginBottom: '8px' }}>{f.rejectionReason}</div>
                {leadData.postText && (
                  <div style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', borderRadius: '3px', padding: '6px 10px', marginBottom: '8px' }}>
                    "{leadData.postText?.substring(0, 150)}…"
                  </div>
                )}
                {f.aiLearningNotes && (
                  <div style={{ padding: '8px 10px', background: 'rgba(16,185,129,0.06)', border: `1px solid ${GOLD}22`, borderRadius: '3px' }}>
                    <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>🧠 AI Learning: </span>
                    <span style={{ color: '#c4cdd8', fontSize: '11px' }}>{f.aiLearningNotes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}