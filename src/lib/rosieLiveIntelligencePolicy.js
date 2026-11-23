/**
 * Rosie Live Intelligence v1 — shared, deterministic conversation layer.
 * Authoritative policy is versioned in Rosie Core and copied unchanged into
 * product adapters. Never calls a provider, reads a wallet, or stores a transcript.
 * Audio source and speaker mappings are supplied explicitly by each product.
 */
export const ROSIE_LIVE_INTELLIGENCE_VERSION='rosie.live_intelligence.v1';
export const ROSIE_LIVE_SETTLE_MS=1400;
export const ROSIE_LIVE_MAX_TURN_GAP_MS=6500;
export const ROSIE_LIVE_QA_COOLDOWN_MS=6000;
export const ROSIE_LIVE_COACH_COOLDOWN_MS=20000;
export const ROSIE_LIVE_INTENT_COOLDOWN_MS=25000;

const normalize=(text)=>String(text||'').replace(/\s+/g,' ').trim();
const normalizeWord=(text)=>String(text||'').toLowerCase().replace(/[^a-z0-9']/g,'');
const terminal=/[.?!…]["')\]]?$/;
const CONTINUATION=new Set(['and','but','so','because','or','if','then','that','which',
 'when','while','with','to','for','of','in','on','at','as','than','although','unless',
 'until','since','my','your','their','our','the','a','an','is','are','was','were',
 'do','does','did','can','could','would','should','will','just','really','also',
 'even','not','about','from','have','has']);
const OBJECTION=/\b(too expensive|expensive|too much|can't afford|cannot afford|not interested|think about it|need to talk|scam|don't trust|do not trust|fees?|interest|higher rate|guarantee|confused|worried|credit score|bankrupt|hardship|not sure|concerned|not comfortable|doesn't make sense|does not make sense)\b/i;
const DIRECT=/^(?:please\s+)?(?:what|what's|why|how|when|where|who|which|can you|could you|would you|do you|does it|is it|are you|tell me|explain|help me)\b/i;
const IMPLIED=/\b(?:i'?m (?:just )?(?:trying to figure out|wondering|confused|worried about|not sure|unsure|concerned about)|i (?:need to know|want to understand|don't understand|do not understand|would like to know|was wondering)|trying to (?:figure out|understand)|doesn'?t make sense|not clear on|i have a question|i need (?:some )?clarification)\b/i;

export function rosieTextKey(text){
 return normalize(text).toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').slice(0,240);
}
export function rosieSpeaker(role,{profile='generic'}={}){
 if(profile==='bob_training'){
  if(['bob','prospect','customer','simulated','assistant'].includes(String(role).toLowerCase()))return 'prospect';
  if(['user','trainee','agent','rep','human'].includes(String(role).toLowerCase()))return 'trainee';
  return 'unknown';
 }
 if(profile==='debt_telephone'){
  if(role===1||role===2||role==='1'||role==='2')return 'prospect';
  if(role===0||role==='0')return 'trainee';
 }
 const value=String(role||'').toLowerCase();
 if(['customer','prospect','caller','buyer','client'].includes(value))return 'prospect';
 if(['agent','trainee','rep','human','user'].includes(value))return 'trainee';
 return 'unknown';
}
export function rosieTime(value){
 if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return value;
 const ms=Date.parse(String(value||''));
 return Number.isFinite(ms)?ms:0;
}
export function rosieMergeFragments(first,second){
 const a=normalize(first),b=normalize(second);
 if(!a)return b;if(!b)return a;
 const ak=rosieTextKey(a),bk=rosieTextKey(b);
 if(ak===bk||ak.endsWith(' '+bk))return a;
 if(bk.startsWith(ak+' '))return b;
 const aw=a.split(/\s+/),bw=b.split(/\s+/);
 for(let n=Math.min(8,aw.length,bw.length);n>=1;n--){
  let match=true;
  for(let i=0;i<n;i++){
   if(normalizeWord(aw[aw.length-n+i])!==normalizeWord(bw[i])){match=false;break;}
  }
  if(match)return normalize([...aw,...bw.slice(n)].join(' '));
 }
 return normalize(a+' '+b);
}
export function rosieFragmentsBelongTogether(a,b,gapMs){
 const first=normalize(a),second=normalize(b);
 if(!first||!second)return false;
 if(Number.isFinite(gapMs)&&gapMs>ROSIE_LIVE_MAX_TURN_GAP_MS)return false;
 if(!terminal.test(first))return true;
 if(Number.isFinite(gapMs)&&gapMs>=0&&gapMs<1100)return true;
 if(/[,;:—–-]$/.test(first)||/^[a-z]/.test(second))return true;
 if(CONTINUATION.has(normalizeWord(second.split(/\s+/)[0]))&&
    (!Number.isFinite(gapMs)||gapMs<3000))return true;
 return false;
}
/** Full final speech segments only; interim previews must not trigger AI. */
export function assembleRosieTurns(segments=[],{profile='generic',fromIndex=0,maxGapMs=ROSIE_LIVE_MAX_TURN_GAP_MS}={}){
 const turns=[];
 if(!Array.isArray(segments))return turns;
 for(let i=Math.max(0,fromIndex);i<segments.length;i++){
  const m=segments[i]||{};
  if(m.interim===true||m.final===false)continue;
  const role=rosieSpeaker(m.speaker??m.role,{profile});
  const text=normalize(m.text??m.content);
  if(!text||role==='unknown')continue;
  const at=rosieTime(m.time??m.at??m.created_date??m.timestamp);
  const last=turns[turns.length-1];
  const gap=last?.at&&at?Math.max(0,at-last.at):null;
  if(last&&last.role===role&&(!Number.isFinite(gap)||gap<=maxGapMs)&&
     rosieFragmentsBelongTogether(last.text,text,gap)){
   last.text=rosieMergeFragments(last.text,text);
   last.lastIndex=i;last.at=at||last.at;
  }else turns.push({role,text,firstIndex:i,lastIndex:i,at});
 }
 return turns;
}
export function latestRosieSettledProspect(segments,{profile='generic',now=Date.now(),
 settleMs=ROSIE_LIVE_SETTLE_MS,minChars=8}={}){
 const turns=assembleRosieTurns(segments,{profile});
 const last=turns[turns.length-1];
 if(!last||last.role!=='prospect'||last.text.length<minChars)return null;
 if(!last.at||now-last.at<settleMs)return null;
 return last;
}
export function classifyRosieTurn(text){
 const t=normalize(text);
 const implicit=t.length>=8&&IMPLIED.test(t);
 const direct=t.length>=3&&(DIRECT.test(t)||(!implicit&&/\?$/.test(t)));
 const objection=OBJECTION.test(t);
 const confusion=/\b(confused|not sure|unsure|don't understand|do not understand|doesn't make sense|not clear|trying to figure out)\b/i.test(t);
 return Object.freeze({
  questionType:direct?'explicit':implicit?'implicit':'none',
  needsQuestionReview:!!(direct||implicit),
  objection,confusion,
  coachingCandidate:objection||confusion,
  key:rosieTextKey(t)
 });
}
export function rosieSettleDelay(text,{minimum=850,maximum=2450}={}){
 const t=normalize(text);
 const incomplete=/\b(?:and|or|but|because|if|that|with|to|for|of|about|is|are|does|do|can|could|would|should|will|what|how|why|when)\s*$/i.test(t);
 const duration=incomplete?2450:classifyRosieTurn(t).questionType==='explicit'?850:1700;
 return Math.max(minimum,Math.min(maximum,duration));
}
/** Plans suggestions, not model execution or entitlements. */
export function planRosieLiveServices({turn,enabled={},now=Date.now(),state={}}={}){
 const signal=classifyRosieTurn(turn?.text);
 if(!turn||turn.role!=='prospect')return Object.freeze({qa:false,coach:false,intent:false,signal});
 const sameQa=signal.key===state.lastQaKey;
 const sameCoach=signal.key===state.lastCoachKey;
 const sameIntent=signal.key===state.lastIntentKey;
 const qa=enabled.qa===true&&signal.needsQuestionReview&&!sameQa&&
  now-Number(state.lastQaAt||0)>=ROSIE_LIVE_QA_COOLDOWN_MS;
 const coach=enabled.coach===true&&signal.coachingCandidate&&!sameCoach&&
  now-Number(state.lastCoachAt||0)>=ROSIE_LIVE_COACH_COOLDOWN_MS;
 const intent=enabled.intent===true&&!sameIntent&&
  now-Number(state.lastIntentAt||0)>=ROSIE_LIVE_INTENT_COOLDOWN_MS;
 return Object.freeze({qa,coach,intent,signal});
}