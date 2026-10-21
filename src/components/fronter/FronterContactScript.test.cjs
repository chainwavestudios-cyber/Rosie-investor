const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Render the real extracted view, not a duplicate fixture implementation.
function loadJsx(relativePath) {
  const filename = path.resolve(relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = instance.require.bind(instance);
  const LOCAL_MODULES = {
    '@/components/debt/ScriptRichText': 'src/components/debt/ScriptRichText.jsx',
    '@/lib/fronterContactFields': 'src/lib/fronterContactFields.js',
  };
  instance.require = name => LOCAL_MODULES[name] ? loadJsx(LOCAL_MODULES[name]) : originalRequire(name);
  instance._compile(compiled, filename);
  return instance.exports;
}
const View = loadJsx('src/components/fronter/FronterContactScript.jsx').default;
const base = { scripts: [{ id: 'test', name: 'Test script' }], activeScript: { id: 'test' }, segments: ['Opening', 'AI_INPUT', 'Text after AI input'], hasCompletedSteps: true };

test('Complete follows AI Input immediately, before the rest of the script', () => {
  const html = renderToStaticMarkup(React.createElement(View, base));
  const ai = html.indexOf('🤖 AI Input');
  const complete = html.indexOf('✅ Completed Steps');
  const trailing = html.indexOf('Text after AI input');
  assert.ok(ai >= 0 && complete > ai && trailing > complete);
  assert.equal((html.match(/✅ Completed Steps/g) || []).length, 1);
  assert.ok(html.includes('min-height:0'));
  assert.ok(html.includes('overflow-y:auto'));
  assert.equal(/position:(sticky|fixed)/.test(html), false);
});

test('scripts without AI Input retain the inline transfer action', () => {
  const html = renderToStaticMarkup(React.createElement(View, { ...base, segments: ['Opening'] }));
  assert.ok(html.indexOf('✅ Completed Steps') > html.indexOf('Opening'));
});

test('scripts without a completion marker do not gain a transfer action', () => {
  const html = renderToStaticMarkup(React.createElement(View, { ...base, hasCompletedSteps: false }));
  assert.equal(html.includes('✅ Completed Steps'), false);
});

test('script window uses viewport bounds without overwriting saved layout', () => {
  const source = fs.readFileSync('src/components/fronter/FronterContactCard.jsx', 'utf8');
  assert.ok(source.includes('data-testid="fronter-script-popout"'));
  assert.ok(source.includes('calc(100vh - 16px)'));
  assert.ok(source.includes('calc(100vw - 16px)'));
  assert.ok(source.includes('onComplete={() => { setTransferScript(remainingScriptPart); setShowMergePopup(true); }}'));
});

// ── AI field tags ────────────────────────────────────────────────────────────
const { parseScriptElements } = loadJsx('src/components/debt/ScriptTeleprompter.jsx');
const {
  FRONTER_CONTACT_TABS,
  FRONTER_CONTACT_FIELDS,
  aiTagToken,
  stripAiTags,
  extractAiTags,
  describeAiTag,
} = loadJsx('src/lib/fronterContactFields.js');

test('AI field tags are invisible while viewing or using the script', () => {
  const content = 'Hi {{first name}} [[AI:tab_contact]] what is your email? [[AI:email]] and your zip? [[AI:zipCode]]';
  const rendered = parseScriptElements(content).map(el => el.content).join('\n');
  assert.equal(/\[\[AI:/.test(rendered), false);
  assert.ok(rendered.includes('Hi {{first name}}'));
  assert.ok(rendered.includes('what is your email?'));
  assert.ok(rendered.includes('and your zip?'));
  assert.equal(/\[\[AI:/.test(stripAiTags(content)), false);
});

test('every contact card field and card tab has an AI field tag', () => {
  assert.ok(FRONTER_CONTACT_TABS.length >= 6);
  for (const tab of FRONTER_CONTACT_TABS) {
    assert.equal(tab.tag, `tab_${tab.key}`);
    assert.ok(tab.fields.length > 0, `${tab.key} has no fields`);
  }
  const names = FRONTER_CONTACT_FIELDS.map(f => f.field);
  for (const expected of [
    'firstName', 'lastName', 'phone', 'phone2', 'email', 'address', 'city', 'state', 'zipCode',
    'debtAmount', 'debtTypesJson', 'debtAmountsJson', 'preferredCallTime',
    'employmentStatus', 'annualIncome', 'householdIncome', 'age', 'tradelines', 'homeValue', 'homeEquity',
    'hardshipQualification', 'referralSource', 'notes', 'leadConfirmedChecklistJson',
  ]) {
    assert.ok(names.includes(expected), `missing field tag: ${expected}`);
  }
  const script = [...FRONTER_CONTACT_TABS.map(t => aiTagToken(t.tag)), ...names.map(aiTagToken)].join(' ');
  assert.equal(extractAiTags(script).length, FRONTER_CONTACT_TABS.length + names.length);
  assert.ok(describeAiTag('tab_debt').includes('Debt Info'));
  assert.ok(describeAiTag('zipCode').includes('Zip Code'));
});

test('the live script offers the credentials and welcome message email button', () => {
  const html = renderToStaticMarkup(React.createElement(View, { ...base, segments: ['Opening', 'SEND_EMAIL'] }));
  assert.ok(html.includes('Send Credentials'));
  assert.ok(html.includes('Welcome Message Email'));
});