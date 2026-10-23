/**
 * The switch used across the ProtoFace tab — flips a setting the moment it is clicked.
 */
export default function ProtoFaceToggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          checked ? 'border-emerald-400/60 bg-emerald-500/30' : 'border-white/15 bg-white/5'
        }`}
      >
        <span className={`h-3.5 w-3.5 rounded-full transition-transform ${checked ? 'translate-x-4 bg-emerald-300' : 'translate-x-1 bg-[#8a9ab8]'}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-slate-100">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-[#6b7a99]">{hint}</span>}
      </span>
    </button>
  );
}