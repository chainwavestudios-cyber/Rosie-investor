const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const helper = import(pathToFileURL(path.resolve('base44/shared/queueFronterCustomer.js')).href);

function setup({ headsUp, children = [], participants = [], conference = null, redirectFails = false, endedStaff = false } = {}) {
  const calls = [], records = [];
  const entities = { FronterHeadsUp: {
    filter: async () => ({ items: headsUp ? [headsUp] : [] }),
    create: async data => { records.push(data); calls.push('queue-saved'); return { id: 'test-headsup', ...data }; },
    update: async (id, data) => { records.push({ id, ...data }); calls.push('queue-saved'); },
  } };
  const twilioFetch = async (url, options = {}) => {
    const body = Object.fromEntries(options.body || []);
    calls.push({ url, body });
    if (body.Url && redirectFails) throw Object.assign(new Error('Call is no longer active'), { status: 409 });
    if (body.Status && endedStaff) throw Object.assign(new Error('Already gone'), { status: 404 });
    if (url.includes('ParentCallSid')) return { calls: children };
    if (url.includes('/Participants.json')) return { participants };
    return {};
  };
  const findConferenceSid = async () => { calls.push('conference-lookup'); return conference; };
  const body = { conferenceName: 'fronter_conf_CA_staff', fronterCallSid: 'CA_staff', agentCallSid: 'CA_agent', leadId: 'test-lead', fronterUsername: 'test-fronter', leadName: 'Test Customer' };
  return { body, entities, twilioFetch, findConferenceSid, holdUrl: 'https://rosieai-investorpage.base44.app/functions/appointmentVoiceHandler?step=hold&leadId=test-lead', calls, records };
}

test('NO CONNECT works after conference disappears, with no existing heads-up', async () => {
  const { queueFronterCustomer } = await helper;
  const context = setup();
  context.body.customerCallSid = 'CA_customer';
  const result = await queueFronterCustomer(context);
  assert.equal(result.ok, true);
  assert.equal(result.customerCallSid, 'CA_customer');
  assert.equal(context.calls.includes('conference-lookup'), false);
  assert.equal(context.calls[0].url, '/Calls/CA_customer.json');
  assert.equal(context.calls[0].body.Url, context.holdUrl);
  assert.equal(context.calls[1], 'queue-saved');
  assert.deepEqual(context.calls.slice(2).map(call => call.url).sort(), ['/Calls/CA_agent.json', '/Calls/CA_staff.json']);
  assert.equal(context.records[0].customerCallSid, 'CA_customer');
  assert.equal(context.records[0].status, 'active');
  assert.equal(context.calls.some(call => call?.url === '/Calls/CA_customer.json' && call.body.Status), false);
});

test('existing queued customer is resolved without an active conference', async () => {
  const { queueFronterCustomer } = await helper;
  const context = setup({ headsUp: { id: 'own-test-alert', customerCallSid: 'CA_customer', leadEmail: 'test@example.invalid' }, endedStaff: true });
  assert.equal((await queueFronterCustomer(context)).ok, true);
  assert.equal(context.records[0].id, 'own-test-alert');
  assert.equal(context.records[0].leadEmail, 'test@example.invalid');
  assert.equal(context.calls.includes('conference-lookup'), false);
});

test('older popup resolves the live customer from the parent call', async () => {
  const { queueFronterCustomer } = await helper;
  const context = setup({ children: [{ sid: 'CA_customer' }] });
  assert.equal((await queueFronterCustomer(context)).customerCallSid, 'CA_customer');
  assert.equal(context.calls.includes('conference-lookup'), false);
});

test('legacy held customer is redirected before staff calls end', async () => {
  const { queueFronterCustomer } = await helper;
  const context = setup({ conference: 'CF_test', participants: [{ call_sid: 'CA_staff', hold: false }, { call_sid: 'CA_customer', hold: true }] });
  assert.equal((await queueFronterCustomer(context)).customerCallSid, 'CA_customer');
  const redirect = context.calls.findIndex(call => call?.body?.Url);
  const disconnect = context.calls.findIndex(call => call?.body?.Status);
  assert.ok(redirect >= 0 && disconnect > redirect);
});

test('failed customer redirect never ends staff calls or saves false success', async () => {
  const { queueFronterCustomer } = await helper;
  const context = setup({ redirectFails: true });
  context.body.customerCallSid = 'CA_customer';
  await assert.rejects(queueFronterCustomer(context), /no longer active/);
  assert.equal(context.records.length, 0);
  assert.equal(context.calls.some(call => call?.body?.Status), false);
});

test('missing customer returns a clear conflict, not conference-not-found', async () => {
  const { queueFronterCustomer } = await helper;
  const context = setup();
  await assert.rejects(queueFronterCustomer(context), error => error.status === 409 && /customer call/.test(error.message));
  assert.equal(context.records.length, 0);
  assert.equal(context.calls.some(call => call?.body?.Status), false);
});