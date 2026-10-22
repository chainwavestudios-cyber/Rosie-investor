/**
 * scriptSubstitute.js — Replaces placeholder variables in script content with
 * values from the active lead and fronter.
 *
 * Supports two formats:
 *   {{first_name}}  — curly-brace variables (used by AI agent system prompt)
 *   <First Name>     — angle-bracket variables (legacy script format)
 *
 * Case-insensitive for angle-bracket format.
 */
export function substituteScriptVars(content, { lead, fronterFirstName } = {}) {
  if (!content) return '';
  // The debt card carries its identifier on the lead number
  const noticeId = lead?.noticeId || lead?.leadNumber || '';
  const vars = {
    first_name: lead?.firstName || '',
    firstname: lead?.firstName || '',
    'first name': lead?.firstName || '',
    last_name: lead?.lastName || '',
    lastname: lead?.lastName || '',
    'last name': lead?.lastName || '',
    totaldebt: lead?.debtAmount ? '$' + Number(lead.debtAmount).toLocaleString() : '',
    total_debt: lead?.debtAmount ? '$' + Number(lead.debtAmount).toLocaleString() : '',
    email: lead?.email || '',
    phone_number: lead?.phone || '',
    phone: lead?.phone || '',
    zip: lead?.zipCode || lead?.zip || '',
    'zip code': lead?.zipCode || lead?.zip || '',
    city: lead?.city || '',
    state: lead?.state || '',
    street: lead?.address || '',
    address: [lead?.address, lead?.city, lead?.state, lead?.zipCode || lead?.zip].filter(Boolean).join(', '),
    debt_amount: lead?.debtAmount ? '$' + Number(lead.debtAmount).toLocaleString() : '',
    notice_id: noticeId,
    'notice id': noticeId,
    noticeid: noticeId,
    notice: noticeId,
    'notice number': noticeId,
    'debt amount': lead?.debtAmount ? '$' + Number(lead.debtAmount).toLocaleString() : '',
    hardship_statement: lead?.hardshipQualification || '',
    contingency_time: lead?.preferredCallTime || '',
    frontername: fronterFirstName || '',
    'fronter name': fronterFirstName || '',
  };
  let result = content;
  // {{variable}} format — function replacement avoids $ being interpreted as backreferences
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), () => val);
  }
  // <First Name> format (legacy)
  result = result
    .replace(/<First Name>/gi, lead?.firstName || '')
    .replace(/<Last Name>/gi, lead?.lastName || '')
    .replace(/<Fronter Name>/gi, fronterFirstName || '');
  return result;
}