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

// ─── Hardcoded document group templates ───────────────────────────────────
const DOC_GROUP_TEMPLATES = [
  { id: '916dc3fd4a634a0c810c519e7c0ae4f2d195464d', name: 'Investor Questionnaire' },
  { id: 'c89fe0d48d9541febbcbe3db2bb030d2649d99bf', name: 'Subscription Agreement' },
];

// ─── Full send flow: send each doc group template invite ──────────────────
export async function signnowSendDocuments(accessToken, _templates, signerEmail, signerName) {
  const results = [];
  for (const tpl of DOC_GROUP_TEMPLATES) {
    try {
      const result = await proxy('sendDocumentGroupInvite', {
        accessToken,
        documentGroupTemplateId: tpl.id,
        signerEmail,
        signerName,
        message: `Dear ${signerName}, please review and sign the attached investment documents.`,
      });
      results.push({ name: tpl.name, documentGroupId: result.documentGroupId, status: 'sent', sentAt: new Date().toISOString() });
    } catch (e) {
      // Extract SignNow error from backend response if available
      let errorMsg = e.message;
      if (e.response?.data?.error) errorMsg = e.response.data.error;
      else if (e.response?.data) errorMsg = JSON.stringify(e.response.data);
      results.push({ name: tpl.name, error: errorMsg, status: 'error' });
    }
  }
  return results;
}