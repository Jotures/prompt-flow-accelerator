import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = new URL('../index.html', import.meta.url);
createServer(async (req, res) => {
  if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404); res.end(); return; }
  try { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(await readFile(html)); }
  catch { res.writeHead(500); res.end('Ejecuta npm run build.'); }
}).listen(4173, '127.0.0.1', () => console.log('PFA: http://127.0.0.1:4173'));
