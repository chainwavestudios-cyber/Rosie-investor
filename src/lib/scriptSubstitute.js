/**
 * scriptSubstitute.js — Replaces <First Name>, <Last Name>, <Fronter Name>
 * placeholders in script content with values from the active lead and fronter.
 * Case-insensitive — matches <First Name>, <first name>, <FIRST NAME>, etc.
 */
export function substituteScriptVars(content, { lead, fronterFirstName } = {}) {
  if (!content) return '';
  return content
    .replace(/<First Name>/gi, lead?.firstName || '')
    .replace(/<Last Name>/gi, lead?.lastName || '')
    .replace(/<Fronter Name>/gi, fronterFirstName || '');
}