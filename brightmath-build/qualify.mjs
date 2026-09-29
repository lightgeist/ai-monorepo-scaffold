import assert from 'node:assert/strict';
import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const checks=[];const check=(name,value)=>{checks.push({name,passed:!!value});assert.ok(value,name);};
async function walk(root){const out=[];for(const entry of await readdir(root,{withFileTypes:true})){const p=path.join(root,entry.name);out.push(...entry.isDirectory()?await walk(p):[p]);}return out;}
try{
 const files=await walk('dist');
 check('No bundled font files',files.every(p=>!(/\.(woff2?|ttf|otf|ttc)$/i.test(p))));
 check('No excluded character files',files.every(p=>!p.includes('dopakichi')));
 const html=await readFile('dist/site/index.html','utf8'),single=await readFile('dist/brightmath.html','utf8');
 check('Independent title and accessible wordmark',html.includes('<title>brightmath')&&html.includes('aria-label="brightmath"'));
 check('Original logo replaced entirely',!html.includes('logo-burst')&&!html.includes('logo-ribbon'));
 check('Browser zoom allowed',!html.includes('user-scalable=no'));
 check('Standalone has no module or stylesheet requests',!single.includes('<script type="module"')&&!single.includes('rel="stylesheet"'));
 check('Standalone contains full attribution',single.includes('Copyright (c) 2026 gear_machine'));
 const main=await readFile('dist/site/js/main.js','utf8'),store=await readFile('dist/site/js/store.js','utf8');
 check('No old runtime integration or mutable global',!main.includes('__dopa')&&!main.includes('dopakichi'));
 check('Diagnostics are opt-in',main.includes('if (params.has("inspect")) window.__brightmathTest'));
 check('Independent persistence key',store.includes("'brightmath:v1'")&&!store.includes('dopa-drill'));
 check('Independent reset namespace',store.includes("startsWith('brightmath')"));
 check('No network APIs in runtime',!(await Promise.all(files.filter(p=>p.endsWith('.js')).map(p=>readFile(p,'utf8')))).some(s=>/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(s)));
 check('Server security header rejects runtime network', (await readFile('dist/site/_headers','utf8')).includes("connect-src 'none'"));
 const preserve=JSON.parse(await readFile('provenance/core-preservation.json','utf8'));
 check('Only trophy display labels changed among core modules',Object.keys(preserve.changed).every(k=>k==='trophies.js'));
 check('Readme discloses Japanese edition', (await readFile('README.md','utf8')).includes('Japanese'));
 check('New tile renderer has required guide springs', (await readFile('dist/site/js/bright-tile.js','utf8')).includes('this.lean=new Spring'));
 console.log('STATIC_QUALIFICATION',JSON.stringify(checks));
}finally{await mkdir('evidence',{recursive:true});await writeFile('evidence/static-checks.json',JSON.stringify({passed:checks.length===16&&checks.every(c=>c.passed),checks},null,2));}
