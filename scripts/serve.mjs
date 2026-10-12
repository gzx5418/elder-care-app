import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('frontend');
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json' };
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + '\\') && !file.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file); res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}); res.end(body);
  } catch { res.writeHead(404); res.end('文件未找到'); }
}).listen(8080,'127.0.0.1',() => console.log('预览：http://127.0.0.1:8080'));
