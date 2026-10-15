import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { PIPELINE_VERSION, pipelineCatalog, resolvePipeline, loadAgentConfig } from '../../shared/aiAgentPipeline.ts';

export default async function(req) {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    let actor;
    if (body.sessionUserId && body.sessionToken) {
      const session = await client.functions.invoke('debtCoachAuth', { action: 'me', sessionUserId: body.sessionUserId, sessionToken: body.sessionToken });
      actor = session.data?.user;
      if (actor?.role !== 'super_admin') return Response.json({ error: 'Super Admin access required.' }, { status: 403 });
    } else {
      actor = await client.auth.me();
      if (actor?.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });
    }
    const service = client.asServiceRole;
    if (body.action === 'save') {
      const pipeline = resolvePipeline(body.config);
      if (!pipeline.valid) return Response.json({ error: pipeline.errors.join(' ') }, { status: 400 });
      const existing = await loadAgentConfig(service);
      // Never accept system fields or a caller-chosen singleton name.
      const fields = ['isActive', 'twilioLineKey', 'transferPhoneNumber', 'transferPhoneNumber2', 'queueTimeoutSeconds', 'sttEngine', 'ttsEngine', 'ttsVoiceModel', 'ttsSynthesisModel', 'llmModel', 'kbPrimary', 'kbSecondary', 'greeting', 'systemPrompt', 'scriptFlow', 'dynamicRebuttals', 'qaTuning', 'callbackBookingEnabled', 'preTransferEmailEnabled'];
      const payload = Object.fromEntries(fields.filter(key => body.config[key] !== undefined).map(key => [key, body.config[key]]));
      const config = existing ? await service.entities.AIAgentConfig.update(existing.id, { ...payload, updatedBy: actor.username || actor.full_name }) : await service.entities.AIAgentConfig.create({ ...payload, configName: 'default', updatedBy: actor.username || actor.full_name });
      return Response.json({ config, pipeline });
    }
    const config = await loadAgentConfig(service);
    const pipeline = resolvePipeline(config || {});
    let bridge = { state: 'unavailable', message: 'Bridge address or playback credential is not configured.' };
    const url = (secrets.get('WS_BRIDGE_URL') || '').replace(/^wss:/, 'https:').replace(/\/ws\/?$/, '').replace(/\/$/, '');
    const token = secrets.get('PLAY_AUTH_TOKEN');
    if (url && token) {
      try {
        const response = await fetch(`${url}/runtime`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(7000) });
        if (response.ok) {
          const report = await response.json();
          bridge = report.version === PIPELINE_VERSION ? { state: 'connected', ...report } : { state: 'outdated', message: 'Bridge runtime version does not match. Redeploy the bridge.' };
        } else bridge = { state: response.status === 404 ? 'outdated' : 'unavailable', message: response.status === 404 ? 'Running bridge does not support runtime cross-checks yet. Publish app changes and redeploy the Render bridge.' : `Bridge cross-check returned ${response.status}. Check its playback credential.` };
      } catch { bridge = { state: 'unavailable', message: 'Could not reach the bridge for a runtime cross-check. No live settings are verified.' }; }
    }
    return Response.json({ config, pipeline, catalog: pipelineCatalog, bridge, checkedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message || 'Cross-check failed.' }, { status: error.status === 401 ? 401 : 500 });
  }
}