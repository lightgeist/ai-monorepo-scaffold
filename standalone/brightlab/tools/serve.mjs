/** Dependency-free, loopback-only server for the prebuilt BrightLab distribution. */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.png':'image/png','.mp4':'video/mp4'};
export function createStaticServer(root, {base='/'}={}) {
  root=resolve(root);
  if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('base must start and end with /');
  return createServer(async(req,res)=>{
    const send=(code,body,type='text/plain; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);};
    if (!['GET','HEAD'].includes(req.method)) return send(405,'Method not allowed');
    let pathname;
    try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch{return send(400,'Bad request');}
    if (!pathname.startsWith(base)) return send(404,'Not found');
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(p=>p==='..'||p==='.'||p.startsWith('.'))) return send(400,'Bad path');
    let file=resolve(root, pathname.slice(base.length)||'index.html');
    if (file!==root && !file.startsWith(root+sep)) return send(403,'Forbidden');
    try {
      if((await stat(file)).isDirectory()) file=resolve(file,'index.html');
      const bytes=await readFile(file); send(200,bytes,MIME[extname(file)]||'application/octet-stream');
    } catch {send(404,'Not found');}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||4173);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT must be 1-65535');
  const root=resolve(process.argv[2]||fileURLToPath(new URL('../dist',import.meta.url)));
  await stat(resolve(root,'index.html')).catch(()=>{throw new Error('BrightLab build not found. Run npm run build, or use the prebuilt package.');});
  createStaticServer(root,{base:process.env.BASE||'/'}).listen(port,'127.0.0.1',()=>console.log(`BrightLab: http://127.0.0.1:${port}${process.env.BASE||'/'}\nPress Ctrl+C to stop.`));
}
