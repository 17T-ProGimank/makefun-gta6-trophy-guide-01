// serve.ts — tiny static server for app/ (the GTA 6 trophy tracker).
//
//   node serve.ts            serves app/ at http://localhost:8080
//   node serve.ts --port 9000
//
// Node 22+ standard library only; path-traversal safe.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const args = process.argv.slice(2);
let port = 8080;
const portFlag = args.indexOf('--port');
if (portFlag !== -1) {
  const parsed = Number(args[portFlag + 1]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error('serve.ts: --port expects an integer 1-65535');
    process.exit(1);
  }
  port = parsed;
}

const appRoot = resolve(import.meta.dirname, 'app');

const server = createServer((req, res) => {
  const rawPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const rel = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
  const file = resolve(appRoot, rel);

  // Path-traversal guard: the resolved file must stay inside app/.
  if (file !== appRoot && !file.startsWith(appRoot + '/')) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('403 forbidden\n');
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 not found\n');
    return;
  }

  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`serve.ts: serving app/ at http://localhost:${port}`);
});
