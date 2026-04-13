/**
 * SignNow API Integration — proxied through backend to avoid CORS
 */

import { base44 } from '@/api/base44Client';

const proxy = (action, params) =>
  base44.functions.invoke('signnowProxy', { action, ...params }).then(r => r.data);

// ─── Auth ─────────────────────────────────────────────────────────────────
export async function signnowGetToken(clientId, clientSecret, username, password) {
  return proxy('getToken', { clientId, clientSecret, username, password });
}

// ─── Create Document from Template ───────────────────────────────────────
export async function signnowCreateDocFromTemplate(accessToken, templateId, documentName) {
  return proxy('createDocFromTemplate', { accessToken, templateId, documentName });
}

// ─── Send Invite (signature request) ─────────────────────────────────────
export async function signnowSendInvite(accessToken, documentId, signerEmail, signerName, message = '') {
  return proxy('sendInvite', { accessToken, documentId, signerEmail, signerName, message });
}

// ─── Get Document Status ──────────────────────────────────────────────────
export async function signnowGetDocument(accessToken, documentId) {
  return proxy('getDocument', { accessToken, documentId });
}

// ─── Download Signed Document ─────────────────────────────────────────────
export async function signnowDownloadDocument(accessToken, documentId) {
  const response = await base44.functions.invoke('signnowProxy', { action: 'downloadDocument', accessToken, documentId });
  // response.data is the PDF blob from axios
  return new Blob([response.data], { type: 'application/pdf' });
}

// ─── Send Document Group Template invite ─────────────────────────────────
export async function signnowSendDocumentGroupInvite(accessToken, documentGroupTemplateId, signerEmail, signerName, message = '') {
  return proxy('sendDocumentGroupInvite', { accessToken, documentGroupTemplateId, signerEmail, signerName, message });
}

// ─── Full send flow ───────────────────────────────────────────────────────
// Supports both document group templates (single ID = all docs) and regular templates
export async function signnowSendDocuments(accessToken, templates, signerEmail, signerName) {
  // If there's only one template and it looks like a doc group template, use the group flow
  // We detect this by trying the group flow first for template1
  if (templates.length >= 1) {
    try {
      const result = await signnowSendDocumentGroupInvite(
        accessToken,
        templates[0].templateId,
        signerEmail,
        signerName,
        `Dear ${signerName}, please review and sign the attached investment documents.`
      );
      // Success — all docs sent as a group
      return templates.map(tpl => ({ name: tpl.name, documentGroupId: result.documentGroupId, status: 'sent', sentAt: new Date().toISOString() }));
    } catch (e) {
      // Fall back to per-template flow
    }
  }

  // Fallback: individual template flow
  const results = [];
  for (const tpl of templates) {
    try {
      const docData = await signnowCreateDocFromTemplate(
        accessToken,
        tpl.templateId,
        `${tpl.name} — ${signerName} — ${new Date().toLocaleDateString()}`
      );
      await signnowSendInvite(accessToken, docData.id, signerEmail, signerName);
      results.push({ name: tpl.name, documentId: docData.id, status: 'sent', sentAt: new Date().toISOString() });
    } catch (e) {
      results.push({ name: tpl.name, error: e.message, status: 'error' });
    }
  }
  return results;
}