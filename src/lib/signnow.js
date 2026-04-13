/**
 * SignNow API Integration
 * Docs: https://docs.signnow.com/docs/signnow/welcome
 *
 * All calls are proxied through a lightweight CORS-friendly approach.
 * The access token is stored in PortalSettings (signnowAccessToken).
 */

const SIGNNOW_BASE = 'https://api.signnow.com';

// ─── Auth ─────────────────────────────────────────────────────────────────
export async function signnowGetToken(clientId, clientSecret, username, password) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${SIGNNOW_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      scope: '*',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || `Auth failed (${res.status})`);
  }
  return res.json(); // { access_token, token_type, expires_in, refresh_token }
}

// ─── Templates ────────────────────────────────────────────────────────────
export async function signnowListTemplates(accessToken) {
  const res = await fetch(`${SIGNNOW_BASE}/user/documentsv2?per_page=50&page=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`List templates failed (${res.status})`);
  return res.json();
}

export async function signnowGetTemplate(accessToken, templateId) {
  const res = await fetch(`${SIGNNOW_BASE}/template/${templateId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Get template failed (${res.status})`);
  return res.json();
}

// ─── Create Document from Template ───────────────────────────────────────
export async function signnowCreateDocFromTemplate(accessToken, templateId, documentName) {
  const res = await fetch(`${SIGNNOW_BASE}/template/${templateId}/copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document_name: documentName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Create from template failed (${res.status})`);
  }
  return res.json(); // { id: documentId }
}

// ─── Send Invite (signature request) ─────────────────────────────────────
export async function signnowSendInvite(accessToken, documentId, signerEmail, signerName, message = '') {
  const res = await fetch(`${SIGNNOW_BASE}/document/${documentId}/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: '', // will use account email
      to: [
        {
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
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Send invite failed (${res.status})`);
  }
  return res.json();
}

// ─── Get Document Status ──────────────────────────────────────────────────
export async function signnowGetDocument(accessToken, documentId) {
  const res = await fetch(`${SIGNNOW_BASE}/document/${documentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Get document failed (${res.status})`);
  return res.json();
}

// ─── Download Signed Document ─────────────────────────────────────────────
export async function signnowDownloadDocument(accessToken, documentId) {
  const res = await fetch(`${SIGNNOW_BASE}/document/${documentId}/download?type=collapsed`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.blob();
}

// ─── Full send flow: create doc from template + send invite ──────────────
export async function signnowSendDocuments(accessToken, templates, signerEmail, signerName) {
  const results = [];
  for (const tpl of templates) {
    try {
      // 1. Copy template to new doc
      const docData = await signnowCreateDocFromTemplate(
        accessToken,
        tpl.templateId,
        `${tpl.name} — ${signerName} — ${new Date().toLocaleDateString()}`
      );
      const documentId = docData.id;

      // 2. Send invite
      await signnowSendInvite(accessToken, documentId, signerEmail, signerName);

      results.push({ name: tpl.name, documentId, status: 'sent', sentAt: new Date().toISOString() });
    } catch (e) {
      results.push({ name: tpl.name, error: e.message, status: 'error' });
    }
  }
  return results;
}