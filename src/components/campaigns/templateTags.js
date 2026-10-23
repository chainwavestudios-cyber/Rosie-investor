/**
 * templateTags.js — every {{tag}} an email body uses, in the order they appear.
 * Shared by the template library and the preview so both describe the same tags.
 */
export function templateTags(source) {
  const found = new Set();
  for (const match of String(source || '').matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) found.add(match[1]);
  return [...found];
}