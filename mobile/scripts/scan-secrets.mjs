import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ignoredDirectories = new Set(['.git', '.expo', 'node_modules', 'test', 'tests', 'fixtures']);
const rules = [
  { name: 'tmdb-variable-assignment', pattern: /\bTMDB(?:_READ_ACCESS_TOKEN)?\s*[:=]\s*["'`][^"'`]{12,}/i },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/i },
  { name: 'jwt-shaped-value', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { name: 'tracked-dev-vars', pattern: /(?:^|[\\/])\.dev\.vars(?:[.]|$)/i },
  { name: 'secret-sentinel', pattern: /(?:test-only-tmdb-secret|private-caller-token|secret-canary)/i },
];

function shouldIgnore(path) {
  return path.split(/[\\/]/).some((part) => ignoredDirectories.has(part))
    || basename(path) === 'scan-secrets.mjs'
    || basename(path) === 'scan-secrets.test.mjs';
}

async function filesUnder(path) {
  let info;
  try {
    info = await stat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (info.isFile()) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    files.push(...await filesUnder(child));
  }
  return files;
}

export async function scanPaths(paths) {
  const files = (await Promise.all(paths.map((path) => filesUnder(resolve(path)))))
    .flat()
    .filter((path) => !shouldIgnore(path));
  const findings = [];
  for (const file of files) {
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      for (const rule of rules) {
        if (rule.pattern.test(line) || (rule.name === 'tracked-dev-vars' && rule.pattern.test(file))) {
          findings.push({ file, rule: rule.name, line: index + 1 });
        }
      }
    }
  }
  return findings;
}

async function trackedFiles(root) {
  const { stdout } = await execFileAsync('git', ['-C', root, 'ls-files']);
  return stdout.split(/\r?\n/).filter(Boolean).map((path) => join(root, path));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const root = resolve('.');
  const requested = args.filter((arg) => !arg.startsWith('--'));
  const paths = [
    ...(args.includes('--tracked') ? await trackedFiles(root) : []),
    ...requested,
  ];
  const findings = await scanPaths(paths);
  for (const finding of findings) {
    console.error(`${relative(root, finding.file)}:${finding.line} ${finding.rule}`);
  }
  process.exitCode = findings.length ? 1 : 0;
}
