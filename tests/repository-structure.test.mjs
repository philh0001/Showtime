import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function sourceFiles(relativePath) {
  const directory = path.join(root, relativePath);
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'worker-dist', '.wrangler'].includes(entry.name)) continue;
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(child));
    else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) output.push(child);
  }
  return output;
}

test('uses explicit environment roots and no legacy roots', async () => {
  for (const directory of ['app', 'shared/tmdb-api', 'production/api', 'production/web', 'local-uat/api']) {
    assert.equal(await exists(directory), true, `${directory} is required`);
  }
  assert.equal(await exists('mobile'), false, 'legacy mobile root must be removed');
  assert.equal(await exists('worker'), false, 'legacy worker root must be removed');
});

test('keeps production and local UAT source independent', async () => {
  for (const file of await sourceFiles('production')) {
    assert.doesNotMatch(await readFile(path.join(root, file), 'utf8'), /from\s+['"][^'"]*local-uat/);
  }
  for (const file of await sourceFiles('local-uat')) {
    assert.doesNotMatch(await readFile(path.join(root, file), 'utf8'), /from\s+['"][^'"]*production/);
  }
});
