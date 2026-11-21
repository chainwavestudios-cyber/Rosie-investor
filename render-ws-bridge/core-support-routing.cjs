'use strict';
/** Core-only Rosie receptionist routing: small deterministic intent gate.
 * Technical problems go straight to Captain Patch, not through more Rosie questions.
 * Does not read or store raw transcripts outside the active voice session.
 */
const TECH=/(?:\b(?:technical|tech\s*support|captain\s*patch|patch\s*please|help\s*desk|bug|crash(?:es|ed|ing)?|broken|error(?:s)?|exception|fail(?:ed|ing|ure|s)?|not\s+working|doesn['’]?t\s+work|won['’]?t\s+(?:load|open|start|connect|login|log\s*in)|can['’]?t\s+(?:login|log\s*in|sign\s*in|connect|access|open|hear|see|load|use|click|send|receive)|unable\s+to\s+(?:login|log\s*in|access|open|load|connect|send)|stuck|frozen|freezing|glitch|issue|problem|outage|down|support\s*ticket|transfer\s+me|connect\s+me\s+to\s+patch)\b)/i;
const BILLING=/(?:\b(?:charged\s+twice|incorrect\s+charge|billing\s+error|payment\s+failed|renewal\s+failed)\b)/i;
const BUTTON=/(?:\b(?:button|link|tab|click|press)\b.*\b(?:nothing|not\s+working|doesn['’]?t|won['’]?t|broken|fail|error|respond|happen)\b)/i;
const VOICE=/(?:\b(?:microphone|audio|call|voice|sound|hear|speaking)\b.*\b(?:not\s+working|can['’]?t|broken|fails?|no\s+audio|no\s+sound)\b)/i;
const AUTH=/(?:\b(?:account|login|sign\s*in|password|access|jwt|token)\b.*\b(?:failed|invalid|expired|denied|locked|won['’]?t|can['’]?t|not\s+working|error)\b)/i;
function classifyTechnicalIssue(raw){
 const text=String(raw||'').slice(0,600);
 if(!TECH.test(text)&&!BUTTON.test(text)&&!VOICE.test(text)&&!AUTH.test(text)&&!BILLING.test(text))return null;
 if(BUTTON.test(text))return 'button_not_working';
 if(VOICE.test(text))return 'voice_failure';
 if(AUTH.test(text))return 'login_access';
 if(BILLING.test(text))return 'billing_support';
 if(/\b(?:error|exception|crash|bug|not\s+working|doesn['’]?t\s+work|stuck|frozen|fail)\b/i.test(text))return 'app_error';
 return 'general_technical';
}
const PATCH_SYSTEM='You are Captain Patch, the ACTIVE Rosie Core Tier 1 technical support specialist in this same customer call. Rosie has already handed you the technical issue. Give the caller time to finish; do not interrupt. Speak in short natural sentences; start by acknowledging the issue. Use verified Core diagnostic metadata supplied in the system context when available, without assuming it is exhaustive. Ask at most one necessary technical follow-up, never a long questionnaire. No credentials, passwords, private customer details, payment information, production changes, or unsupported claims of resolution. You are the in-call Tier 1 agent, NOT a separate telephone leg or a confirmed engineering worker. An in-call case receipt is not a canonical repair ticket. If a deeper engineering fix is required, say further escalation is necessary rather than falsely claiming a worker is active. Never change or quote the receptionist greeting.';
module.exports={classifyTechnicalIssue,PATCH_SYSTEM};
