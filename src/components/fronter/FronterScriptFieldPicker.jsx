import { INLINE_CARD_FIELDS } from '@/components/fronter/FronterInlineField';

export default function FronterScriptFieldPicker({ onInsert }) {
  return (
    <select aria-label="Insert editable contact field" defaultValue="" onChange={event => { onInsert(event.target.value); event.target.value = ''; }} className="rounded border border-border bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground" title="Add a contact-card field with an Update button inside the script">
      <option value="" disabled>Contact Field…</option>
      {INLINE_CARD_FIELDS.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
    </select>
  );
}