import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVESTOR_CONVERSATION_POLICY_VERSION,
  INVESTOR_SHARED_POLICY_ENABLED,
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
