/**
 * Outbound Alex handoff gate. Pure conversation-history policy, shared by
 * Media Stream response handling. Does not execute Twilio calls.
 *
 * A model saying "transfer" or mentioning Chris is NOT evidence that the
 * value question was asked and answered. An actual customer response is.
 */
const textOf = (m) => String(m?.content || '').trim();
const isUser = (m) => String(m?.role || '').toLowerCase() === 'user';
const isAgent = (m) => !isUser(m);
const wantsHuman = (s) => /\b(?:transfer(?: me)?|talk to (?:a |the )?(?:person|human|advisor|chris)|speak to (?:a |the )?(?:person|human|advisor|chris)|connect me|patch me through|put me through|appointment|book (?:a |an )?(?:time|call|appointment))\b/i.test(s);
const optOut = (s) => /\b(?:do not call|don't call|stop calling|remove me|take me off (?:your |the )?list|not interested|wrong number)\b/i.test(s);
const yes = (s) => /^(?:yes|yeah|yep|yup|sure|absolutely|definitely|it would|very much|certainly|of course|sounds good|that (?:would|could)(?: really)? (?:help|be (?:great|helpful))|i think so|probably|please|okay|ok|right|correct|for sure|i'd appreciate it)\b/i.test(s.trim());
const no = (s) => /^(?:no|nope|not really|not at all|i don't think so|i would not|it wouldn't|don't think)\b/i.test(s.trim());
const debtQuestion = (s) => /\b(?:mostly|primarily|mainly|unsecured).*?\b(?:credit cards?|cards?|personal loans?|loans?)\b|\b(?:credit cards?|cards?)\b.*\b(?:or|versus)\b.*\b(?:personal loans?|loans?)\b/i.test(s);
const answeredType = (s) => /\b(?:credit cards?|cards?|personal loans?|loans?|both|mixture|mixed|combination|mostly|all of it|just cards|yes)\b/i.test(s);
const warmQuestion = (s) => /\b(?:would|could)\b[\s\S]{0,250}\b(?:helpful|help|beneficial|make (?:things|the payments?) (?:easier|manageable))\b[\s\S]{0,100}\?/i.test(s);
const queueAnnouncement = (s) => /\b(?:placing|putting|transfer(?:ring)?|patch(?:ing)?|connect(?:ing)?)\b[\s\S]{0,90}\b(?:queue|chris|advisor|specialist|line|over)\b/i.test(s);
export const OUTBOUND_WARM_QUESTION =
  "Understood. Well, because of the current rate-drop updates in {{state}}, we can get those monthly payments cut down significantly, typically 30-50 percent,  eliminate all future interest, and make every future payment again principle only.  If all that were true, in a program there are no up front fees and is totally legit, would that be helpful to your family?";
export const OUTBOUND_QUEUE_NOTICE =
  "Thank you. I'm going to place you in Chris's queue now. There may be a few seconds of silence while I connect you.";
export const OUTBOUND_DEBT_QUESTION =
  "Got it. And are those mostly major cards like Chase, Citi, Discover, or personal loans?";

// Use the exact user-maintained Step 2 / Step 3 lines from the saved live
// script. The gate enforces order; it must NOT author new sales language.
function configuredLine(prompt, section, fallback) {
  const source = String(prompt || '');
  const start = source.indexOf(section);
  if (start < 0) return fallback;
  const after = source.slice(start + section.length);
  const match = after.match(/^- Say:\s*"([^"]+)"/m);
  return match?.[1] || fallback;
}
function fillState(text, lead) {
  return text.replace(/\{\{state\}\}/g, String(lead?.state || ''));
}

export function outboundHandoffState(conversation = []) {
  const messages = Array.isArray(conversation) ? conversation.filter(m => textOf(m)) : [];
  let debtAnswerIndex = -1, warmQuestionIndex = -1, warmAnswerIndex = -1, warmAccepted = false, warmDeclined = false;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (isAgent(m) && debtQuestion(textOf(m))) {
      if (i + 1 < messages.length && isUser(messages[i + 1]) && answeredType(textOf(messages[i + 1]))) debtAnswerIndex = i + 1;
    }
    if (isAgent(m) && warmQuestion(textOf(m))) {
      warmQuestionIndex = i;
    }
  }
  if (warmQuestionIndex !== -1) {
    for (let j = warmQuestionIndex + 1; j < messages.length; j++) {
      if (!isUser(messages[j])) continue;
      const content = textOf(messages[j]);
      warmAnswerIndex = j;
      warmAccepted = yes(content) && !optOut(content);
      warmDeclined = no(content) || optOut(content);
      break;
    }
  }
  const lastCustomer = [...messages].reverse().find(isUser);
  return {
    debtTypeConfirmed: debtAnswerIndex !== -1,
    warmQuestionAsked: warmQuestionIndex !== -1,
    warmQuestionAnswered: warmAnswerIndex !== -1,
    warmAccepted,
    warmDeclined,
    explicitHumanRequest: !!lastCustomer && wantsHuman(textOf(lastCustomer)),
    optOut: !!lastCustomer && optOut(textOf(lastCustomer)),
    lastCustomer: lastCustomer ? textOf(lastCustomer) : '',
  };
}

export function enforceOutboundHandoff({conversation=[], action='speak', text='', lead=null, configuredPrompt='' } = {}) {
  const state = outboundHandoffState(conversation);
  const said = String(text || '').trim();
  if (state.optOut) return { action:'end_call', text:'Understood. I will record your request not to be contacted again. Goodbye.', disposition:'opt_out', state };
  if (state.explicitHumanRequest) {
    return {action:'transfer',text:OUTBOUND_QUEUE_NOTICE,disposition:'',state};
  }
  if (state.warmQuestionAsked && state.warmQuestionAnswered) {
    if (state.warmDeclined) {
      return {action:'speak',text:'Understood. I appreciate your time, and I will not connect you without your permission.',disposition:'',state};
    }
    if (state.warmAccepted && state.debtTypeConfirmed) {
      return {action:'transfer',text:OUTBOUND_QUEUE_NOTICE,disposition:'',state};
    }
  }
  if (state.debtTypeConfirmed && !state.warmQuestionAsked) {
    return {action:'speak',text:fillState(configuredLine(configuredPrompt, 'STEP 3 — THE WARM HANDOFF', OUTBOUND_WARM_QUESTION),lead),disposition:'',state};
  }
  if (action==='transfer' || queueAnnouncement(said)) {
    return {action:'speak',text:fillState(configuredLine(configuredPrompt, 'STEP 2 — DEBT CONFIRMATION', OUTBOUND_DEBT_QUESTION),lead),disposition:'',state};
  }
  return {action, text:said, disposition:'',state};
}
