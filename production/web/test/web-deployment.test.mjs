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

test('version inspection and rollback run inside each Worker package', async () => {
  for (const packageRoot of [webRoot, path.join(repositoryRoot, 'production', 'api')]) {
    const workerPackage = await readJson(path.join(packageRoot, 'package.json'));
    assert.equal(workerPackage.scripts['versions:list'], 'wrangler versions list');
    assert.equal(workerPackage.scripts.rollback, 'wrangler rollback');
  }
});

test('release gate verifies the generated browser artifact', async () => {
  const webPackage = await readJson(path.join(webRoot, 'package.json'));
  assert.equal(webPackage.scripts['verify:bundle'], 'node scripts/verify-bundle.mjs');
  assert.match(webPackage.scripts.check, /npm run build && npm run verify:bundle &&/);
});

test('website export identifies Showtime and includes iPhone Home Screen metadata', async () => {
  const html = await readFile(path.join(webRoot, 'dist', 'index.html'), 'utf8');
  const manifest = await readJson(path.join(webRoot, 'dist', 'manifest.json'));

  assert.match(html, /<title>Showtime<\/title>/);
  assert.match(html, /rel="manifest" href="\/manifest\.json"/);
  assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  assert.equal(manifest.name, 'Showtime');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.deepEqual(manifest.icons.map(({ src, sizes }) => [src, sizes]), [
    ['/icon-192.png', '192x192'],
    ['/icon-512.png', '512x512'],
  ]);

  for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    const png = await readFile(path.join(webRoot, 'dist', name));
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
