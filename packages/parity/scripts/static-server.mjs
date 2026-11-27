/**
 * Minimal static file server for the parity harness (node:http and node:fs only).
 * Usage: node static-server.mjs <dir> <port>
 * Serves <dir> on 127.0.0.1. Anything outside <dir> or not a regular file is a 404.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const [dirArg, portArg] = process.argv.slice(2);
if (!dirArg || !portArg) {
  console.error('parity: usage: node static-server.mjs <dir> <port>');
  process.exit(1);
}
const root = resolve(dirArg);
const port = Number(portArg);

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(root, '.' + pathname);
    // Path traversal guard: the resolved path must stay inside root.
    if (file !== root && !file.startsWith(root + sep)) return notFound(res);
    const type = TYPES[extname(file)];
    if (!type) return notFound(res);
    const info = await stat(file);
    if (!info.isFile()) return notFound(res);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    notFound(res);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`parity: serving ${root} on http://127.0.0.1:${port}`);
});
