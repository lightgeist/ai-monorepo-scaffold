/** Verify normal playback independently of recorder stepping. This is a liveness check, not an FPS benchmark. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createStaticServer} from '../tools/serve.mjs';
const checks=[],errors=[];let browser;
mkdirSync('evidence',{recursive:true});
const server=createStaticServer('dist');await new Promise(r=>server.listen(0,'127.0.0.1',r));
const root=`http://127.0.0.1:${server.address().port}/`;
const check=async(name,fn)=>{try{const detail=await fn();checks.push({name,pass:true,detail});}catch(e){checks.push({name,pass:false,detail:e.message});}console.log(checks.at(-1));};
async function waitForProgress(page,before,{frozen=false,timeout=90000}={}){
 assert(Number.isFinite(before),'Invalid renderer frame counter');
 await page.waitForFunction(({before,frozen})=>(frozen?before:window.__brightlab.pipeline.renderer.info.render.frame)>before,{before,frozen},{timeout,polling:250});
}
try{
 browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:960,height:600}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(root+'?ex=motor&px=300000');await page.bringToFront();
 await page.waitForFunction(()=>window.__brightlab,null,{timeout:180000});
 await page.locator('#loader').waitFor({state:'detached',timeout:180000});
 await page.evaluate(()=>document.querySelector('#gl').getContext('webgl2').finish());
 await check('normal startup has no recorder or legacy globals',async()=>assert.deepEqual(await page.evaluate(()=>[typeof window.__brightlabRecorder,typeof window.__lab,typeof window.__rec]),['undefined','undefined','undefined']));
 await check('normal animation advances rendered frames without test stepping',async()=>{
  const before=await page.evaluate(()=>window.__brightlab.pipeline.renderer.info.render.frame),started=Date.now();
  await waitForProgress(page,before);
  const after=await page.evaluate(()=>window.__brightlab.pipeline.renderer.info.render.frame);assert(after>before,`${before} -> ${after}`);return {before,after,observedProgressMs:Date.now()-started};
 });
 await check('frame-progress watchdog rejects a frozen counter',async()=>{
  const before=await page.evaluate(()=>window.__brightlab.pipeline.renderer.info.render.frame);
  await assert.rejects(waitForProgress(page,before,{frozen:true,timeout:500}),error=>error.name==='TimeoutError');
 });
 await check('controls work with the normal animation loop',async()=>{
  await page.locator('#panel-motor .seg[data-key="mview"] button[data-v="exploded"]').click();assert.equal(await page.evaluate(()=>window.__brightlab.S.motor.view),'exploded');
  await page.waitForTimeout(1500);await page.screenshot({path:'evidence/normal-animation-motor.png',timeout:90000});
 });
 await check('normal runtime produces no page or console errors',async()=>assert.deepEqual(errors,[]));
}catch(e){checks.push({name:'runtime suite',pass:false,detail:e.stack});}
finally{if(browser)await browser.close();server.closeAllConnections();server.close();}
const result={kind:'normal-animation-runtime',passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks,errors};
writeFileSync('evidence/runtime-report.json',JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;
