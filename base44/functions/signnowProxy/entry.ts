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

      // Fetch the template's routing details and substitute the investor's email for "Unassigned Email 1"
      const templateRes = await fetch(`${SIGNNOW_BASE}/documentgroup/template/${documentGroupTemplateId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const templateData = await templateRes.json();
      const templateRouting = templateData.routing_details;

      // Deep-clone and replace "Unassigned Email 1" with the actual signer email
      const routingJson = JSON.stringify(templateRouting).replace(/Unassigned Email 1/g, signerEmail);
      const builtRouting = JSON.parse(routingJson);

      // Remap template document_ids to the newly created group's document_ids
      // The created group documents are in createData.data.documents
      const createdDocs = createData.data?.documents || [];
      // Build a map from template doc name -> new doc id
      const docNameToNewId = {};
      for (const doc of createdDocs) {
        docNameToNewId[doc.document_name || doc.name] = doc.id;
      }
      // Also build index-based fallback
      const createdDocIds = createdDocs.map(d => d.id);

      // Collect all unique template doc IDs referenced in routing
      const templateDocIds = [];
      for (const step of (builtRouting?.invite_steps || [])) {
        for (const action of (step.invite_actions || [])) {
          if (action.document_id && !templateDocIds.includes(action.document_id)) {
            templateDocIds.push(action.document_id);
          }
        }
      }
      // Map template doc id -> new doc id by position
      const templateIdToNewId = {};
      templateDocIds.forEach((tId, i) => {
        templateIdToNewId[tId] = createdDocIds[i] || createdDocIds[0];
      });

      // Strip null/empty authentication and remap document_ids
      for (const step of (builtRouting?.invite_steps || [])) {
        for (const action of (step.invite_actions || [])) {
          if (action.authentication && action.authentication.type == null) {
            delete action.authentication;
          }
          if (action.document_id && templateIdToNewId[action.document_id]) {
            action.document_id = templateIdToNewId[action.document_id];
          }
        }
      }

      // Update invite_emails subject/message for the signer
      if (builtRouting?.invite_steps) {
        for (const step of builtRouting.invite_steps) {
          for (const email of (step.invite_emails || [])) {
            if (email.email === signerEmail) {
              email.subject = 'Investment Documents — Signature Required';
              email.message = message || `Dear ${signerName}, please review and sign the attached investment documents.`;
              email.expiration_days = 30;
            }
          }
        }
      }

      // Step 2: Send field invite on the document group
      const finalRoutingDetails = routingDetails || builtRouting;

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