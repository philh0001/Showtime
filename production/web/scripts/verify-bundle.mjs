import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const canonicalApiUrl = 'https://api.showtimetracker.show';
const forbidden = [
  /localhost:3001/i,
  /\bshowtime-api\.[a-z0-9-]+\.workers\.dev\b/i,
  /\bTMDB_(?:READ_ACCESS_TOKEN|API_KEY)\b/,
  /\bapi_key\s*=/i,
];

async function javascriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await javascriptFiles(child));
    else if (entry.isFile() && /\.js$/i.test(entry.name)) files.push(child);
  }
  return files;
}

export async function verifyBundle(directory) {
  const files = await javascriptFiles(directory);
  if (files.length === 0) throw new Error('No generated JavaScript bundle found.');

  let hasCanonicalUrl = false;
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (content.includes(canonicalApiUrl)) hasCanonicalUrl = true;
    if (forbidden.some((pattern) => pattern.test(content))) {
      throw new Error('Found forbidden bundle content.');
    }
  }
  if (!hasCanonicalUrl) throw new Error('Generated bundle is missing the canonical API URL.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  await verifyBundle(join(webRoot, 'dist'));
  console.log('Generated browser bundle selects the canonical API URL and contains no forbidden endpoint or credential markers.');
}
