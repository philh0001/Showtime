import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(mobileRoot, '..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(mobileRoot, relativePath), 'utf8'));
}

test('production web export is configured as a Cloudflare-hosted SPA', async () => {
  const [app, packageJson, wrangler] = await Promise.all([
    readJson('app.json'),
    readJson('package.json'),
    readJson('wrangler.jsonc'),
  ]);

  assert.equal(app.expo.web.output, 'single');
  assert.equal(packageJson.scripts['web:export:production'], 'node scripts/export-web.mjs');
  assert.equal(wrangler.name, 'showtime-web');
  assert.equal(wrangler.compatibility_date, '2026-09-16');
  assert.equal(wrangler.workers_dev, true);
  assert.equal(wrangler.preview_urls, false);
  assert.deepEqual(wrangler.assets, {
    directory: './dist',
    not_found_handling: 'single-page-application',
  });
});

test('API CORS is pinned to the deployed frontend origin', async () => {
  const workerConfig = await readFile(
    path.join(repositoryRoot, 'worker', 'wrangler.jsonc'),
    'utf8',
  );
  const allowedOrigins = workerConfig.match(/"ALLOWED_ORIGINS"\s*:\s*"([^"]*)"/)?.[1];

  assert.equal(
    allowedOrigins,
    'https://showtime-web.showtime-workers.workers.dev',
  );
});

test('production export script embeds only the public Worker URL', async () => {
  const script = await readFile(path.join(mobileRoot, 'scripts/export-web.mjs'), 'utf8');

  assert.match(script, /https:\/\/showtime-api\.showtime-workers\.workers\.dev/);
  assert.match(script, /process\.execPath/);
  assert.match(script, /node_modules.*expo.*bin.*cli/s);
  assert.doesNotMatch(script, /npx\.cmd/);
  assert.doesNotMatch(script, /TMDB_(?:API_KEY|READ_ACCESS_TOKEN)/);
});
