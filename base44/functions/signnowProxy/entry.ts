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

    // ─── Inspect Document Group Template ─────────────────────────────
    if (action === 'inspectDocGroupTemplate') {
      const { accessToken, templateId } = body;
      const res = await fetch(`${SIGNNOW_BASE}/documentgroup/template/${templateId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      return Response.json({ status: res.status, data });
    }

    // ─── Send Document Group Invite ───────────────────────────────────
    if (action === 'sendDocumentGroupInvite') {
      const { accessToken, documentGroupTemplateId, signerEmail, signerName, signerRole, message, routingDetails } = body;

      // Step 1: Create a document group from the template (V2 API)
      const createRes = await fetch(`${SIGNNOW_BASE}/v2/document-group-templates/${documentGroupTemplateId}/document-group`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: `Investment Docs — ${signerName}` }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(JSON.stringify(createData) || `Create doc group failed (${createRes.status})`);

      const documentGroupId = createData.data?.unique_id;
      if (!documentGroupId) throw new Error('No document group ID returned: ' + JSON.stringify(createData));

      // Get document IDs from the created group
      const docs = createData.data?.documents || [];
      // Build invite actions for each document that has roles
      const inviteActions = docs.map(doc => ({
        email: signerEmail,
        role_name: signerRole || 'Recipient 1',
        action: 'sign',
        document_id: doc.id,
        allow_reassign: 0,
        decline_by_signature: 0,
      }));

      // Step 2: Send field invite on the document group using routing details
      const finalRoutingDetails = routingDetails || {
        invite_steps: [{
          order: 1,
          invite_actions: inviteActions,
          invite_emails: [{
            email: signerEmail,
            subject: 'Investment Documents — Signature Required',
            message: message || `Dear ${signerName}, please review and sign the attached investment documents.`,
            expiration_days: 30,
            reminder: 4,
          }],
        }],
      };

      const inviteRes = await fetch(`${SIGNNOW_BASE}/documentgroup/${documentGroupId}/groupinvite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(finalRoutingDetails),
      });
      const inviteData = await inviteRes.json();
      if (!inviteRes.ok) throw new Error(JSON.stringify(inviteData) || `Send group invite failed (${inviteRes.status})`);
      return Response.json({ documentGroupId, ...inviteData });
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