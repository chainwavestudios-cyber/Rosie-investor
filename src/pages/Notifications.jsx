/**
 * Notifications.jsx — everything the app used to beep about, in one silent list.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { logNotification } from '@/lib/notifyCenter';
import { Bell, CheckCheck, Trash2, ArrowLeft } from 'lucide-react';

const KIND = {
  hot_lead: { label: 'Hot lead', color: 'text-rose-400' },
  transfer: { label: 'Transfer', color: 'text-emerald-400' },
  meeting: { label: 'Meeting', color: 'text-amber-400' },
  missed_appointment: { label: 'Missed appointment', color: 'text-orange-400' },
  sms: { label: 'Text', color: 'text-sky-400' },
  voicemail: { label: 'Voicemail', color: 'text-violet-400' },
  call: { label: 'Call', color: 'text-blue-400' },
  system: { label: 'System', color: 'text-slate-400' },
};

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const page = await base44.entities.AppNotification.list({ sort: '-created_date', limit: 200 });
      setItems(page.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'unread' ? items.filter((n) => !n.read) : items;
  const unread = items.filter((n) => !n.read).length;

  const open = async (n) => {
    if (!n.read) {
      await base44.entities.AppNotification.update(n.id, { read: true }).catch(() => {});
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    }
    if (n.linkPath) navigate(n.linkPath);
  };

  const markAllRead = async () => {
    await base44.entities.AppNotification.updateMany({ read: false }, { $set: { read: true } }).catch(() => {});
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const clearAll = async () => {
    if (!window.confirm('Clear every notification? This cannot be undone.')) return;
    await base44.entities.AppNotification.deleteMany({}).catch(() => {});
    setItems([]);
  };

  const sendTest = () => {
    logNotification({
      title: 'Test notification',
      body: 'Notifications are working and completely silent — no beeps, everything lands here.',
      type: 'system',
      source: 'Notifications tab',
    });
    setTimeout(load, 900);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
            <Bell className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Notifications</h1>
            <p className="text-xs text-slate-400">
              Every alert, silently. Nothing plays a sound anymore.
            </p>
          </div>
          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {unread} unread
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {['all', 'unread'].map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filter === k ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {k}
            </button>
          ))}
          <span className="flex-1" />
          <button onClick={sendTest} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">
            Send a test
          </button>
          <button onClick={markAllRead} disabled={!unread} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
          <button onClick={clearAll} disabled={!items.length} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading && <p className="py-10 text-center text-sm text-slate-500">Loading notifications…</p>}

          {!loading && !visible.length && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 py-14 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-slate-600" />
              <p className="text-sm text-slate-400">Nothing here yet.</p>
              <p className="mt-1 text-xs text-slate-500">New hot leads, transfers, texts and missed appointments will land here.</p>
            </div>
          )}

          {visible.map((n) => {
            const kind = KIND[n.type] || KIND.system;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`block w-full rounded-xl border px-3.5 py-3 text-left transition ${
                  n.read ? 'border-slate-800 bg-slate-900/40' : 'border-emerald-500/30 bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${kind.color}`}>{kind.label}</span>
                      <span className="text-[10px] text-slate-500">{when(n.created_date)}</span>
                      {n.source && <span className="text-[10px] text-slate-600">· {n.source}</span>}
                    </div>
                    <div className={`mt-0.5 text-sm ${n.read ? 'text-slate-300' : 'font-semibold text-white'}`}>{n.title}</div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</div>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}