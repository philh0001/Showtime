import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { createSearchHandler } from './search.mjs';
import { loadLocalTmdbToken } from './tmdb-token.mjs';

const token = loadLocalTmdbToken();
if (!token) {
  console.error('Set TMDB_READ_ACCESS_TOKEN or create local-uat/.env.local from local-uat/.env.example.');
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
