import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(webRoot, '..', '..');

async function readJson(absolutePath) {
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

test('production web export is configured as a Cloudflare-hosted SPA', async () => {
  const [app, webPackage, webConfig] = await Promise.all([
    readJson(path.join(repositoryRoot, 'app', 'app.json')),
    readJson(path.join(webRoot, 'package.json')),
    readJson(path.join(webRoot, 'wrangler.jsonc')),
  ]);

  assert.equal(app.expo.web.output, 'single');
  assert.equal(webPackage.scripts.build, 'node scripts/export-web.mjs');
  assert.equal(webConfig.name, 'showtime-web');
  assert.equal(webConfig.main, 'src/worker.ts');
  assert.equal(webConfig.compatibility_date, '2026-09-16');
  assert.equal(webConfig.workers_dev, true);
  assert.equal(webConfig.preview_urls, false);
  assert.deepEqual(webConfig.assets, {
    directory: './dist',
    binding: 'ASSETS',
    run_worker_first: true,
    not_found_handling: 'single-page-application',
  });
});

test('API CORS and deployment identity remain pinned to production', async () => {
  const apiConfigText = await readFile(
    path.join(repositoryRoot, 'production', 'api', 'wrangler.jsonc'),
    'utf8',
  );

  assert.match(apiConfigText, /"name"\s*:\s*"showtime-api"/);
  assert.match(apiConfigText, /"ALLOWED_ORIGINS"\s*:\s*"https:\/\/showtimetracker\.show"/);
});

test('production export script embeds only the public custom API URL', async () => {
  const exportScript = await readFile(path.join(webRoot, 'scripts', 'export-web.mjs'), 'utf8');

  assert.match(exportScript, /https:\/\/api\.showtimetracker\.show/);
  assert.match(exportScript, /process\.execPath/);
  assert.match(exportScript, /node_modules.*expo.*bin.*cli/s);
  assert.doesNotMatch(exportScript, /npx\.cmd/);
  assert.doesNotMatch(exportScript, /TMDB_(?:API_KEY|READ_ACCESS_TOKEN)/);
});
