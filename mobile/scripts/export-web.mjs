import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const productionApiUrl = 'https://showtime-api.showtime-workers.workers.dev';
const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expoCli = path.join(mobileRoot, 'node_modules', 'expo', 'bin', 'cli');

const result = spawnSync(process.execPath, [expoCli, 'export', '--platform', 'web', '--clear'], {
  cwd: mobileRoot,
  env: {
    ...process.env,
    EXPO_PUBLIC_SEARCH_API_URL: productionApiUrl,
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
