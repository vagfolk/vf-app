// Local-only server for checking the static cashier shell without publishing.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../public/offline-cash');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/test-client.js', ['test-client.js', 'text/javascript; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
]);

http.createServer(async (request, response) => {
  const entry = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!entry) { response.writeHead(404); response.end(); return; }
  const [file, type] = entry;
  try {
    response.writeHead(200, { 'Content-Type':type,
      'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    response.end(await readFile(join(root, file)));
  } catch (_) { response.writeHead(500); response.end(); }
}).listen(3187, '127.0.0.1', () => {
  console.log('Offline shell test: http://127.0.0.1:3187/');
});
