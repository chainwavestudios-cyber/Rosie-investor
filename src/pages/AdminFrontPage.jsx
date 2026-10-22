/**
 * AdminFrontPage.jsx — the control room for the front-page chatbot.
 * Every question the visitor is asked, and every rule the assistant follows, lives here:
 * the order of the questions, the debt ranges, the eligibility line, the facts it may
 * state, the things it must never do, and which answers unlock the call-me-now offer.
 * Saving changes the live widget on the front page.
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, MessageSquare, Save } from 'lucide-react';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import WidgetPanel from '@/components/homeadmin/WidgetPanel';
import QuestionsPanel from '@/components/homeadmin/QuestionsPanel';
import RangesPanel from '@/components/homeadmin/RangesPanel';
import GatePanel from '@/components/homeadmin/GatePanel';
import OutcomePanel from '@/components/homeadmin/OutcomePanel';
import ListPanel from '@/components/homeadmin/ListPanel';

export default function AdminFrontPage() {
  const { user, loading, isAuthenticated, isAdmin, isSuperAdmin, sessionToken } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [stamp, setStamp] = useState({ by: '', at: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const allowed = isAdmin || isSuperAdmin;

  const invoke = (payload) =>
    base44.functions
      .invoke('homeQualifyChat', { ...payload, adminUserId: user?.id, adminToken: sessionToken })
      .then((response) => response?.data || {});

  const load = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await invoke({ action: 'config_get' });
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
      setStamp({ by: data.updatedBy || '', at: data.updatedAt || '' });
    } catch (error) {
      setMessage(error.message || 'Could not load the chatbot settings.');
    }
    setBusy(false);
  };

  useEffect(() => {
    if (allowed && !config) load();
  }, [allowed]);

  const patch = (changes) => setConfig((prev) => ({ ...prev, ...changes }));

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await invoke({ action: 'config_save', config });
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
      setStamp({ by: data.updatedBy || '', at: data.updatedAt || '' });
      setMessage('Saved. The front page is using this now.');
    } catch (error) {
      setMessage(error.message || 'Could not save the changes.');
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (!allowed) return <Navigate to="/debt-call-coach" replace />;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">Front page chatbot</h1>
            <p className="text-xs text-slate-500">
              Every question and every rule the website assistant follows lives on this page.
            </p>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => navigate('/superadmin-portal')}>
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Live chats
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !config}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save changes
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5">
        {message && (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{message}</p>
        )}

        {!config ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </CardContent>
          </Card>
        ) : (
          <>
            <WidgetPanel config={config} onChange={patch} />
            <QuestionsPanel questions={config.questions} onChange={(questions) => patch({ questions })} />
            <div className="grid gap-5 lg:grid-cols-2">
              <RangesPanel ranges={config.ranges} onChange={(ranges) => patch({ ranges })} />
              <GatePanel
                questions={config.questions}
                readyFields={config.readyFields}
                onChange={(readyFields) => patch({ readyFields })}
              />
            </div>
            <OutcomePanel config={config} onChange={patch} />
            <ListPanel
              title="Facts the assistant may state"
              description="Program facts it is allowed to give out."
              items={config.facts}
              placeholder="One fact per line"
              onChange={(facts) => patch({ facts })}
            />
            <ListPanel
              title="What the assistant must never do"
              description="Hard rules it can never break, whatever the visitor asks."
              items={config.prohibitions}
              placeholder="One rule per line"
              onChange={(prohibitions) => patch({ prohibitions })}
            />
            <p className="text-xs text-slate-400">
              {stamp.by
                ? `Last saved by ${stamp.by}${stamp.at ? ` · ${new Date(stamp.at).toLocaleString()}` : ''}`
                : 'Not saved yet — the built-in defaults are live.'}
            </p>
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <span className="min-w-0 text-xs text-slate-500">
            {message || 'Changes apply to the live front page as soon as you save.'}
          </span>
          <div className="flex-1" />
          <Button size="sm" onClick={save} disabled={busy || !config}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}