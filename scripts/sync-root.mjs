import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const destination = fileURLToPath(new URL('../index.html', import.meta.url));
const html = await readFile(source, 'utf8');
const rootHtml = html.replace(
  /((?:href|src)=\")\.\/(favicon\.svg|styles\.css|brand\.css|app\.js)(\")/g,
  '$1./dist/$2$3',
);

if (process.argv.includes('--check')) {
  const current = await readFile(destination, 'utf8');
  if (current !== rootHtml) {
    throw new Error('Root index.html is out of sync. Run npm run sync:root.');
  }
} else {
  await writeFile(destination, rootHtml);
}
