/**
 * ProtoFace tab (Debt Call Coach) — the video qualification widget's own settings home:
 * the assistants a visitor picks between (faces, voices, opening lines), the script and
 * lip-sync tuning they run on, and the AI knowledge base they answer from.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ProtoFaceAssistantsPanel from './ProtoFaceAssistantsPanel';
import ProtoFaceScriptPanel from './ProtoFaceScriptPanel';
import ProtoFaceKbPanel from './ProtoFaceKbPanel';

const SUB_TABS = [
  { id: 'assistants', label: '🎛 Assistants' },
  { id: 'script', label: '📝 Script & Lip Sync' },
  { id: 'kb', label: '📚 AI KB' },
];

export default function ProtoFaceTab() {
  const [sub, setSub] = useState('assistants');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await base44.entities.VideoQualifyConfig.filter({ configName: 'default' }, { limit: 1 });
      setConfig((res?.items || [])[0] || null);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch) => {
      if (!config?.id) return;
      await base44.entities.VideoQualifyConfig.update(config.id, { ...patch, updatedAt: new Date().toISOString() });
      setConfig((current) => ({ ...current, ...patch }));
    },
    [config?.id],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!config) {
    return <div className="p-8 text-sm text-[#8a9ab8]">The video qualification settings could not be loaded.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              sub === t.id
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/5 text-[#8a9ab8] hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-[#6b7a99]">
        This is the video qualification widget behind the invitation links and the qualification page.
      </div>

      {sub === 'assistants' && <ProtoFaceAssistantsPanel config={config} save={save} />}
      {sub === 'script' && <ProtoFaceScriptPanel config={config} save={save} />}
      {sub === 'kb' && <ProtoFaceKbPanel config={config} save={save} />}
    </div>
  );
}