const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const source = readFileSync(resolve(process.cwd(), 'base44/shared/saveCalendarAppointment.ts'), 'utf8');
const load = () => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const startISO = new Date(Date.now() + 86400000).toISOString();
const lead = { id: 'own-test-client', firstName: 'Test', lastName: 'Client', appointmentEventId: 'own-test-event', appointmentDate: '2020-01-01T12:00:00Z' };
const old = { id: 'own-test-event', summary: 'Previous appointment', start: { dateTime: lead.appointmentDate }, end: { dateTime: '2020-01-01T12:30:00Z' } };
const body = { leadId: lead.id, startISO, duration: 30, title: 'Rebooked test appointment' };
function fixture(t, { conflict = false, failSave = false, noEvent = false } = {}) {
  const requests = [], patches = [], activities = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    const method = options.method || 'GET';
    if (String(url).includes('timeMin=')) return Response.json({ items: conflict ? [{ id: 'another-event', start: { dateTime: startISO }, end: { dateTime: new Date(new Date(startISO).getTime() + 1800000).toISOString() } }] : [] });
    if (method === 'GET') return Response.json(old);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ ...old, ...JSON.parse(options.body), htmlLink: 'https://calendar.google.com/calendar/event?eid=own-test-event' });
  });
  const base44 = { asServiceRole: { entities: {
    DebtLead: { get: async () => ({ ...lead, ...(noEvent ? { appointmentEventId: null } : {}) }), update: async (id, patch) => { patches.push({ id, patch }); if (failSave) throw new Error('Save failed'); return { ...lead, ...patch }; } },
    DebtLeadActivity: { create: async activity => { activities.push(activity); return { id: 'own-test-activity', ...activity }; } }
  } } };
  return { base44, requests, patches, activities };
}
test('rebooking updates the linked event and persists the selected time', async t => {
  const f = fixture(t), { default: save } = await load();
  const response = await save(f.base44, body, {}, 'test-assistant');
  const data = await response.json();
  assert.equal(data.status, 'success'); assert.equal(data.lead.appointmentDate, startISO);
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 0);
  assert.equal(f.requests.filter(r => r.method === 'PATCH').length, 1);
  assert.equal(f.patches[0].patch.appointmentConfirmed, false);
  assert.equal(f.patches[0].patch.hourBeforeReminderSentAt, null);
  assert.equal(f.patches[0].patch.rescheduleToken, null);
  assert.equal(f.activities[0].createdBy, 'test-assistant');
});
test('calendar conflicts reject rebooking without changing anything', async t => {
  const f = fixture(t, { conflict: true }), { default: save } = await load();
  assert.equal((await save(f.base44, body, {}, 'test-assistant')).status, 409);
  assert.equal(f.patches.length, 0); assert.equal(f.requests.filter(r => r.method !== 'GET').length, 0);
});
test('failed client save rolls an edited event back', async t => {
  const f = fixture(t, { failSave: true }), { default: save } = await load();
  await assert.rejects(() => save(f.base44, body, {}, 'test-assistant'), /Save failed/);
  const edits = f.requests.filter(r => r.method === 'PATCH');
  assert.equal(edits.length, 2); assert.deepEqual(edits[1].body.start, old.start);
  assert.equal(edits[1].body.summary, old.summary);
});
test('failed client save deletes only the newly created event', async t => {
  const f = fixture(t, { noEvent: true, failSave: true }), { default: save } = await load();
  await assert.rejects(() => save(f.base44, body, {}, 'test-assistant'), /Save failed/);
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1);
  assert.equal(f.requests.filter(r => r.method === 'DELETE').length, 1);
});
test('invalid dates reject before data or calendar requests', async t => {
  const f = fixture(t), { default: save } = await load();
  assert.equal((await save(f.base44, { ...body, startISO: 'not-a-date' }, {}, 'test-assistant')).status, 400);
  assert.equal(f.requests.length, 0); assert.equal(f.patches.length, 0);
});