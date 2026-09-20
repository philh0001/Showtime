import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const productionApiUrl = 'https://api.showtimetracker.show';
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(webRoot, '..', '..');
const appRoot = path.join(repositoryRoot, 'app');
const outputRoot = path.join(webRoot, 'dist');
const expoCli = path.join(appRoot, 'node_modules', 'expo', 'bin', 'cli');

const result = spawnSync(process.execPath, [
  expoCli,
  'export',
  '--platform', 'web',
  '--clear',
  '--output-dir', outputRoot,
], {
  cwd: appRoot,
  env: { ...process.env, EXPO_PUBLIC_SEARCH_API_URL: productionApiUrl },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
