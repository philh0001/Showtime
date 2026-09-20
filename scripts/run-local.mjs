import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function localCommands(platform = process.platform) {
  return [
    { command: process.execPath, args: ['local-uat/api/start.mjs'] },
    { command: platform === 'win32' ? 'npm.cmd' : 'npm', args: ['--prefix', 'app', 'run', 'web'] },
  ];
}

export function runLocal() {
  const children = localCommands().map(({ command, args }) => spawn(command, args, {
    cwd: repositoryRoot,
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
