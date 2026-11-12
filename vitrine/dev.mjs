import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist', import.meta.url));
const types = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.txt':'text/plain; charset=utf-8',
  '.xml':'application/xml; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.woff2':'font/woff2',
};

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = path === '/' ? 'index.html' : path.slice(1).replace(/\/$/, '');
    const file = resolve(root, extname(relative) ? relative : relative + '.html');
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404, { 'Content-Type':types['.html'] });
    response.end(await readFile(resolve(root, '404.html')));
  }
}).listen(4173, '127.0.0.1', () => console.log('http://127.0.0.1:4173'));
