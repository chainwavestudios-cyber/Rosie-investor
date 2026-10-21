export const REMINDER_SCRIPT = (lead) => `${lead?.firstName || '{{firstname}}'},

This is Chris Bongiorno's assistant from Debt Advisors of America. I just wanted to remind you of your upcoming appointment with Chris Bongiorno in 1 hour. Did you get a chance to review the email he sent, and watch his welcome message?

If they did: Great! I'll be calling back in one hour to connect you with Chris.

If no: Would you like me to send that email again to you at this email address ${lead?.email || '{{Email}}'}?`;

export const TRANSFER_SCRIPT = `Hello, this is Michie. I am calling in regards to your appointment in the next few minutes from the offices of Chris Bongiorno and Debt Advisors of America.

I will go ahead and add you to his call queue, and he will answer shortly…`;

export const appointmentLabel = (value) => value ? new Date(value).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'Not scheduled';

/** Built-in rebook wording — replaced by the super admin's script once they save one. */
export const REBOOK_SCRIPT = (lead) => `Hi ${lead?.firstName || '{{firstname}}'}, this is Michie — Chris Bongiorno's assistant.

I'm calling about your appointment set for ${appointmentLabel(lead?.appointmentDate)}. If that time no longer works for you, I can move it right now — what day and time works best?`;

/** Fill {{firstname}}, {{Email}} and {{appointment}} in any assistant script. */
export const fillScriptTokens = (text, lead) => String(text || '')
  .replace(/\{\{firstname\}\}/gi, lead?.firstName || '')
  .replace(/\{\{Email\}\}/gi, lead?.email || '')
  .replace(/\{\{appointment\}\}/gi, appointmentLabel(lead?.appointmentDate));