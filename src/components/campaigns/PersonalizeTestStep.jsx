/**
 * PersonalizeTestStep.jsx — step 4: see one real recipient's email, exactly as it
 * will be built, with that recipient's own invitation links resolved.
 *
 * The preview comes from the server, so what is shown is what a send produces:
 * escaped personalization, tracked links, and the recipient's own tokens.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, Field, GOLD, MUTED, Stat, BORDER, inputStyle } from './kit';

export default function PersonalizeTestStep({ campaign }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testState, setTestState] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await base44.functions.invoke('emailCampaignSend', { mode: 'preview', campaignId: campaign.id })
      .catch((e) => ({ data: { error: e?.response?.data?.error || e?.message } }));
    const data = res?.data || res;
    if (data?.error) setError(data.error);
    setPreview(data?.error ? null : data);
    setLoading(false);
  }, [campaign.id]);

  useEffect(() => { load(); }, [load, campaign.templateId, campaign.subject]);

  const sendTest = async () => {
    setTestState('sending');
    const res = await base44.functions.invoke('emailCampaignSend', { mode: 'test', campaignId: campaign.id, testEmail })
      .catch((e) => ({ data: { error: e?.response?.data?.error || e?.message } }));
    const data = res?.data || res;
    setTestState(data?.error ? `⚠ ${data.error}` : `✓ Tracked Gmail test sent to ${data.to}. The welcome audio uses a unique test-send token, separate from any client's send.`);
  };

  if (loading) return <Card title="Step 4 — Personalize & test"><div style={{ color: MUTED, fontSize: '12px' }}>Building this recipient's email…</div></Card>;
  if (error) return <Card title="Step 4 — Personalize & test"><div style={{ color: '#f59e0b', fontSize: '12px' }}>{error}</div></Card>;

  const rendered = preview?.rendered || {};
  const recipient = preview?.recipient || {};
  const vars = preview?.vars || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Stat label="Merge tags used" value={rendered.tags?.length || 0} color={MUTED} />
        <Stat label="Tags with no value" value={rendered.missing?.length || 0} color={rendered.missing?.length ? '#f59e0b' : GOLD} hint="they stay visible in the email" />
        <Stat label="Images" value={rendered.images || 0} color="#60a5fa" />
        <Stat label="Links" value={rendered.links || 0} color="#60a5fa" hint="each rewritten per recipient" />
      </div>

      <Card
        title={`Preview — ${recipient.firstName || 'recipient'} ${recipient.lastName || ''}`.trim()}
        hint={`Built for ${recipient.email || 'the first recipient'} with their own invitation token, so no other recipient ever sees these links.`}
        actions={<Btn tone="ghost" onClick={load}>↻ Rebuild preview</Btn>}
      >
        <div style={{ color: MUTED, fontSize: '11px', marginBottom: '6px' }}>Subject</div>
        <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', marginBottom: '12px' }}>
          {rendered.subject || '(no subject)'}
        </div>

        {!!rendered.missing?.length && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '9px 11px', color: '#f59e0b', fontSize: '11px', marginBottom: '12px' }}>
            These tags have no value on the recipients: {rendered.missing.map((tag) => `{{${tag}}}`).join(', ')} — they will appear in the email exactly as written.
          </div>
        )}

        <iframe title="Email preview" srcDoc={rendered.html || '<p style="font:14px sans-serif">Nothing to preview.</p>'} style={{ width: '100%', height: '560px', background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '5px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '10px', marginTop: '14px' }}>
          <div>
            <div style={{ color: MUTED, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Resolved for this recipient</div>
            <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '9px 11px', fontSize: '11px', color: '#c4cdd8', lineHeight: 1.7, wordBreak: 'break-all' }}>
              {Object.entries(vars).filter(([, value]) => value).map(([key, value]) => (
                <div key={key}><span style={{ color: GOLD }}>{key}</span>: {String(value).slice(0, 120)}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ color: MUTED, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Test send</div>
            <Field label="Send one copy to" hint="Use your own inbox. Test copies are not tracked and are not logged against the contact.">
              <input style={inputStyle} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <div style={{ marginTop: '8px' }}>
              <Btn tone="blue" onClick={sendTest} disabled={!testEmail || testState === 'sending'}>{testState === 'sending' ? 'Sending…' : '✉ Send test copy'}</Btn>
            </div>
            {testState && testState !== 'sending' && <div style={{ color: testState.startsWith('⚠') ? '#f59e0b' : GOLD, fontSize: '11px', marginTop: '8px' }}>{testState}</div>}
            <div style={{ color: DIM, fontSize: '10px', marginTop: '8px' }}>Unsubscribe link and mailing address fill automatically on real sends.</div>
          </div>
        </div>
      </Card>
    </div>
  );
}