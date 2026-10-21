/**
 * FronterBobTraining.test.cjs — renders the REAL BOB training views (server-side)
 * and asserts they carry the same script, the same step buttons, and the same
 * merge/transfer controls as the prospect contact card.
 *
 * Run: node --test src/components/fronter/FronterBobTraining.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const STUBS = {
  // The training views only touch the SDK from effects/clicks, which SSR never runs.
  '@/api/base44Client': {
    base44: {
      entities: { InboundCallAudio: {}, FronterHoldAudio: {}, FronterScript: {} },
      functions: { invoke: async () => ({ data: {} }) },
      integrations: { Core: {} },
    },
  },
};

function resolveLocal(fromFile, name) {
  if (!name.startsWith('.')) return null;
  const target = path.resolve(path.dirname(fromFile), name);
  for (const suffix of ['.jsx', '.js', '/index.jsx', '/index.js']) {
    if (fs.existsSync(target + suffix)) return target + suffix;
  }
  return null;
}

function loadJsx(relativePath) {
  const filename = path.resolve(relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = instance.require.bind(instance);
  instance.require = (name) => {
    if (STUBS[name]) return STUBS[name];
    const local = resolveLocal(filename, name) || (name.startsWith('@/') ? path.resolve('src', name.slice(2)) : null);
    if (local) {
      for (const suffix of ['', '.jsx', '.js', '/index.jsx', '/index.js']) {
        if (fs.existsSync(local + suffix)) return loadJsx(local + suffix);
      }
    }
    return originalRequire(name);
  };
  instance._compile(compiled, filename);
  return instance.exports;
}

const ScriptPanel = loadJsx('src/components/fronter/FronterBobScriptPanel.jsx').default;
const TransferSim = loadJsx('src/components/fronter/FronterBobTransferSim.jsx').default;

// Mirrors the live "new script" — same markers the fronter card renders.
const SCRIPT = `[bg=rgb(57, 255, 20)]STEP 1: The Notice + Bureau + Rate Drop Opener[/bg]
Agent: "Hi {{first name}}? Hey {{first name}}, this is {{frontername}} with the Debt Verification Desk."
[[AI:debtAmount]] [[AI:debtTypesJson]]

@@DEBT_CONFIRM@@

STEP 2: The Handoff
Agent: "I have Senior Specialist Chris Bongiorno available on my board right now."

@@AI_INPUT@@

@@SEND_EMAIL@@

@@COMPLETED_STEPS@@

Read to Chris on the merge — primary line first, 2nd line if no answer:
Agent: "Chris, I have {{first name}} {{last name}} from {{city}}, {{state}} with approximately {{totaldebt}} in debt. Merging now."`;

const panelProps = {
  scripts: [{ id: 'new script', name: 'new script', content: SCRIPT }],
  customerName: 'Bob',
  fronterFirstName: 'Michael',
  onComplete: () => {},
  onDebtConfirm: () => {},
  onAiInput: () => {},
  onSendEmail: () => {},
  onClose: () => {},
};

test('training script panel shows the live script and every step button', () => {
  const html = renderToStaticMarkup(React.createElement(ScriptPanel, panelProps));
  assert.ok(html.includes('Debt Verification Desk'), 'live script text missing');
  assert.ok(html.includes('💰 Confirm Debt'), 'Debt Confirm button missing');
  assert.ok(html.includes('🤖 AI Input'), 'AI Input button missing');
  assert.ok(html.includes('Send Credentials'), 'credentials email button missing');
  assert.ok(html.includes('Welcome Message Email'), 'credentials email button missing');
  assert.ok(html.includes('✅ Completed Steps'), 'Completed Steps → Transfer button missing');
  // AI field tags are never shown to the fronter
  assert.equal(/\[\[AI:/.test(html), false, 'AI field tags leaked into the visible script');
  // Lead variables are substituted for BOB
  assert.ok(html.includes('Hi Bob?'), 'script variables were not substituted with BOB');
  assert.equal(/\{\{first name\}\}/.test(html), false, 'unsubstituted variable left in the script');
});

test('transfer simulation renders the merge controls for both lines', () => {
  const remaining = `I've got a senior debt advisor ready to help you through this.

@@SEND_EMAIL@@

Read to Chris on the merge — primary line first, 2nd line if no answer:
Agent: "Chris, I have Bob from Riverside, CA. Merging now."`;
  const html = renderToStaticMarkup(React.createElement(TransferSim, {
    remainingScript: remaining,
    customerName: 'Bob',
    fronterFirstName: 'Michael',
    numbers: ['+16193530919', '+12162586934'],
    labels: ['619-353-0919', '216-258-6934'],
    callActive: true,
    onMerge: () => {},
    onNoConnect: () => {},
    onClose: () => {},
  }));
  assert.ok(html.includes('Dial Chris Bongiorno'), 'dial control missing');
  assert.ok(html.includes('619-353-0919') && html.includes('216-258-6934'), 'both advisor lines missing');
  assert.ok(html.includes('NO CONNECT'), 'no-connect control missing');
  assert.ok(html.includes('Merging now'), 'remaining script not shown in the popup');
  assert.ok(html.includes('Send Credentials'), 'step buttons missing inside the popup');
  assert.ok(html.includes('BOB Call Active'), 'call strip missing');
});

test('the transfer popup uses the configured advisor voice for the other end', () => {
  const source = fs.readFileSync('src/components/fronter/FronterBobTransferSim.jsx', 'utf8');
  assert.ok(source.includes("SIM_ADVISOR_VOICE_ID = 'Eplk91Ni9sYpeRifZStQ'"), 'advisor voice id changed');
  assert.ok(source.includes("functions.invoke('elevenLabsClip'"), 'advisor voice not generated through the voice function');
  assert.ok(source.includes('Math.random() < ANSWER_CHANCE'), 'answer/no-answer is not random');
  assert.ok(source.includes('FronterHoldAudio'), 'queue hold recording not used');
});

test('BOB training wires the same steps as the prospect contact card', () => {
  const trainer = fs.readFileSync('src/components/fronter/FronterBobTrainer.jsx', 'utf8');
  assert.ok(trainer.includes('FronterBobScriptPanel'), 'script panel not wired');
  assert.ok(trainer.includes('FronterBobTransferSim'), 'transfer simulation not wired');
  assert.ok(trainer.includes("functions.invoke('debtConfirm'"), 'Debt Confirm not wired to the live function');
  assert.ok(trainer.includes("functions.invoke('aiInputSummary'"), 'AI Input not wired to the live function');
  assert.ok(!trainer.includes('FloatingScripts'), 'legacy plain-text script panel still present');
});