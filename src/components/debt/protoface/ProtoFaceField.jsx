/**
 * One labelled input for the ProtoFace tab. A `rows` value turns it into a textarea.
 */
export default function ProtoFaceField({ label, value, onChange, hint, rows, placeholder, type = 'text' }) {
  const base = 'w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60';
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#8a9ab8]">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={base} />
      ) : (
        <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
      {hint && <span className="block text-[11px] leading-snug text-[#6b7a99]">{hint}</span>}
    </label>
  );
}