/** BrightLab fixed-step tour recorder. Requires ffmpeg and Playwright Chromium.
 * npm run record -- motor films/brightlab-motor.mp4 30 http://127.0.0.1:5173/
 * Optional fifth argument limits duration for a smoke clip. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {once} from 'node:events';
const [tour='grand',out=`films/brightlab-${tour}.mp4`,fpsText='60',address='http://127.0.0.1:5173/',limitText]=process.argv.slice(2);
const tours=['fusion','main','pump','line','car','motor','robot','hole','jet','f1','drone','hall','grand'];
const fps=Number(fpsText),limit=limitText===undefined?Infinity:Number(limitText),url=new URL(address);
if(!tours.includes(tour))throw new Error('Unknown BrightLab tour');
if(!Number.isInteger(fps)||fps<1||fps>60)throw new Error('FPS must be an integer from 1 to 60');
if(!(limit>0))throw new Error('Duration limit must be positive');
if(!['http:','https:'].includes(url.protocol))throw new Error('Recorder requires an HTTP(S) URL');
url.search='';url.searchParams.set('rec','1');url.searchParams.set('rs','1');url.searchParams.set('ex',tour==='main'?'engine':tour);
mkdirSync(dirname(out),{recursive:true});
let browser,ff;const errors=[];
try {
 browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url.href);await page.waitForFunction(()=>window.__brightlabRecorder,null,{timeout:180000});
 const duration=Math.min(limit,await page.evaluate(t=>window.__brightlabRecorder.start(t),tour));
 ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',out],{stdio:['pipe','ignore','inherit']});
 const completion=once(ff,'close');completion.catch(()=>{});let encoderError;
 ff.on('error',e=>encoderError=e);ff.stdin.on('error',e=>encoderError=e);
 for(let i=0;i<Math.ceil(duration*fps);i++){
  if(encoderError)throw encoderError;if(ff.exitCode!==null)throw new Error(`Encoder exited early: ${ff.exitCode}`);
  await page.evaluate(dt=>window.__brightlabRecorder.frame(dt),1/fps);
  const shot=await page.screenshot({type:'jpeg',quality:95});
  if(!ff.stdin.write(shot))await Promise.race([once(ff.stdin,'drain'),completion.then(()=>{throw new Error('Encoder stopped before input completed');})]);
 }
 ff.stdin.end();const [code]=await completion;if(code!==0)throw new Error(`ffmpeg exited ${code}`);
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`BrightLab video written: ${out}`);
}finally{if(ff&&ff.exitCode===null)ff.kill();if(browser)await browser.close();}
