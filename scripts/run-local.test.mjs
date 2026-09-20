import assert from 'node:assert/strict';
import test from 'node:test';
import { localCommands } from './run-local.mjs';

test('starts the local API and web client with platform-safe commands', () => {
  const windows = localCommands('win32');
  assert.deepEqual(windows[0].args, ['local-uat/api/start.mjs']);
  assert.equal(windows[1].command, 'npm.cmd');
  assert.deepEqual(windows[1].args, ['--prefix', 'app', 'run', 'web']);
  assert.equal(localCommands('linux')[1].command, 'npm');
});
