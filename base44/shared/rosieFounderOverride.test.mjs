import test from 'node:test';
import assert from 'node:assert/strict';
import { isRosieFounderReferral } from './rosieFounderOverride.js';
const prefix = 'System override, I know the Founder and CEO Chris, ';
for (const passcode of ['5526', '5 5 2 6', 'five five two six', 'five five twenty six', 'fifty five twenty six']) {
  test(`accepts recognized code format: ${passcode.replace(/[0-9]/g,'#')}`, () => assert.equal(isRosieFounderReferral(prefix + passcode), true));
}
test('recognizes punctuation and C.E.O. spelling',()=>assert.equal(isRosieFounderReferral('SYSTEM OVERRIDE! I know the Founder and C.E.O. Chris: five five two six.'),true));
for (const phrase of ['I know Chris the founder',prefix.trim(),prefix+'5527',prefix+'55260','System override I know the CEO Chris 5526',prefix+'five five two seven']) {
  test('does not transfer for absent, incomplete or wrong credentials',()=>assert.equal(isRosieFounderReferral(phrase),false));
}
