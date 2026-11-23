/**
 * Deterministic, fake STT-event acceptance replay for the ORIGINAL Investor
 * Debt Call Coach. This is policy-level simulation, NOT a live phone/audio test.
 * No tenant data, browser, network, provider key, credit or customer is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  investorSettleDelay,
  latestInvestorProspectTurn,
  investorShouldAskSettled,
  investorShouldCoachSettled,
} from '../src/lib/investorConversationAdapter.js';
import { rosieTextKey } from '../src/lib/rosieLiveIntelligencePolicy.js';
import { trailingTurn } from '../src/lib/transcriptTurn.js';

const origin = Date.parse('2026-11-15T15:00:00.000Z');
const stt = (at, speaker, text, extras={}) => ({ at, speaker, text, ...extras });
const normalizedEvent = event => ({
  speaker:event.speaker, text:event.text,
  time:new Date(origin + event.at).toISOString(),
  interim:event.interim, final:event.final,
});

/** Recreates the staged debounce/guard decisions using the exact pure
 * conversation adapters; deliberately DOES NOT invoke the React call UI.
 */
function replay(events,{initialQa=true,initialCoach=true}={}) {
  let qaEnabled=initialQa, coachEnabled=initialCoach;
  let lastQaAt=0,lastQaText='';
  let lastCoachAt=0,lastCoachKey='';
  let customerPending=null,coachPending=null;
  const transcript=[],requests=[],tips=[];
  const settleQa=(at)=>{
    if(!customerPending)return;
    const turn=customerPending.turn;customerPending=null;
    if(investorShouldAskSettled({
      turn,enabled:qaEnabled,now:at,lastAskedAt:lastQaAt,lastAskedText:lastQaText,
    })){ requests.push({at,text:turn.text});lastQaAt=at;lastQaText=turn.text }
  };
  const settleCoach=(at)=>{
    if(!coachPending)return;
    const turn=coachPending.turn;coachPending=null;
    if(investorShouldCoachSettled({
      turn,enabled:coachEnabled,now:at,lastCoachAt,lastCoachKey,
    })){tips.push({at,text:turn.text});lastCoachAt=at;lastCoachKey=rosieTextKey(turn.text)}
  };
  const advance=(target)=>{
    while(true){
      const nextQa=customerPending?.due??Infinity;
      const nextCoach=coachPending?.due??Infinity;
      const due=Math.min(nextQa,nextCoach);
      if(due>target)break;
      if(nextQa===due)settleQa(due);
      if(nextCoach===due)settleCoach(due);
    }
  };
  for(const event of events){
    advance(event.at);
    if(event.action==='qaOff'){qaEnabled=false;continue}
    if(event.action==='qaOn'){qaEnabled=true;continue}
    if(event.action==='coachOff'){coachEnabled=false;continue}
    if(event.action==='coachOn'){coachEnabled=true;continue}
    if(event.action==='end'){customerPending=null;coachPending=null;break}
    transcript.push(normalizedEvent(event));
    if(event.interim===true){
      if(event.speaker===1){
        const nextDelay=Math.max(1300,investorSettleDelay(event.text));
        if(customerPending)customerPending.due=event.at+nextDelay;
        if(coachPending)coachPending.due=event.at+nextDelay;
      }
      continue;
    }
    if(event.final===false)continue;
    if(event.speaker===1){
      const turn=latestInvestorProspectTurn(transcript);
      if(turn){
        const due=event.at+investorSettleDelay(turn.text);
        customerPending={turn,due};
        coachPending={turn,due};
      }
    }else if(event.speaker===0){
      settleQa(event.at);settleCoach(event.at);
    }else if(event.speaker===2){
      customerPending=null;coachPending=null;
    }
  }
  const last=events.at(-1)?.at??0;
  if(!events.some(e=>e.action==='end'))advance(last+10000);
  return {requests,tips,transcript};
}

test('legacy transcript includes transfer-introduction; shared adapter isolates the caller',()=>{
  const lines=[
    normalizedEvent(stt(100,2,'I will transfer you to the closer.')),
    normalizedEvent(stt(500,1,'What are the fees?')),
  ];
  assert.match(trailingTurn(lines,'customer'),/transfer you/);
  assert.equal(latestInvestorProspectTurn(lines)?.text,'What are the fees?');
});

test('synthetic replay avoids paid automatic Q&A on routine customer statements',()=>{
  const r=replay([stt(1000,1,'That sounds fine, thank you.')]);
  assert.equal(r.requests.length,0);
});

test('synthetic replay holds fragments until full customer question is assembled',()=>{
  const r=replay([
    stt(1000,1,'What is'),
    stt(1400,1,'the minimum investment?'),
  ]);
  assert.deepEqual(r.requests.map(x=>x.text),['What is the minimum investment?']);
});

test('synthetic replay does not issue duplicate Q&A for repeated Deepgram final',()=>{
  const r=replay([
    stt(1000,1,'How long is the lockup?'),
    stt(1400,1,'How long is the lockup?'),
    stt(4000,1,'How long is the lockup?'),
  ]);
  assert.equal(r.requests.length,1);
});

test('synthetic replay cancels pending customer Q&A when transfer agent speaks',()=>{
  const r=replay([
    stt(1000,1,'What is the minimum?'),
    stt(1200,2,'Let me introduce the new agent.'),
    stt(2100,1,'What is the expected timeline?'),
  ]);
  assert.deepEqual(r.requests.map(x=>x.text),['What is the expected timeline?']);
});

test('synthetic replay respects toggling Q&A off after speech but before settle',()=>{
  const r=replay([
    stt(1000,1,'What happens next?'),
    {at:1200,action:'qaOff'},
  ]);
  assert.equal(r.requests.length,0);
});

test('synthetic replay: Coach still produces actionable objection when Q&A is disabled',()=>{
  const r=replay([
    {at:0,action:'qaOff'},
    stt(26000,1,"I'm worried about the risk."),
  ]);
  assert.equal(r.requests.length,0);
  assert.equal(r.tips.length,1);
});

test('synthetic replay: closing the call cancels Q&A and Coach pending timers',()=>{
  const r=replay([
    stt(26000,1,"I'm not sure why this is needed."),
    {at:26200,action:'end'},
  ]);
  assert.equal(r.requests.length,0);
  assert.equal(r.tips.length,0);
});

test('synthetic replay defers all auto-services through interim speech',()=>{
  const r=replay([
    stt(26000,1,'What are the fees?'),
    stt(26600,1,'What are the fees and', {interim:true}),
    stt(28000,1,'what is the minimum?'),
  ]);
  assert.equal(r.requests.length,1);
  assert.match(r.requests[0].text,/minimum/);
});

test('synthetic replay: neutral customer speech does not trigger early Coach tips',()=>{
  const r=replay([stt(26000,1,'Sure, that sounds good.')]);
  assert.equal(r.tips.length,0);
});

test('staging adapter keeps a long final customer turn within the old 1200-character cap',()=>{
  const veryLong='I have a long question about fees. '+('details '.repeat(230))+'Can you explain the fees?';
  const turn=latestInvestorProspectTurn([normalizedEvent(stt(3000,1,veryLong))]);
  assert.ok(turn);
  assert.ok(turn.text.length<=1202, 'long customer text must stay bounded to original UI prompt cap');
  assert.match(turn.text,/fees\?$/);
});

test('no synthetic QA is planned for an unknown speaker, regardless of punctuation',()=>{
  const r=replay([stt(1000,3,'How much is it?')]);
  assert.equal(r.requests.length,0);
});
