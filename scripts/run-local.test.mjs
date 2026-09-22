import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { localCommands } from './run-local.mjs';

test('starts the local API and Expo web client as direct Node children', () => {
  const [api, web] = localCommands();
  assert.equal(api.command, process.execPath);
  assert.match(api.args[0], /local-uat[\\/]api[\\/]start\.mjs$/);
  assert.equal(web.command, process.execPath);
  assert.match(web.args[0], /app[\\/]node_modules[\\/]expo[\\/]bin[\\/]cli$/);
  assert.deepEqual(web.args.slice(1), ['start', '--web']);
  assert.match(web.cwd, /[\\/]app$/);
});

test('local web command can launch the installed Expo CLI', async () => {
  const web = localCommands()[1];
  const child = spawn(web.command, [web.args[0], '--version'], { cwd: web.cwd, stdio: 'ignore' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0);
});
