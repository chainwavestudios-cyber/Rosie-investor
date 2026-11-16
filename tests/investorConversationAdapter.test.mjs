import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INVESTOR_CONVERSATION_POLICY_VERSION,
  INVESTOR_SHARED_POLICY_ENABLED,
  investorPilotEnabled,
  investorConversationSegments,
  investorNeedsQuestionReview,
  investorPlanLiveServices,
  investorSettleDelay,
  latestInvestorProspectTurn,
} from '../src/lib/investorConversationAdapter.js';

const time = '2026-11-15T15:00:00.000Z';
const sample = (speaker, text, ms, extra = {}) => ({
  speaker, text, time: new Date(Date.parse(time) + ms).toISOString(), ...extra,
});

test('matches exact versioned shared policy without requiring a Core provider', () => {
  assert.equal(INVESTOR_CONVERSATION_POLICY_VERSION, 'rosie.live_intelligence.v1');
  assert.equal(INVESTOR_SHARED_POLICY_ENABLED, false);
});


test('pilot response epoch allows only the currently live call', async () => {
  const { investorPilotResponseCurrent } = await import('../src/lib/investorConversationAdapter.js');
  assert.equal(investorPilotResponseCurrent({pilotEnabled:true,requestEpoch:7,currentEpoch:7,active:true}),true);
  assert.equal(investorPilotResponseCurrent({pilotEnabled:true,requestEpoch:7,currentEpoch:7,active:false}),false);
  assert.equal(investorPilotResponseCurrent({pilotEnabled:true,requestEpoch:7,currentEpoch:9,active:true}),false);
  assert.equal(investorPilotResponseCurrent({pilotEnabled:true,requestEpoch:0,currentEpoch:0,active:false}),false);
});

test('legacy response path stays unchanged by pilot-only epoch validation', async () => {
  const { investorPilotResponseCurrent } = await import('../src/lib/investorConversationAdapter.js');
  assert.equal(investorPilotResponseCurrent({pilotEnabled:false,requestEpoch:4,currentEpoch:9,active:false}),true);
});

test('pilot epoch excludes stale provider success and failure after a subsequent call starts', async () => {
  const { investorPilotResponseCurrent } = await import('../src/lib/investorConversationAdapter.js');
  const state={active:true,epoch:2};
  const requestEpoch=state.epoch;
  const accept=()=>investorPilotResponseCurrent({
    pilotEnabled:true,requestEpoch,currentEpoch:state.epoch,active:state.active,
  });
  assert.equal(accept(),true);
  state.active=false;state.epoch++;
  assert.equal(accept(),false,'after teardown, old provider callback must not render');
  state.active=true;state.epoch++;
  assert.equal(accept(),false,'after next call starts, stale callback must remain blocked');
  assert.equal(investorPilotResponseCurrent({
    pilotEnabled:true,requestEpoch:state.epoch,currentEpoch:state.epoch,active:state.active,
  }),true,'new call can receive its own responses');
});

test('pilot source closes request gate before awaiting teardown and avoids pre-invocation double QA logging', () => {
  const callUi=readFileSync(new URL('../src/components/debt/DebtLiveCall.jsx',import.meta.url),'utf8');
  const stop=callUi.indexOf('const stopCall = useCallback(async () => {');
  assert.ok(stop>0);
  const close=callUi.indexOf('sharedCallActiveRef.current = false;',stop);
  const firstAwait=callUi.indexOf('await ',stop);
  assert.ok(close>stop && close<firstAwait,'pilot must close synchronously before stopCall async work');
  assert.match(callUi, /if \(!sharedPolicyEnabled\) logAI\('qa'\);/);
  assert.match(callUi, /if \(!acceptPilotReply\(\) \|\| supersededQaIdsRef.current.has\(id\)\) return;/);
});

test('BOB/Investor pilot is denied unless BOTH build and admin-saved user flag are true', () => {
  assert.equal(investorPilotEnabled({ sharedConversationV1: true }), false, 'node build default is off');
  assert.equal(investorPilotEnabled({}, { buildEnabled: true }), false);
  assert.equal(investorPilotEnabled({ sharedConversationV1: false }, { buildEnabled: true }), false);
  assert.equal(investorPilotEnabled({ sharedConversationV1: 'true' }, { buildEnabled: true }), false);
  assert.equal(investorPilotEnabled(null, { buildEnabled: true }), false);
  assert.equal(investorPilotEnabled({ sharedConversationV1: true }, { buildEnabled: false }), false);
  assert.equal(investorPilotEnabled({ sharedConversationV1: true }, { buildEnabled: true }), true);
});

