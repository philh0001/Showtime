import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(repositoryRoot, 'app');

export function localCommands() {
  return [
    {
      command: process.execPath,
      args: [path.join(repositoryRoot, 'local-uat', 'api', 'start.mjs')],
      cwd: repositoryRoot,
    },
    {
      command: process.execPath,
      args: [path.join(appRoot, 'node_modules', 'expo', 'bin', 'cli'), 'start', '--web'],
      cwd: appRoot,
    },
  ];
}

export function runLocal() {
  const children = localCommands().map(({ command, args, cwd }) => spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  }));
  let stopping = false;
  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) if (child.exitCode === null) child.kill();
    process.exitCode = code;
  };
  for (const child of children) {
    child.once('error', () => stop(1));
    child.once('exit', (code) => stop(code ?? 1));
  }
  process.once('SIGINT', () => stop(0));
  process.once('SIGTERM', () => stop(0));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) runLocal();
