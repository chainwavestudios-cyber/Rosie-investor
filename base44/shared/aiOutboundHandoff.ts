/**
 * Outbound Alex handoff gate. Pure conversation-history policy, shared by
 * Media Stream response handling. Does not execute Twilio calls.
 *
 * A model saying "transfer" or mentioning Chris is NOT evidence that the
 * value question was asked and answered. An actual customer response is.
 */
const textOf = (m) => String(m?.content || '').trim();
const normalized = (s) => String(s || '').trim().toLowerCase();
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
  "Understood. Depending on your situation, there may be legitimate ways to make your unsecured debt payments more manageable, with fees, interest terms, and risks explained before you decide. Would reviewing those options with Chris be helpful to your family?";
export const OUTBOUND_QUEUE_NOTICE =
  "Thank you. I'm going to place you in Chris's queue now. There may be a few seconds of silence while I connect you.";
export const OUTBOUND_DEBT_QUESTION =
  "Got it. Are those mostly unsecured credit cards, personal loans, or a mix of both?";
export const OUTBOUND_POST_PERMISSION =
  "Great, this is Alex with the Debt Verification Desk at Debt Solutions. I'm an automated assistant reaching out about options for high-interest unsecured debt. Are those mostly credit cards, personal loans, or both?";

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

export function enforceOutboundHandoff({conversation=[], action='speak', text='', lead=null} = {}) {
  const state = outboundHandoffState(conversation);
  const said = String(text || '').trim();
  if (state.optOut) return { action:'end_call', text:'Understood. I will record your request not to be contacted again. Goodbye.', disposition:'opt_out', state };
  if (state.explicitHumanRequest) {
    return {action:'transfer',text:OUTBOUND_QUEUE_NOTICE,disposition:'',state};
  }
  // Answering the opening permission question is NOT an opportunity to
  // pause awkwardly after identifying Alex, nor to claim unverified state
  // or credit-bureau information. Deliver identity + the debt question now.
  const clean = Array.isArray(conversation) ? conversation.filter(m=>textOf(m)) : [];
  const lastUserIndex = clean.map(isUser).lastIndexOf(true);
  const precedingAgent = lastUserIndex>0 && isAgent(clean[lastUserIndex-1])
    ? textOf(clean[lastUserIndex-1]) : '';
  const justAnsweredPermission = /(?:bad time|away from anything|interrupt|is this a good time|have (?:a |one )?moment)/i.test(precedingAgent);
  const busy = /\b(?:busy|bad time|can't talk|cannot talk|not now|later|another time|working|on the road)\b/i.test(state.lastCustomer);
  if(justAnsweredPermission && !busy && !state.debtTypeConfirmed){
    return {action:'speak',text:OUTBOUND_POST_PERMISSION,disposition:'',state};
  }
  if(justAnsweredPermission && busy){
    return {action:'speak',text:'Of course. Is there a better time for a brief call?',disposition:'',state};
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
    return {action:'speak',text:OUTBOUND_WARM_QUESTION,disposition:'',state};
  }
  if (action==='transfer' || queueAnnouncement(said)) {
    return {action:'speak',text:OUTBOUND_DEBT_QUESTION,disposition:'',state};
  }
  // Never stop after the standalone identification phrase. Ask the next
  // qualifying question in the same reply, unless another question is present.
  if (/^(?:this is|my name is|great[,!.]?\s*this is)\s+alex\b/i.test(said) && !said.includes('?')) {
    return {action:'speak',text:said.replace(/[.! ]+$/,'')+'. '+OUTBOUND_DEBT_QUESTION,disposition:'',state};
  }
  return {action, text:said, disposition:'',state};
}