test('staging pilot key is wired in both admin UI and server allowlist (source contract)', () => {
  const admin = readFileSync(new URL('../src/components/debt/manager/AdminFlagsTab.jsx', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../base44/functions/debtCoachAuth/entry.ts', import.meta.url), 'utf8');
  const callUi = readFileSync(new URL('../src/components/debt/DebtLiveCall.jsx', import.meta.url), 'utf8');
  assert.match(admin, /key: 'sharedConversationV1'/);
  assert.match(admin, /acc\[k\] = k !== 'sharedConversationV1'/);
  assert.match(admin, /k==='sharedConversationV1'\?false:val/);
  assert.match(backend, /'sharedConversationV1'/);
  assert.match(callUi, /sharedPolicyEnabled = investorPilotEnabled\(aiSettings\)/);
});

test('Investor real-call source maps 0 agent, 1 prospect, 2 transfer as unknown', () => {
  assert.deepEqual(investorConversationSegments([
    sample(0, 'Agent', 0), sample(1, 'Caller', 200), sample(2, 'Transfer', 400),
  ]).map(x => x.role), ['agent', 'prospect', 'unknown']);
});

test('BOB-style sentence assembly combines consecutive customer fragments once', () => {
  const lines = [
    sample(0, 'Good afternoon', 0),
    sample(1, 'So my wife is a co-signer', 1500),
    sample(1, 'would she need to sign too?', 2150),
  ];
  const turn = latestInvestorProspectTurn(lines);
  assert.equal(turn?.text, 'So my wife is a co-signer would she need to sign too?');
  assert.equal(investorNeedsQuestionReview(turn), true);
});

test('does not mistake agent speech for a customer question', () => {
  const turn = latestInvestorProspectTurn([
    sample(1, 'I understand.', 0), sample(0, 'What are your questions?', 300),
  ]);
  assert.equal(turn, null);
  assert.equal(investorNeedsQuestionReview({ role: 'trainee', text: 'What fees?' }), false);
});

test('never auto-processes transfer speaker as prospect', () => {
  const turn = latestInvestorProspectTurn([
    sample(1, 'How do fees work?', 0), sample(2, 'I will transfer the call', 200),
  ]);
  assert.equal(turn, null);
});

test('transfer handoff breaks question merging between callers', () => {
  const turn = latestInvestorProspectTurn([
    sample(1, 'Question before transfer', 0), sample(2, 'Here is the caller', 200),
    sample(1, 'What is the minimum investment?', 1000),
  ]);
  assert.equal(turn?.text, 'What is the minimum investment?');
});

test('interim previews cannot trigger question generation', () => {
  assert.equal(latestInvestorProspectTurn([sample(1, 'What fees?', 0, { interim: true })]), null);
});

test('implicit questions are recognized, statements are not billed by QA', () => {
  assert.equal(investorNeedsQuestionReview({ role: 'prospect', text: "I'm not sure how this works." }), true);
  assert.equal(investorNeedsQuestionReview({ role: 'prospect', text: 'That is fine, thank you.' }), false);
});

test('QA, Coach and Intent plan independently and respect off switches', () => {
  const turn = { role: 'prospect', text: "I'm worried about the fees." };
  const now = 90000;
  const enabled = investorPlanLiveServices({ turn, now, enabled: { qa:true, coach:false, intent:false } });
  assert.equal(enabled.qa, true);
  assert.equal(enabled.coach, false);
  assert.equal(enabled.intent, false);
  const off = investorPlanLiveServices({ turn, now, enabled: { qa:false, coach:false, intent:false } });
  assert.equal(off.qa, false);
  assert.equal(off.coach, false);
  assert.equal(off.intent, false);
  const coachOnly = investorPlanLiveServices({ turn, now, enabled:{ qa:false, coach:true, intent:false } });
  assert.equal(coachOnly.coach, true);
  assert.equal(coachOnly.qa, false);
});

test('explicit finished questions settle sooner than incomplete speech', () => {
  assert.ok(investorSettleDelay('What are the fees?') < investorSettleDelay('What are the fees and'));
});

test('staged Q&A gate rejects statements and manual/agent turn auto-detection', async () => {
  const { investorShouldAskSettled } = await import('../src/lib/investorConversationAdapter.js');
  assert.equal(investorShouldAskSettled({turn:{role:'prospect',text:'That seems fine.'},enabled:true,now:90000}),false);
  assert.equal(investorShouldAskSettled({turn:{role:'agent',text:'What happens next?'},enabled:true,now:90000}),false);
  assert.equal(investorShouldAskSettled({turn:{role:'prospect',text:'What happens next?'},enabled:false,now:90000}),false);
});

test('staged Q&A gate suppresses repeated words despite punctuation differences within 11 sec', async () => {
  const { investorShouldAskSettled } = await import('../src/lib/investorConversationAdapter.js');
  assert.equal(investorShouldAskSettled({
    turn:{role:'prospect',text:'What are the fees?'},enabled:true,now:11000,
    lastAskedText:'What are the fees',lastAskedAt:9000,
  }),false);
});

test('staged Q&A gate still permits a new question and a substantially longer correction', async () => {
  const { investorShouldAskSettled } = await import('../src/lib/investorConversationAdapter.js');
  assert.equal(investorShouldAskSettled({
    turn:{role:'prospect',text:'How does an IRA work?'},enabled:true,now:11000,
    lastAskedText:'What are the fees?',lastAskedAt:9000,
  }),true);
  assert.equal(investorShouldAskSettled({
    turn:{role:'prospect',text:'What are the fees and can I use an IRA?'},enabled:true,now:11000,
    lastAskedText:'What are the fees?',lastAskedAt:9000,
  }),true);
});

test('staged Q&A can consider a repeated real question after 11-second cooldown', async () => {
  const { investorShouldAskSettled } = await import('../src/lib/investorConversationAdapter.js');
  assert.equal(investorShouldAskSettled({
    turn:{role:'prospect',text:'Why do I need to verify?'},enabled:true,now:29001,
    lastAskedText:'Why do I need to verify?',lastAskedAt:17000,
  }),true);
});


test('settled Coach requires enabled prospect and can run while Q&A stays off', async () => {
  const { investorShouldCoachSettled } = await import('../src/lib/investorConversationAdapter.js');
  const turn = { role: 'prospect', text: "I'm worried about the risk." };
  assert.equal(investorShouldCoachSettled({ turn, enabled: true, now: 25_001, lastCoachAt: 0 }), true);
  assert.equal(investorShouldCoachSettled({ turn, enabled: false, now: 25_001, lastCoachAt: 0 }), false);
  assert.equal(investorShouldCoachSettled({ turn: { ...turn, role: 'trainee' }, enabled: true, now: 25_001, lastCoachAt: 0 }), false);
});

test('Coach respects cooldown and will not retrigger an identical turn', async () => {
  const { investorShouldCoachSettled } = await import('../src/lib/investorConversationAdapter.js');
  const turn = { role: 'prospect', text: 'I am worried about the fees.' };
  assert.equal(investorShouldCoachSettled({ turn, enabled: true, now: 38_000, lastCoachAt: 25_000 }), false);
  assert.equal(investorShouldCoachSettled({ turn, enabled: true, now: 55_000, lastCoachAt: 25_000, lastCoachKey: 'i am worried about the fees' }), false);
  assert.equal(investorShouldCoachSettled({ turn, enabled: true, now: 55_000, lastCoachAt: 25_000, lastCoachKey: 'different previous turn' }), true);
});

test('Coach preserves original 45-second periodic tip fallback on neutral full turns', async () => {
  const { investorShouldCoachSettled } = await import('../src/lib/investorConversationAdapter.js');
  const turn = { role: 'prospect', text: 'Yes, I understand, thank you.' };
  assert.equal(investorShouldCoachSettled({ turn, enabled: true, now: 25_000, lastCoachAt: 1_000 }), false);
  assert.equal(investorShouldCoachSettled({ turn, enabled: true, now: 46_100, lastCoachAt: 1_000 }), true);
});

test('progressive Deepgram final revisions do not duplicate overlapping words', () => {
  const turn = latestInvestorProspectTurn([
    sample(1, 'So I was wondering', 0),
    sample(1, 'wondering if there is a fee?', 700),
  ]);
  assert.equal(turn?.text, 'So I was wondering if there is a fee?');
});

test('speaker boundary always wins even when caller and agent overlap in time', () => {
  const turn = latestInvestorProspectTurn([
    sample(1, 'Can you explain', 0),
    sample(0, 'Let me clarify that', 350),
    sample(1, 'the lockup?', 500),
  ]);
  assert.equal(turn?.text, 'the lockup?');
});

test('long pauses do not merge two separate caller questions', () => {
  const turn = latestInvestorProspectTurn([
    sample(1, 'What is the minimum?', 0),
    sample(1, 'How much are the fees?', 15_000),
  ]);
  assert.equal(turn?.text, 'How much are the fees?');
});

test('unknown and transfer channels never become a prospect when sole input', () => {
  assert.equal(latestInvestorProspectTurn([sample(2, 'What investment?', 0)]), null);
  assert.equal(latestInvestorProspectTurn([sample(3, 'What investment?', 0)]), null);
  assert.equal(latestInvestorProspectTurn([sample(undefined, 'What investment?', 0)]), null);
});

test('final=false and interim content are ignored, keeping last complete prospect text', () => {
  const turn = latestInvestorProspectTurn([
    sample(1, 'How much can I invest?', 0),
    sample(1, 'How much can I invest with', 350, { interim: true }),
    sample(1, 'can I invest with', 450, { final: false }),
  ]);
  assert.equal(turn?.text, 'How much can I invest?');
});

test('disabled shared services cannot plan paid inference, including question-looking customer lines', () => {
  const turn = latestInvestorProspectTurn([sample(1, 'How do the shares work?', 0)]);
  const decisions = investorPlanLiveServices({
    turn, enabled: { qa: false, coach: false, intent: false }, now: 90_000,
  });
  assert.equal(decisions.qa, false);
  assert.equal(decisions.coach, false);
  assert.equal(decisions.intent, false);
});

