import assert from 'node:assert/strict';
import test from 'node:test';

import { getIPhoneInstallGuide } from '../src/services/install-guide-rules.ts';

const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const chrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';

test('shows the direct install steps in iPhone Safari', () => {
  assert.equal(getIPhoneInstallGuide({ userAgent: safari, standalone: false, dismissed: false }), 'safari');
});

test('asks an iPhone user in another browser to open Safari first', () => {
  assert.equal(getIPhoneInstallGuide({ userAgent: chrome, standalone: false, dismissed: false }), 'open-safari');
});

test('hides the install prompt after installation or dismissal', () => {
  assert.equal(getIPhoneInstallGuide({ userAgent: safari, standalone: true, dismissed: false }), null);
  assert.equal(getIPhoneInstallGuide({ userAgent: safari, standalone: false, dismissed: true }), null);
});

test('does not show iPhone instructions on desktop or Android', () => {
  assert.equal(getIPhoneInstallGuide({ userAgent: 'Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1.15', standalone: false, dismissed: false }), null);
  assert.equal(getIPhoneInstallGuide({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36', standalone: false, dismissed: false }), null);
});
