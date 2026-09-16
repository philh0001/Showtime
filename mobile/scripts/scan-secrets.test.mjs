import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { scanPaths } from './scan-secrets.mjs';

test('finds canaries but ignores dependency and fixture directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'showtime-scan-'));
  await mkdir(join(root, 'node_modules'), { recursive: true });
  await mkdir(join(root, 'fixtures'), { recursive: true });
  await writeFile(join(root, 'bundle.js'), 'secret-canary');
  await writeFile(join(root, 'node_modules', 'dependency.js'), 'secret-canary');
  await writeFile(join(root, 'fixtures', 'fixture.js'), 'secret-canary');

  const findings = await scanPaths([root]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file.endsWith('bundle.js'), true);
  assert.equal(Object.hasOwn(findings[0], 'value'), false);
});

test('reports a tracked dev vars filename without exposing its contents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'showtime-scan-'));
  await writeFile(join(root, '.dev.vars.example'), 'placeholder');
  const findings = await scanPaths([root]);
  assert.equal(findings[0].rule, 'tracked-dev-vars');
});
