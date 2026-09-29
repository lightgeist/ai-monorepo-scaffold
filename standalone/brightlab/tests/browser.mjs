/** Actual production UI journeys with explicit state oracles. No LLM-generated scores. */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createStaticServer} from '../tools/serve.mjs';
import assert from 'node:assert/strict';
const out=resolve(process.env.EVIDENCE_DIR||'evidence');mkdirSync(out,{recursive:true});
const PHASE=process.env.BROWSER_PHASE||'all';
if(!['all','desktop','touch','subpath'].includes(PHASE))throw new Error('Unknown browser phase');
const checks=[],errors=[],external=[];let page,context,browser;
const add=(name,pass,detail='')=>{checks.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}${detail?' - '+detail:''}`);writeFileSync(resolve(out,'browser-progress.json'),JSON.stringify(checks,null,2));};
const guard=async(name,fn)=>{try{const r=await fn();add(name,true,r===undefined?'':r);}catch(e){add(name,false,e.message);try{await page?.screenshot({path:resolve(out,`failure-${checks.length}.png`),timeout:10000});}catch{} if(checks.filter(c=>!c.pass).length>=8)throw new Error('Stopping after eight failed checks; inspect browser-progress.json.');}};
const hosts=new Set(),servers=[];
async function server(root,base='/'){const s=createStaticServer(root,{base});await new Promise(r=>s.listen(0,'127.0.0.1',r));servers.push(s);const host=`http://127.0.0.1:${s.address().port}`;hosts.add(new URL(host).host);return host+base;}
function observe(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(/^https?:/.test(r.url())&&!hosts.has(new URL(r.url()).host))external.push(r.url());});}
async function boot(url,opts={}){
 if(context)await context.close();context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,...opts});page=await context.newPage();page.setDefaultTimeout(60000);observe(page);
 await page.addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async v=>window.__copied.push(v)}});});
 const started=Date.now();await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__brightlab&&window.__brightlabRecorder,null,{timeout:180000});await page.locator('#loader').waitFor({state:'detached',timeout:180000});await page.evaluate(()=>document.querySelector('#gl').getContext('webgl2').finish());return Date.now()-started;
}
async function tick(seconds=1){await page.evaluate(s=>{for(let t=0;t<s;t+=1/30)window.__brightlabRecorder.frame(1/30,false);window.__brightlabRecorder.frame(1/30,true);},seconds);}
async function shot(name){const file=resolve(out,`${name}.png`);await page.evaluate(()=>document.querySelector('#gl').getContext('webgl2').finish());await page.screenshot({path:file,timeout:90000});return file;}
async function imageSignal(buf){return page.evaluate(async b64=>{
 const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=80;c.height=60;const g=c.getContext('2d');
 g.drawImage(im,im.width*.3,im.height*.3,im.width*.4,im.height*.35,0,0,80,60);const px=g.getImageData(0,0,80,60).data;const colors=new Set();let bright=0;
 for(let i=0;i<px.length;i+=4){colors.add(`${px[i]>>3},${px[i+1]>>3},${px[i+2]>>3}`);if(px[i]+px[i+1]+px[i+2]>36)bright++;}
 return {colors:colors.size,brightFraction:bright/(80*60)};
 },buf.toString('base64'));}
