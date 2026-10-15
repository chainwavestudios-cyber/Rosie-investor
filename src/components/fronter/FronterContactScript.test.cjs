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
  instance.require = name => name === '@/components/debt/ScriptRichText' ? loadJsx('src/components/debt/ScriptRichText.jsx') : originalRequire(name);
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