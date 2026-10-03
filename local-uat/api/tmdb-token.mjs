import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const localEnvFile = fileURLToPath(new URL('../.env.local', import.meta.url));

export function loadLocalTmdbToken(envFile = localEnvFile) {
  const supplied = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (supplied) return supplied;
  try {
    loadEnvFile(envFile);
  } catch {
    return null;
  }
  return process.env.TMDB_READ_ACCESS_TOKEN?.trim() || null;
}
