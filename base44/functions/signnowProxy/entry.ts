const SIGNNOW_BASE = 'https://api.signnow.com';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { action } = body;

    // ─── Get OAuth Token ──────────────────────────────────────────────
    if (action === 'getToken') {
      const { clientId, clientSecret, username, password } = body;
      const credentials = btoa(`${clientId}:${clientSecret}`);
      const res = await fetch(`${SIGNNOW_BASE}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'password', username, password, scope: '*' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || `Auth failed (${res.status})`);
      return Response.json(data);
    }

    // ─── Create Document from Template ───────────────────────────────
    if (action === 'createDocFromTemplate') {
      const { accessToken, templateId, documentName } = body;
      const res = await fetch(`${SIGNNOW_BASE}/template/${templateId}/copy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_name: documentName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data) || `Create from template failed (${res.status})`);
      return Response.json(data);
    }

    // ─── Send Invite ──────────────────────────────────────────────────
    if (action === 'sendInvite') {
      const { accessToken, documentId, signerEmail, signerName, message } = body;
      const res = await fetch(`${SIGNNOW_BASE}/document/${documentId}/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: '',
          to: [{
            email: signerEmail,
            role_id: '',
            role: 'Signer 1',
            order: 1,
            reassign: '0',
            decline_by_signature: '0',
            reminder: 0,
            expiration_days: 30,
            subject: 'Investment Documents — Signature Required',
            message: message || `Dear ${signerName}, please review and sign the attached investment documents.`,
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Send invite failed (${res.status})`);
      return Response.json(data);
    }

    // ─── Get Document Status ──────────────────────────────────────────
    if (action === 'getDocument') {
      const { accessToken, documentId } = body;
      const res = await fetch(`${SIGNNOW_BASE}/document/${documentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Get document failed (${res.status})`);
      return Response.json(data);
    }

    // ─── Download Document ────────────────────────────────────────────
    if (action === 'downloadDocument') {
      const { accessToken, documentId } = body;
      const res = await fetch(`${SIGNNOW_BASE}/document/${documentId}/download?type=collapsed`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.arrayBuffer();
      return new Response(blob, {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=document.pdf' },
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});