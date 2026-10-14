import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

export default function CallCutoffOverride({ enabled, onChange, disabled, buttonStyle }) {
  const { isSuperAdmin } = useDebtCoachAuth();
  if (!isSuperAdmin) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <button type="button" aria-pressed={enabled} disabled={disabled} onClick={() => onChange(!enabled)} style={buttonStyle}>
        {enabled ? 'Override ON' : 'Override 8pm Cutoff'}
      </button>
      {enabled && <span className="text-xs">Test calls to your own number only. Overrides the 8am–8pm calling window.</span>}
    </div>
  );
}