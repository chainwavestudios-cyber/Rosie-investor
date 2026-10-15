export default function AIAgentPipelineField({ label, field, value, options = [], update }) {
  const known = options.some(option => option.value === value);
  return <label className="block min-w-0 text-xs text-muted-foreground">
    {label}
    <select aria-label={label} value={value || ''} disabled={!options.length} onChange={event => update(field, event.target.value)} className="mt-1 w-full rounded border border-input bg-background p-2 text-sm text-foreground">
      {!known && <option value={value || ''}>{value ? `${value} (saved legacy/custom value)` : 'Select an option'}</option>}
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}