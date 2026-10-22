const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative) {
  const filename = path.resolve(relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = instance.require.bind(instance);
  instance.require = name => {
    let local;
    if (name.startsWith('@/')) local = path.resolve('src', name.slice(2));
    else if (name.startsWith('.')) local = path.resolve(path.dirname(filename), name);
    if (local) {
      const target = [local, `${local}.js`, `${local}.jsx`, `${local}.ts`].find(candidate => fs.existsSync(candidate));
      if (target) return load(target);
    }
    return originalRequire(name);
  };
  instance._compile(compiled, filename);
  return instance.exports;
}
const { DEBT_CONTACT_FIELDS, DEBT_CONTACT_TABS } = load('src/lib/debtContactFields.js');
const { parseScriptElements, default: Teleprompter } = load('src/components/debt/ScriptTeleprompter.jsx');
const Toolbar = load('src/components/debt/DebtScriptInsertToolbar.jsx').default;
const { substituteScriptVars } = load('src/lib/scriptSubstitute.js');
const { validateDebtCollection, mergeDebtCollection } = load('base44/shared/debtFieldCollections.ts');
const tokens = ['first name', 'last name', 'phone', 'zip', 'city', 'state', 'email', 'address', 'notice id', 'debt amount', 'frontername'];
global.window = {};

test('toolbar exposes all eleven variables, three cues, four actions and grouped field tags', () => {
  const html = renderToStaticMarkup(React.createElement(Toolbar, { variables: tokens.map(name => ({ token: `{{${name}}}` })), accent: '#10b981', onInsert: () => {} }));
  for (const token of tokens) assert.ok(html.includes(`{{${token}}}`));
  for (const label of ['Reminder', 'Objection', 'Tone', 'AI Field Tag', 'Debt Confirm', 'Completed Steps', 'AI Input', 'Send Credentials &amp; Welcome Email']) assert.ok(html.includes(label), label);
  for (const tab of DEBT_CONTACT_TABS) assert.ok(html.includes(`value="${tab.tag}"`));
});

test('field tags cover financials, individual expenses, account properties and every co-signer input', () => {
  const fields = new Set(DEBT_CONTACT_FIELDS.map(field => field.field));
  for (const field of ['firstName', 'lastName', 'phone', 'email', 'address', 'city', 'state', 'zip', 'dateOfBirth', 'age', 'monthlyIncome', 'householdIncome', 'homeValue', 'homeEquity', 'tradelines', 'debtAmount', 'creditScore', 'monthsBehind', 'billsJson_rent', 'billsJson_autoInsurance', 'billsJson_childcare', 'debtLedgerJson_creditLimit', 'debtLedgerJson_interestRate', 'debtLedgerJson_accountLast4', 'cosignersJson_name', 'cosignersJson_relationship', 'cosignersJson_phone', 'cosignersJson_email', 'cosignersJson_accounts', 'cosignersJson_employed', 'cosignersJson_notes', 'hardshipWhy', 'callbackAt', 'notes']) assert.ok(fields.has(field), field);
});

test('teleprompter preserves cue/action order and hides all child-field tags', () => {
  const content = 'Opening [[AI:homeEquity]]\n@@CUE:reminder:Listen@@\n@@DEBT_CONFIRM@@\nNext [[AI:billsJson_rent]]\n@@AI_INPUT@@\n@@SEND_EMAIL@@\n@@COMPLETED_STEPS@@';
  const elements = parseScriptElements(content);
  assert.deepEqual(elements.map(el => el.type === 'action' ? el.action : el.type), ['script', 'cue_block', 'debtConfirm', 'script', 'aiInput', 'sendEmail', 'completedSteps']);
  assert.ok(elements.filter(el => el.type === 'script').every(el => !el.content.includes('[[AI:')));
  const html = renderToStaticMarkup(React.createElement(Teleprompter, { content, actions: { onDebtConfirm() {}, onCompletedSteps() {}, onAiInput() {}, onSendEmail() {} } }));
  const positions = ['Opening', 'Listen', '💰 Debt Confirm', 'Next ', '🤖 AI Input', '📧 Send Credentials &amp; Welcome Email', '✅ Completed Steps'].map(text => html.indexOf(text));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  const actionOnly = renderToStaticMarkup(React.createElement(Teleprompter, { content: '@@AI_INPUT@@', actions: { onAiInput() {} } }));
  assert.ok(actionOnly.includes('🤖 AI Input'));
});

test('all requested variables resolve including signed-in agent and debt-card zip', () => {
  const lead = { firstName: 'Alex', lastName: 'Example', phone: '2025550100', zip: '90210', city: 'Example City', state: 'CA', email: 'alex@example.com', address: '1 Test Street', leadNumber: 'TEST-100', debtAmount: 20000 };
  const result = substituteScriptVars(tokens.map(token => `{{${token}}}`).join('|'), { lead, fronterFirstName: 'Agent' });
  assert.equal(result.includes('{{'), false);
  assert.ok(result.includes('1 Test Street, Example City, CA, 90210'));
  assert.ok(result.includes('TEST-100|$20,000|Agent'));
});

test('collection validation and merging preserve unmentioned values and existing records', () => {
  const bills = validateDebtCollection('billsJson', { rent: '$1,800', gas: -2, invalid: null });
  assert.equal(bills.valid, true);
  assert.deepEqual(JSON.parse(mergeDebtCollection('billsJson', '{"utilities":145}', bills.cleaned)), { utilities: 145, rent: 1800 });
  const ledger = validateDebtCollection('debtLedgerJson', [{ creditor: 'Chase', interestRate: 24.99, injected: 'ignored' }]);
  assert.equal(ledger.valid, true);
  const merged = JSON.parse(mergeDebtCollection('debtLedgerJson', '[{"creditor":"Chase","balance":7200,"accountLast4":"1234"},{"creditor":"Other","balance":500}]', ledger.cleaned));
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], { creditor: 'Chase', balance: 7200, accountLast4: '1234', interestRate: 24.99 });
  assert.equal(validateDebtCollection('cosignersJson', [{ phone: '2025550100' }]).valid, false);
  const cosigner = validateDebtCollection('cosignersJson', [{ name: 'Jordan', phone: '2025550138' }]);
  assert.deepEqual(JSON.parse(mergeDebtCollection('cosignersJson', '[{"name":"Jordan","relationship":"Spouse"}]', cosigner.cleaned)), [{ name: 'Jordan', relationship: 'Spouse', phone: '2025550138' }]);
});