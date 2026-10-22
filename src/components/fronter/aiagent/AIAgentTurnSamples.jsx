import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Per-turn response times for one call, drawn against the low-latency target.
 * Each bar is one caller turn: end-of-turn → the agent's first audio out.
 */
export default function AIAgentTurnSamples({ samples = [], targetMs }) {
  if (!samples.length) {
    return <p className="mt-2 text-xs text-muted-foreground">No caller turn measured on this call yet.</p>;
  }
  const rows = samples.map((sample, index) => ({ name: `#${index + 1}`, ms: sample.ms }));
  const latest = samples.slice().reverse().slice(0, 8);
  return (
    <div className="mt-3">
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 10, bottom: 0, left: -22 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={value => `${value} ms`} labelFormatter={label => `Turn ${label}`} />
            <ReferenceLine y={targetMs} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `target ${targetMs}ms`, fontSize: 10, fill: '#f59e0b', position: 'insideTopRight' }} />
            <Bar dataKey="ms" fill="#10b981" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
        {latest.map((sample, index) => (
          <li key={`${sample.at}-${index}`} className={sample.ms <= targetMs ? 'text-emerald-400' : 'text-red-400'}>
            {sample.ms}ms · {sample.stt || '—'}/{sample.tts || '—'} · {new Date(sample.at).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}