const stateKey={follow:['engine','follow'],view:['engine','view'],alt:['engine','alt','number'],pfollow:['pump','follow'],pview:['pump','view'],pmode:['pump','mode'],ffollow:['fusion','follow'],fview:['fusion','view'],fmode:['fusion','mode'],cfollow:['car','follow'],cview:['car','view'],cmode:['car','mode'],cheight:['car','height'],mfollow:['motor','follow'],mview:['motor','view'],mmode:['motor','mode'],rfollow:['robot','follow'],rview:['robot','view'],rmode:['robot','mode'],hview:['hole','view'],hmode:['hole','mode'],jfollow:['jet','follow'],jview:['jet','view'],jab:['jet','ab','bool'],dfollow:['drone','follow'],dview:['drone','view'],dmode:['drone','mode'],dpayload:['drone','payload','bool'],f1follow:['f1','follow'],f1view:['f1','view'],f1mode:['f1','mode'],robots:['line','robots','number'],buffer:['line','buffer','number'],breakdowns:['line','breakdowns','bool']};
const sliders={temp:['fusion','temp',1],throttle:['engine','throttle',.01],speed:['pump','speed',.01],framespeed:['line','frameSpeed',.01],cspeed:['car','speed',1],rpm:['motor','rpm',1],payload:['robot','payload',1],hmass:['hole','mass',.01],jthrottle:['jet','throttle',.01],f1speed:['f1','speed',1]};
let environment={};
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const root=await server(resolve('dist'));
 if(PHASE==='all'||PHASE==='desktop'){
 await guard('production build boots in Chromium',async()=>{const ms=await boot(root+'?ex=fusion&fixed=1&q=low');return `${ms} ms including renderer completion and loader removal`;});
 if(!page||!await page.evaluate(()=>!!window.__brightlab))throw new Error('Cannot continue UI journeys: application did not boot');
 environment=await page.evaluate(()=>{const gl=document.querySelector('#gl').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};});
 await guard('BrightLab title, logo and parent are rendered',async()=>{assert.match(await page.title(),/BrightLab/);assert.equal(await page.locator('.brand img').getAttribute('alt'),'BrightLab');assert.equal(await page.locator('.brand-parent').innerText(),'by BrightClass');assert(await page.locator('.brand img').evaluate(im=>im.complete&&im.naturalWidth>0));});
 for(const ex of ['fusion','engine','pump','line','car','motor','robot','hole','jet','f1','drone']){
  await guard(`${ex}: real navigation and branded browser title`,async()=>{await page.locator(`#exhibits button[data-ex="${ex}"]`).click();assert.equal(await page.evaluate(()=>window.__brightlab.S.exhibit),ex);assert.match(await page.title(),/BrightLab/);assert.equal(new URL(page.url()).searchParams.get('ex'),ex);assert(await page.locator(`#panel-${ex}`).isVisible());});
  await tick(2.8);
  await guard(`${ex}: rendered scene is not blank`,async()=>{const file=await shot(`desktop-${ex}`);const signal=await imageSignal(readFileSync(file));assert(signal.colors>30&&signal.brightFraction>.04,JSON.stringify(signal));return JSON.stringify(signal);});
  const buttons=await page.locator(`#panel-${ex} .seg button`).evaluateAll(bs=>bs.map(b=>({key:b.closest('.seg').dataset.key,value:b.dataset.v})));
  for(const {key,value}of buttons)await guard(`${ex}: ${key}=${value}`,async()=>{
   const map=stateKey[key];assert(map,`No independent expected-state mapping for ${key}`);
   await page.locator(`#panel-${ex} .seg[data-key="${key}"] button[data-v="${value}"]`).click();
   const actual=await page.evaluate(([a,b])=>window.__brightlab.S[a][b],map);
   const expected=map[2]==='number'?Number(value):map[2]==='bool'?value==='on':value;assert.equal(actual,expected);
   assert(await page.locator(`#panel-${ex} .seg[data-key="${key}"] button[data-v="${value}"]`).evaluate(b=>b.classList.contains('on')));
  });
  const ranges=await page.locator(`#panel-${ex} input[type="range"]`).evaluateAll(ins=>ins.map(x=>({id:x.id,min:Number(x.min),max:Number(x.max)})));
  for(const r of ranges)for(const value of [r.min,r.max])await guard(`${ex}: slider ${r.id}=${value}`,async()=>{
   const map=sliders[r.id];assert(map,`No expected-state mapping for ${r.id}`);const input=page.locator('#'+r.id);await input.focus();await input.press(value===r.min?'Home':'End');
   const actual=await page.evaluate(([a,b])=>window.__brightlab.S[a][b],map);assert(Math.abs(actual-value*map[2])<1e-8,`${actual} vs ${value*map[2]}`);
  });
  await guard(`${ex}: help opens and closes`,async()=>{await page.locator(`#panel-${ex} .helpbtn`).click();assert(await page.locator('#helpbox').isVisible());assert.match(await page.locator('#helpbox').innerText(),/BrightLab/);await page.locator('#help-close').click();assert(!await page.locator('#helpbox').isVisible());});
 }
 await guard('pump strobe toggles actual state',async()=>{await page.locator('#exhibits button[data-ex="pump"]').click();const before=await page.evaluate(()=>window.__brightlab.S.pump.strobe);await page.locator('#strobe').click();assert.equal(await page.evaluate(()=>window.__brightlab.S.pump.strobe),!before);});
 await guard('share copies current exhibit and strips debug flags',async()=>{await page.locator('#share').click();const copies=await page.evaluate(()=>window.__copied);const u=new URL(copies.at(-1));assert.equal(u.host,new URL(root).host);assert.equal(u.search,'?ex=pump');assert.equal(u.hash,'');});
 await guard('keyboard changes flow without a pointer',async()=>{await page.locator('#exhibits button[data-ex="motor"]').click();await page.locator('#gl').focus();await page.keyboard.press('2');assert.equal(await page.evaluate(()=>window.__brightlab.S.motor.follow),'current');});
 await guard('camera orbit responds to a drag',async()=>{await tick(3);const before=await page.evaluate(()=>window.__brightlab.camera.position.toArray());await page.mouse.move(780,490);await page.mouse.down();await page.mouse.move(850,525,{steps:8});await page.mouse.up();await tick(.5);assert.notDeepEqual(await page.evaluate(()=>window.__brightlab.camera.position.toArray()),before);});
 await guard('tour button starts and pointer cancels a tour',async()=>{await page.locator('#panel-motor .tour').click();await tick(.3);assert.equal(await page.evaluate(()=>window.__brightlabRecorder.frame(0,false).active),true);await page.mouse.click(800,500);assert.equal(await page.evaluate(()=>window.__brightlabRecorder.frame(0,false).active),false);});
 // Fixed 30 Hz simulation evaluates every scripted event, not just a few checkpoints.
 for(const tour of ['fusion','main','pump','line','car','motor','robot','hole','jet','f1','drone','hall','grand'])await guard(`tour ${tour}: completes with BrightLab end card`,async()=>{
  const r=await page.evaluate(tour=>{const rec=window.__brightlabRecorder;const duration=rec.start(tour);let seen=false,active=true,i=0;
   for(;i<Math.ceil((duration+1)*30);i++){active=rec.frame(1/30,false).active;const card=document.querySelector('#endcard');if(card&&Number(card.style.opacity)>.05&&card.textContent.includes('BrightLab')&&card.textContent.includes('BrightClass'))seen=true;}
   rec.frame(1/30,true);return {duration,seen,active,steps:i};
  },tour);assert(Number.isFinite(r.duration)&&r.duration>0);assert(r.seen,'No branded end card observed');assert.equal(r.active,false);return JSON.stringify(r);
 });
 await guard('all-tour final frame captured',async()=>{await shot('tour-final');});
 await guard('blank-scene negative control rejected',async()=>{const b64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;return c.toDataURL().split(',')[1];});const s=await imageSignal(Buffer.from(b64,'base64'));assert(!(s.colors>30&&s.brightFraction>.04));});
 await guard('static deployment works offline after initial load',async()=>{await context.setOffline(true);await page.locator('#exhibits button[data-ex="drone"]').click();await tick(1);assert.equal(await page.evaluate(()=>window.__brightlab.S.exhibit),'drone');await context.setOffline(false);});
 }
 if(PHASE==='all'||PHASE==='touch'){
 await guard('touchscreen layout, tap navigation and controls',async()=>{
  await boot(root+'?ex=motor&fixed=1&q=low',{viewport:{width:1280,height:800},hasTouch:true});await page.locator('#exhibits button[data-ex="drone"]').tap();await tick(3);await page.locator('#panel-drone .seg[data-key="dview"] button[data-v="cut"]').tap();assert.equal(await page.evaluate(()=>window.__brightlab.S.drone.view),'cut');assert(await page.locator('.brand img').isVisible());await shot('touchscreen-drone');
 });
 await guard('phone layout retains controls without horizontal overflow',async()=>{
  await page.setViewportSize({width:390,height:844});await page.locator('#exhibits button[data-ex="motor"]').tap();
  await page.locator('#panel-motor .seg[data-key="mview"] button[data-v="exploded"]').tap();assert.equal(await page.evaluate(()=>window.__brightlab.S.motor.view),'exploded');await tick(2);await shot('phone-motor');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const parent=await page.locator('.brand-parent').boundingBox(),readout=await page.locator('#readout').boundingBox();assert(parent&&readout&&parent.y+parent.height<=readout.y,'Phone readout overlaps BrightClass identity');
 });
 }
 if(PHASE==='all'||PHASE==='subpath'){
 if(!process.env.SUBPATH_DIST)throw new Error('Subpath browser verification requires SUBPATH_DIST');
 await guard('subpath build boots, shares and survives reload',async()=>{
  const sub=await server(resolve(process.env.SUBPATH_DIST),'/school/brightlab/');await boot(sub+'?ex=motor&fixed=1&q=low&temp=NaN&rpm=-999&shot=missing&px=Infinity&rs=0');const initial=await page.evaluate(()=>window.__brightlab.S);assert.equal(initial.motor.rpm,0);assert.equal(initial.fusion.temp,150);await page.locator('#exhibits button[data-ex="drone"]').click();await page.locator('#share').click();const u=await page.evaluate(()=>window.__copied.at(-1));assert.equal(new URL(u).pathname,'/school/brightlab/');assert.equal(new URL(u).search,'?ex=drone');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__brightlab,null,{timeout:180000});assert.equal(await page.evaluate(()=>window.__brightlab.S.exhibit),'drone');await page.waitForTimeout(1100);await shot('subpath-drone');
 });
 }
 if(PHASE==='all'||PHASE==='desktop'){
 await guard('no JavaScript displays BrightLab fallback',async()=>{const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.goto(root);assert.match(await p.locator('noscript').innerText(),/BrightLab.*JavaScript/);await c.close();});
 await guard('no WebGL displays actionable BrightLab error',async()=>{const c=await browser.newContext();const p=await c.newPage();await p.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});await p.goto(root);await p.waitForFunction(()=>document.querySelector('#loadtext')?.textContent.includes('WebGL 2'));assert.match(await p.title(),/BrightLab/);await p.screenshot({path:resolve(out,'no-webgl.png')});await c.close();});
 }
 await guard('all observed production sessions have no page/console errors',async()=>assert.deepEqual(errors,[]));
 await guard('runtime makes no external network requests',async()=>assert.deepEqual(external,[]));
}catch(e){add('suite execution',false,e.stack||e.message);}finally{
 if(browser)await browser.close();for(const s of servers){s.closeAllConnections();s.close();}
 const report={kind:'executed-browser-evaluation',phase:PHASE,at:new Date().toISOString(),environment,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks,errors,external};
 writeFileSync(resolve(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
