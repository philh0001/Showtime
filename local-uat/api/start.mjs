import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createSearchHandler } from './search.mjs';

try {
  loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch {
  console.error('Create local-uat/.env.local from local-uat/.env.example first.');
  process.exit(1);
}
const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('Add TMDB_READ_ACCESS_TOKEN to local-uat/.env.local.');
  process.exit(1);
}

// Development only: reachable by your iPhone on the same private network.
const server = createServer(createSearchHandler({ token }));
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 3001 is already in use.' : 'Search server could not start.');
  process.exitCode = 1;
});
server.listen(3001, '0.0.0.0', () => {
  console.log('Local search server ready on port 3001. Keep this terminal open.');
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) console.log(`Network address: http://${entry.address}:3001`);
    }
  }
});
