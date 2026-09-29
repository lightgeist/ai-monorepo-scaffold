/** Release gates. Negative controls in unit.test.mjs verify that these gates can fail. */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const identityLeaks=text=>[...text.matchAll(/airsup|\bthe[- ]lab\b|__lab\b|__rec\b|(?:\/fonts\/[^'"\s]+)|["']\/lab(?:\/|["'])/gi)].map(m=>m[0]);
export function walk(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(root,e.name)):[join(root,e.name)]);}
export function checkModel(path,bytes,manifest){return hash(bytes)===manifest.files[path];}
export function sourceChecks(root){
  const checks=[];const add=(name,pass,detail='')=>checks.push({name,pass:!!pass,detail});
  const read=p=>readFileSync(join(root,p),'utf8');
  const pkg=JSON.parse(read('package.json')), lock=JSON.parse(read('package-lock.json'));
  add('package identity',pkg.name==='brightlab'&&pkg.version==='1.0.0');
  add('lockfile identity',lock.name===pkg.name&&lock.packages[''].name===pkg.name&&lock.packages[''].version===pkg.version);
  add('document identity',read('index.html').includes('<title>BrightLab |')&&read('index.html').includes('alt="BrightLab"'));
  const files=[...walk(join(root,'src')),join(root,'index.html'),...walk(join(root,'public')).filter(p=>!/(?:credits\.html|LICENSE\.txt|THREE-LICENSE\.txt)$/.test(p))];
  for(const p of files){const hits=identityLeaks(readFileSync(p,'utf8'));add(`identity: ${relative(root,p)}`,hits.length===0,hits.join(', '));}
  add('new wordmark',read('public/wordmark.svg').includes('BrightLab')&&read('public/wordmark.svg').includes('M11 9h8'));
  add('new icon',read('public/favicon.svg').includes('<title>BrightLab</title>')&&read('public/favicon.svg').includes('M11 9h8'));
  const manifest=JSON.parse(read('public/manifest.webmanifest'));
  add('install metadata',manifest.short_name==='BrightLab'&&manifest.scope==='./'&&manifest.start_url==='./');
  add('upstream MIT credit retained',read('LICENSE').includes('Copyright (c) 2026 The lab authors')&&read('NOTICE.md').includes('e21864bda5a614ffae8d0a835518be8e2e571dce'));
  add('runtime license included',read('public/LICENSE.txt')===read('LICENSE')&&read('public/THREE-LICENSE.txt').includes('MIT License'));
  const originals=JSON.parse(read('tests/upstream-sha256.json'));
  const protectedFiles=['src/car/physics.ts','src/fusion/physics.ts','src/line/sim.ts','src/core/noise.ts','src/core/cut.ts','src/core/geometry.ts','src/drone/drone.ts','src/hole/spacetime.ts','src/hole/portal.ts','src/jet/jet.ts','src/pump/turbopump.ts'];
  for(const p of protectedFiles)add(`upstream model preserved: ${p}`,checkModel(p,readFileSync(join(root,p)),originals));
  add('recording hook renamed',read('tools/record.mjs').includes('__brightlabRecorder')&&!read('tools/record.mjs').includes('__rec'));
  add('BrightLab README',read('README.md').startsWith('# BrightLab')&&!read('README.md').includes('airsuphq.github.io'));
  return checks;
}
export function distChecks(root,{base='/'}={}){
  const checks=[];const add=(name,pass,detail='')=>checks.push({name,pass:!!pass,detail});
  const files=walk(root),html=readFileSync(join(root,'index.html'),'utf8');
  for(const p of files){
    const rel=relative(root,p);add(`no font binary: ${rel}`,! /\.(?:woff2?|ttf|otf|eot)$/i.test(rel));
    if(/\.(?:js|css|html|svg|webmanifest)$/.test(p)&&!p.endsWith('credits.html'))add(`bundle identity: ${rel}`,identityLeaks(readFileSync(p,'utf8')).length===0);
  }
  for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    const url=m[1];if(/^https?:|^mailto:/.test(url))continue;
    let asset=url.startsWith(base)?url.slice(base.length):url.replace(/^\.\//,'');
    if(asset===''||asset==='./')asset='index.html';
    add(`asset exists: ${url}`,existsSync(join(root,asset)),asset);
  }
  for(const p of ['LICENSE.txt','THREE-LICENSE.txt','credits.html','favicon.svg','wordmark.svg','manifest.webmanifest'])add(`release asset: ${p}`,existsSync(join(root,p)));
  add('no external runtime dependencies',! /(?:src|href)="https?:\/\//.test(html));
  return checks;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const mode=process.argv[2]||'source',root=resolve(process.argv[3]||(mode==='dist'?'dist':'.'));
  const checks=mode==='dist'?distChecks(root,{base:process.env.BASE||'/'}):sourceChecks(root);
  const result={gate:mode,passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks};
  console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;
}
