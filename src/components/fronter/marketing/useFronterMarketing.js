import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

export default function useFronterMarketing() {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [template, setTemplate] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const call = useCallback(async (action, payload = {}) => {
    try {
      const response = await base44.functions.invoke('sendFronterMarketingEmail', { action, ...payload, sessionUserId, sessionToken });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.data?.error || error.message);
    }
  }, [sessionUserId, sessionToken]);
  const loadCatalog = useCallback(async (offset = 0) => {
    setError('');
    try {
      const data = await call('list', { offset });
      setTemplates(previous => offset ? [...previous, ...data.templates] : data.templates);
      setHasMore(data.hasMore); setCanEdit(data.canEdit);
      if (!offset) setTemplateId(previous => previous || data.templates.find(t => /steph/i.test(t.name))?.id || data.templates[0]?.id || '');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [call]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setTemplate(null); setError('');
    try {
      const data = await call('get', { templateId });
      setTemplate(data.template); setPreviewHtml(data.previewHtml);
    } catch (e) { setError(e.message); }
  }, [call, templateId]);
  useEffect(() => { loadTemplate(); }, [loadTemplate]);
  return { call, templates, templateId, setTemplateId, template, previewHtml, canEdit, loading, error, hasMore, loadCatalog, loadTemplate };
}