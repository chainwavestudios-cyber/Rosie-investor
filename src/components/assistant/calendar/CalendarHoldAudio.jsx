import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function CalendarHoldAudio() {
  const audio = useQuery({ queryKey: ['calendar-hold-audio'], queryFn: async () => {
    const page = await base44.entities.FronterHoldAudio.filter({ isActive: true }, { sort: '-uploadedAt', limit: 1 });
    const record = page.items[0];
    const signed = record?.fileUri ? await base44.integrations.Core.CreateFileSignedUrl({ file_uri: record.fileUri, expires_in: 300 }) : null;
    return { name: record?.fileName, url: signed?.signed_url };
  }, staleTime: 240000 });
  return <section className="calendar-panel mt-4">
    <h3 className="calendar-title">Client welcome / hold audio</h3>
    <p className="text-sm leading-relaxed text-assistant-muted">The transfer popup uses the configured welcome / hold audio while the client waits to be merged with Chris.</p>
    {audio.isPending ? <p className="mt-3 text-sm text-assistant-muted">Loading hold audio…</p> : audio.isError ? <p role="alert" className="calendar-error mt-3">Hold audio preview unavailable.</p> : <><p className="mt-3 text-sm text-assistant-ink">{audio.data.name || 'Twilio default hold music'}</p>{audio.data.url && <audio controls src={audio.data.url} className="mt-3 w-full" />}</>}
  </section>;
}