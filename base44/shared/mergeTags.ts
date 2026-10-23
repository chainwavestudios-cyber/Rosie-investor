/**
 * mergeTags.ts — one fill for the {{tag}} placeholders in saved templates.
 *
 * Templates are written by hand across two systems, so the same value is typed
 * as {{FirstName}} in the mailers and {{firstName}} in the reminder emails.
 * Every fill is case-insensitive and tolerates spaces inside the braces, so
 * both spellings land the same value. A tag with no matching value is left
 * standing on purpose: a visible {{tag}} beats a silently blank line.
 */
export function fillMergeTags(source: string, vars: Record<string, string>): string {
  const lookup = new Map(
    Object.entries(vars || {}).map(([key, value]) => [String(key).toLowerCase(), String(value ?? '')])
  );
  return String(source || '').replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (token, key) => {
    const value = lookup.get(String(key).toLowerCase());
    return value === undefined ? token : value;
  });
}