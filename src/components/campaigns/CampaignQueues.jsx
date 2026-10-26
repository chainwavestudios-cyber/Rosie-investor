/**
 * CampaignQueues.jsx — the queues a campaign sends from.
 *
 * Each queue carries its own number of emails per send and its own random wait
 * range, and the queue itself is chosen at random for every send — so a campaign
 * that sends "1 at a time, every 1–5 minutes" from two queues never falls into one
 * regular rhythm. One queue is enough; a second is what makes it random.
 */
import { Btn, BORDER, DIM, Field, MUTED, inputStyle } from './kit';
import { NEW_QUEUE, queueSummary } from '@/lib/campaignQueues';

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
  gap: '10px',
  alignItems: 'end',
};

const number = (value, min) => Math.max(min, Number(value) || min);

export default function CampaignQueues({ queues, onChange }) {
  const patch = (index, changes) => onChange(queues.map((queue, i) => (i === index ? { ...queue, ...changes } : queue)));

  const remove = (index) => onChange(queues.filter((_, i) => i !== index));

  const add = () => onChange([...queues, { ...NEW_QUEUE, label: queues.length ? `Queue ${queues.length + 1}` : 'Main queue' }]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {queues.map((queue, index) => (
        <div key={index} style={{ background: 'rgba(0,0,0,0.18)', border: `1px solid ${BORDER}`, borderRadius: '5px', padding: '11px 12px', opacity: queue.enabled ? 1 : 0.55 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '9px' }}>
            <label style={{ display: 'flex', gap: '7px', alignItems: 'center', cursor: 'pointer', flex: 1, minWidth: 0 }}>
              <input type="checkbox" checked={queue.enabled} onChange={(e) => patch(index, { enabled: e.target.checked })} />
              <input
                style={{ ...inputStyle, width: 'auto', minWidth: '140px', flex: '1 1 140px' }}
                value={queue.label}
                placeholder={`Queue ${index + 1}`}
                onChange={(e) => patch(index, { label: e.target.value })}
              />
            </label>
            <span style={{ color: MUTED, fontSize: '10px' }}>{queueSummary(queue)}</span>
            {queues.length > 1 && <Btn tone="ghost" onClick={() => remove(index)} title="Remove this queue">✕</Btn>}
          </div>

          <div style={rowStyle}>
            <Field label="Emails per send" hint="1 sends them one at a time">
              <input
                type="number" min="1" max="100" style={inputStyle} value={queue.perBurst}
                onChange={(e) => patch(index, { perBurst: number(e.target.value, 1) })}
              />
            </Field>
            <Field label="Shortest wait (seconds)">
              <input
                type="number" min="5" style={inputStyle} value={queue.gapMinSeconds}
                onChange={(e) => {
                  const min = number(e.target.value, 5);
                  patch(index, { gapMinSeconds: min, gapMaxSeconds: Math.max(min, queue.gapMaxSeconds) });
                }}
              />
            </Field>
            <Field label="Longest wait (seconds)" hint={queue.gapMaxSeconds === queue.gapMinSeconds ? 'Same as the shortest — a fixed wait' : 'A random wait is drawn in this range'}>
              <input
                type="number" min={queue.gapMinSeconds} style={inputStyle} value={queue.gapMaxSeconds}
                onChange={(e) => patch(index, { gapMaxSeconds: Math.max(queue.gapMinSeconds, number(e.target.value, queue.gapMinSeconds)) })}
              />
            </Field>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn tone="ghost" onClick={add}>＋ Add another queue</Btn>
        <span style={{ color: DIM, fontSize: '10px' }}>
          {queues.filter((queue) => queue.enabled).length > 1
            ? 'One of these queues is picked at random for every send, so the pace keeps changing.'
            : 'Seconds, not minutes: 60 = 1 minute, 300 = 5 minutes.'}
        </span>
      </div>
    </div>
  );
}