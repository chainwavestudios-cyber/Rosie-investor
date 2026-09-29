import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, managerUsername, dialerUsername, monitorMode, offerSdp, answerSdp, iceCandidates } = body;

    // Verify the manager is an admin or manager
    const managerUsers = await base44.asServiceRole.entities.DebtCoachUser.filter({ username: managerUsername });
    const managerUser = managerUsers?.[0];
    if (!managerUser || !managerUser.isActive) {
      return Response.json({ error: 'Manager not found or inactive' }, { status: 403 });
    }
    if (managerUser.role !== 'admin' && managerUser.role !== 'super_admin' && managerUser.role !== 'manager') {
      return Response.json({ error: 'Only admins and managers can control calls' }, { status: 403 });
    }

    // Find the dialer's active session
    const sessions = await base44.asServiceRole.entities.DialerSession.filter({ username: dialerUsername });
    const activeSession = sessions?.find(s => s.status === 'logged_in' || s.status === 'on_call');
    if (!activeSession) {
      return Response.json({ error: 'Dialer is not online' }, { status: 404 });
    }

    switch (action) {
      case 'startMonitor': {
        await base44.asServiceRole.entities.DialerSession.update(activeSession.id, {
          monitorMode: monitorMode || 'listen',
          monitorManagerUsername: managerUsername,
          webrtcOfferSdp: offerSdp || '',
          webrtcAnswerSdp: '',
          webrtcIceCandidatesJson: '',
        });
        return Response.json({ ok: true, sessionId: activeSession.id });
      }
      case 'sendAnswer': {
        // Agent sends back the WebRTC answer
        await base44.asServiceRole.entities.DialerSession.update(activeSession.id, {
          webrtcAnswerSdp: answerSdp || '',
        });
        return Response.json({ ok: true });
      }
      case 'sendIce': {
        // Either party sends ICE candidates
        const existing = activeSession.webrtcIceCandidatesJson || '[]';
        let candidates = [];
        try { candidates = JSON.parse(existing); } catch {}
        if (iceCandidates) {
          candidates = [...candidates, ...iceCandidates];
        }
        await base44.asServiceRole.entities.DialerSession.update(activeSession.id, {
          webrtcIceCandidatesJson: JSON.stringify(candidates),
        });
        return Response.json({ ok: true, candidates });
      }
      case 'getIce': {
        // Poll for ICE candidates
        let candidates = [];
        try { candidates = JSON.parse(activeSession.webrtcIceCandidatesJson || '[]'); } catch {}
        return Response.json({ ok: true, candidates });
      }
      case 'stopMonitor': {
        await base44.asServiceRole.entities.DialerSession.update(activeSession.id, {
          monitorMode: 'none',
          monitorManagerUsername: '',
          webrtcOfferSdp: '',
          webrtcAnswerSdp: '',
          webrtcIceCandidatesJson: '',
        });
        return Response.json({ ok: true });
      }
      case 'takeover': {
        // End the agent's call — set status to logged_in and clear call info
        await base44.asServiceRole.entities.DialerSession.update(activeSession.id, {
          monitorMode: 'takeover',
          status: 'logged_in',
          currentCallLeadId: '',
          currentCallLeadName: '',
          currentCallPhone: '',
          currentCallStartedAt: '',
          currentCallMode: '',
        });
        // Clear the takeover flag after a short delay so the agent sees it
        setTimeout(async () => {
          try {
            const updated = await base44.asServiceRole.entities.DialerSession.get(activeSession.id);
            if (updated && updated.monitorMode === 'takeover') {
              await base44.asServiceRole.entities.DialerSession.update(activeSession.id, { monitorMode: 'none', monitorManagerUsername: '' });
            }
          } catch {}
        }, 5000);
        return Response.json({ ok: true, message: 'Call taken over. Agent disconnected.' });
      }
      case 'getSession': {
        // Get the current session state (for polling)
        return Response.json({ ok: true, session: activeSession });
      }
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}