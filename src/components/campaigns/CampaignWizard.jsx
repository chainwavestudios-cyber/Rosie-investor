/**
 * CampaignWizard.jsx — the six-step builder.
 *
 * Holds the draft's working state (the parsed CSV lives here in the browser), the
 * step rail, and one explicit next/back path. Step 6 is the same monitor the
 * campaign list opens, so a running campaign is never edited mid-send.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, GOLD, MUTED, STATUS_TONE, StepRail, WIZARD_STEPS, inputStyle } from './kit';
import CsvUploadStep from './CsvUploadStep';
import FieldMappingStep from './FieldMappingStep';
import CampaignBuildStep from './CampaignBuildStep';
import PersonalizeTestStep from './PersonalizeTestStep';
import CampaignLaunchStep from './CampaignLaunchStep';
import CampaignMonitor from './CampaignMonitor';

export default function CampaignWizard({ campaignId, username, onExit, onChanged }) {
  const [campaign, setCampaign] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [step, setStep] = useState('upload');
  const [furthest, setFurthest] = useState(1);
  const [csv, setCsv] = useState(null);
  const [mapping, setMapping] = useState({});
  const [report, setReport] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const loadTemplates = useCallback(async () => {
    const page = await base44.entities.EmailCampaignTemplate.list('-created_date', 100).catch(() => []);
    setTemplates(page?.items || page || []);
  }, []);

  const load = useCallback(async () => {
    const row = await base44.entities.EmailCampaignJob.get(campaignId).catch(() => null);
    setCampaign(row);
    setName(row?.name || '');
    if (row?.mappingJson) {
      try { setMapping(JSON.parse(row.mappingJson)); } catch { /* start from the suggestions */ }
    }
    return row;
  }, [campaignId]);

  useEffect(() => {
    (async () => {
      const row = await load();
      await loadTemplates();
      if (Number(row?.eligibleCount || 0) > 0) {
        const at = row.templateId ? 3 : 2;
        // A cancelled or finished campaign is looked at end to end, so every step stays reachable.
        setFurthest(['cancelled', 'completed'].includes(row.status) ? WIZARD_STEPS.length - 1 : at);
        setStep(WIZARD_STEPS[at].id);
      }
    })();
  }, [load, loadTemplates]);

  const save = useCallback(async (patch) => {
    setSaving(true);
    const updated = await base44.entities.EmailCampaignJob.update(campaignId, patch);
    setCampaign(updated);
    setSaving(false);
    setNotice('Draft saved.');
    onChanged?.();
    return updated;
  }, [campaignId, onChanged]);

  const saveDraft = async () => {
    await save({ name: name || 'Untitled campaign', ...(mapping && Object.keys(mapping).length ? { mappingJson: JSON.stringify(mapping) } : {}) });
  };

  const goTo = (id) => {
    const index = WIZARD_STEPS.findIndex((s) => s.id === id);
    setStep(id);
    setFurthest((prev) => Math.max(prev, index));
    setNotice('');
  };

  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  const eligibleImported = Number(campaign?.eligibleCount || 0) > 0;

  const canAdvance = useMemo(() => {
    if (step === 'upload') return !!csv || Number(campaign?.importedCount || 0) > 0;
    if (step === 'map') return report?.mode === 'commit' || eligibleImported;
    if (step === 'build') return !!campaign?.templateId;
    return true;
  }, [step, csv, campaign, report, eligibleImported]);

  const hint = useMemo(() => {
    if (canAdvance) return '';
    if (step === 'upload') return 'Upload a CSV or pick from your prospects to continue.';
    if (step === 'map') return 'Run the check, then commit the import to continue.';
    if (step === 'build') return 'Choose an email template to continue.';
    return '';
  }, [step, canAdvance]);

  if (!campaign) return <div style={{ color: MUTED, fontSize: '12px', padding: '20px 0' }}>Loading campaign…</div>;

  const tone = STATUS_TONE[campaign.status] || MUTED;
  const isSendStep = step === 'monitor';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, flex: '1 1 260px', fontSize: '14px', fontWeight: 'bold', color: GOLD }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== campaign.name && save({ name: name || 'Untitled campaign' })}
        />
        <span style={{ background: `${tone}22`, color: tone, border: `1px solid ${tone}55`, borderRadius: '3px', padding: '3px 9px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{campaign.status}</span>
        <Btn tone="ghost" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : '💾 Save draft'}</Btn>
        <Btn tone="ghost" onClick={onExit}>← Campaigns</Btn>
      </div>
      {notice && <div style={{ color: GOLD, fontSize: '11px' }}>{notice}</div>}

      {isSendStep ? (
        <CampaignMonitor campaignId={campaignId} onBack={onExit} onChanged={onChanged} embedded />
      ) : (
        <>
          <StepRail current={step} furthest={furthest} onSelect={goTo} />

          {step === 'upload' && (
            <CsvUploadStep campaign={campaign} csv={csv} setCsv={setCsv} setMapping={setMapping} save={save} username={username} />
          )}
          {step === 'map' && (
            <FieldMappingStep
              campaign={campaign}
              csv={csv}
              mapping={mapping}
              setMapping={setMapping}
              report={report}
              setReport={setReport}
              onCommitted={async () => {
                await save({
                  mappingJson: JSON.stringify(mapping),
                  sourceFile: csv?.fileName || campaign.sourceFile || '',
                  listName: campaign.listName || (csv?.fileName || '').replace(/\.csv$/i, ''),
                });
              }}
            />
          )}
          {step === 'build' && (
            <CampaignBuildStep campaign={campaign} templates={templates} loadTemplates={loadTemplates} save={save} />
          )}
          {step === 'personalize' && <PersonalizeTestStep campaign={campaign} />}
          {step === 'launch' && (
            <CampaignLaunchStep
              campaign={campaign}
              save={save}
              username={username}
              onStarted={() => { setFurthest(5); setStep('monitor'); }}
            />
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {index > 0 && <Btn tone="ghost" onClick={() => goTo(WIZARD_STEPS[index - 1].id)}>← Back</Btn>}
            <div style={{ flex: 1, color: '#f59e0b', fontSize: '11px' }}>{hint}</div>
            {index < WIZARD_STEPS.length - 1 && (
              <Btn tone="gold" onClick={() => canAdvance && goTo(WIZARD_STEPS[index + 1].id)} disabled={!canAdvance}>
                Next: {WIZARD_STEPS[index + 1].label} →
              </Btn>
            )}
          </div>
        </>
      )}
    </div>
  );
}