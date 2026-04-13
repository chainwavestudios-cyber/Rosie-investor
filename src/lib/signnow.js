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

// ─── Full send flow: create doc from template + send invite ──────────────
export async function signnowSendDocuments(accessToken, templates, signerEmail, signerName) {
  const results = [];
  for (const tpl of templates) {
    try {
      const docData = await signnowCreateDocFromTemplate(
        accessToken,
        tpl.templateId,
        `${tpl.name} — ${signerName} — ${new Date().toLocaleDateString()}`
      );
      const documentId = docData.id;
      await signnowSendInvite(accessToken, documentId, signerEmail, signerName);
      results.push({ name: tpl.name, documentId, status: 'sent', sentAt: new Date().toISOString() });
    } catch (e) {
      results.push({ name: tpl.name, error: e.message, status: 'error' });
    }
  }
  return results;
}