import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
const problems=[];
test.beforeEach(async({page},info)=>{
 page.__errors=[];page.__external=[];
 page.on('pageerror',e=>page.__errors.push(String(e)));
 page.on('request',r=>{const u=r.url();if(/^https?:/.test(u)&&!u.startsWith('http://127.0.0.1:4173/'))page.__external.push(u);});
});
test.afterEach(async({page},info)=>{
 await info.attach('runtime-errors',{body:JSON.stringify(page.__errors),contentType:'application/json'});
 expect(page.__errors,'No uncaught runtime exceptions').toEqual([]);
 expect(page.__external,'No external runtime requests').toEqual([]);
});
async function dismiss(page){
 for(let i=0;i<8;i++){
  let clicked=false;
  for(const id of ['guide-skip','bonus-ok','tg-ok','hammer-no']){
   const button=page.locator('#'+id);
   if(await button.isVisible()){await button.click();clicked=true;}
  }
  await page.waitForTimeout(clicked?180:650);
  if(!clicked&&!await page.locator('#bonus').isVisible()&&!await page.locator('#guide').isVisible())break;
 }
}
async function boot(page,url='/?inspect&count=6&extra=2'){
 await page.goto(url);await expect(page.locator('#logo')).toHaveAttribute('aria-label','brightmath');
 await page.waitForFunction(()=>!!window.__brightmathTest);
 await dismiss(page);
}
async function snap(page,info,name){
 const dir='evidence/screenshots';await mkdir(dir,{recursive:true});
 await page.screenshot({path:`${dir}/${info.project.name}-${name}.png`,fullPage:true});
}
async function state(page){return page.evaluate(()=>{const s=window.__brightmathTest.S;return{screen:s.screen,ready:s.ready,step:s.step,qi:s.qi,solved:s.solved,misses:s.misses,digit:s.problem?.steps[s.step]?.digit,cell:s.problem?.steps[s.step]?.cell};});}
async function nextInput(page){
 await page.waitForFunction(()=>{const s=window.__brightmathTest.S;return s.screen!=='play'||(s.ready&&s.problem?.steps[s.step]);});
 return state(page);
}
async function answer(page,limit=500,pointer=false,stopAfterOne=false){
 const initial=await state(page);
 for(let i=0;i<limit;i++){
  const s=await nextInput(page);
  if(s.screen!=='play'||(stopAfterOne&&s.solved>initial.solved))return;
  if(pointer)await page.locator(`#pad button[data-key="${s.digit}"]`).click();else await page.keyboard.press(s.digit);
  await page.waitForFunction(old=>{const s=window.__brightmathTest.S;return s.step!==old.step||s.qi!==old.qi||s.screen!=='play';},s);
 }
 throw new Error('User-answer loop exceeded bounded input budget');
}
async function bounds(page,selector){
 const r=await page.locator(selector).boundingBox();const v=page.viewportSize();
 expect(r).toBeTruthy();expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.y).toBeGreaterThanOrEqual(-1);
 expect(r.x+r.width).toBeLessThanOrEqual(v.width+1);expect(r.y+r.height).toBeLessThanOrEqual(v.height+1);
}
test('fresh onboarding, original identity, local About and responsive title',async({page},info)=>{
 await page.goto('/?inspect');await expect(page.locator('#guide')).toBeVisible();
 await expect(page.locator('#guide-next')).toBeVisible();await page.locator('#guide-next').click();
 await expect(page.locator('#guide-heading')).toHaveText('じぶんレベル');await snap(page,info,'onboarding');
 await dismiss(page);await expect(page).toHaveTitle(/brightmath/);await bounds(page,'#logo');
 await snap(page,info,'title');
 await page.locator('#brand-about-open').click();await expect(page.locator('#brand-about')).toBeVisible();
 await expect(page.locator('#brand-about')).toContainText('gear_machine');await page.locator('#brand-about-close').click();
 await page.reload();await page.waitForFunction(()=>!!window.__brightmathTest);await expect(page.locator('#guide')).toBeHidden();
});
test('settings persist and do not modify upstream storage',async({page},info)=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('dopa-drill:v1'))localStorage.setItem('dopa-drill:v1','UPSTREAM-SENTINEL');});
 await boot(page);await page.locator('#open-settings').click();
 await page.locator('[data-count="14"]').click();
 await page.locator('[data-toggle="sound"]').click();
 await page.locator('#motion').fill('35');await page.locator('#volume').fill('25');
 await snap(page,info,'settings');await page.locator('#close-settings').click();
 await page.goto('/?inspect');await dismiss(page);await page.locator('#open-settings').click();
 await expect(page.locator('[data-count="14"]')).toHaveAttribute('aria-checked','true');
 await expect(page.locator('[data-toggle="sound"]')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#motion')).toHaveValue('35');await expect(page.locator('#volume')).toHaveValue('25');
 expect(await page.evaluate(()=>localStorage.getItem('dopa-drill:v1'))).toBe('UPSTREAM-SENTINEL');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('brightmath:v1')).settings.count)).toBe(14);
});
for(let grade=1;grade<=6;grade++)test(`grade ${grade}: real keypad or keyboard solves generated arithmetic`,async({page},info)=>{
 await boot(page);await page.locator(`[data-grade="${grade}"]`).click();await expect(page.locator('#screen-play')).toHaveClass(/is-active/);
 await bounds(page,'#pad');await answer(page,220,grade%2===0,true);
 expect((await state(page)).solved).toBeGreaterThanOrEqual(1);
 if(grade===6)await snap(page,info,'grade6');
});
test('complete recorded round, wrong answer, deletion, review and extra result',async({page},info)=>{
 await boot(page);await page.locator('[data-grade="1"]').click();let s=await nextInput(page);
 await page.keyboard.press(String((Number(s.digit)+1)%10));
 await expect.poll(async()=> (await state(page)).misses).toBe(1);
 await page.keyboard.press('Backspace');
 await answer(page);await expect(page.locator('#screen-result')).toHaveClass(/is-active/);
 await expect(page.locator('#r-score')).toHaveText('100');await snap(page,info,'result');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('brightmath:v1')).history.length)).toBeGreaterThan(0);
 await expect(page.locator('#go-review')).toBeVisible();await page.locator('#go-review').click();
 await answer(page);await expect(page.locator('#screen-result')).toHaveClass(/is-active/);
 await page.locator('#go-extra').click();await expect(page.locator('#screen-play')).toHaveClass(/is-active/);
 await expect(page.locator('#screen-final')).toHaveClass(/is-active/,{timeout:15000});await snap(page,info,'extra-result');
});
test('skill tree, trophies, mathematical badge collection and calendar',async({page},info)=>{
 await boot(page);await page.locator('#open-tree').click();await expect(page.locator('#tree .node')).toHaveCount(58);await snap(page,info,'skill-tree');
 await page.locator('#tree-back').click();await dismiss(page);
 await page.locator('#open-trophy').click();await page.locator('[data-f="got"]').click();await expect(page.locator('[data-f="got"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#trophy-back').click();await dismiss(page);await page.locator('#open-collect').click();
 await page.locator('#co-tabs [data-cat="costume"]').click();await expect(page.locator('#co-grid .co-item')).not.toHaveCount(0);await snap(page,info,'collection');
 await page.locator('#collect-back').click();await dismiss(page);const before=await page.locator('#cal-title').textContent();
 await page.locator('#cal-prev').click();await expect(page.locator('#cal-title')).not.toHaveText(before);await page.locator('#cal-next').click();await expect(page.locator('#cal-title')).toHaveText(before);
});
test('cancel reset and confirm reset preserve unrelated application records',async({page})=>{
 await boot(page);await page.evaluate(()=>{localStorage.setItem('dopa-drill:v1','KEEP');localStorage.setItem('inknote:test','KEEP');});
 await page.locator('#open-settings').click();await page.locator('[data-count="14"]').click();await page.locator('#reset-data').click();
 await page.locator('#confirm-no').click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('brightmath:v1')).settings.count)).toBe(14);
 await page.locator('#reset-data').click();await page.locator('#confirm-yes').click();
 if(await page.locator('#confirm-yes').isVisible())await page.locator('#confirm-yes').click();
 await dismiss(page);await page.reload();await page.waitForFunction(()=>!!window.__brightmathTest);
 expect(await page.evaluate(()=>localStorage.getItem('dopa-drill:v1'))).toBe('KEEP');expect(await page.evaluate(()=>localStorage.getItem('inknote:test'))).toBe('KEEP');
 expect(await page.evaluate(()=>window.__brightmathTest.store.settings().count)).toBe(10);
});
test('non-reduced motion tile transport and demo interruption',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await boot(page);await page.locator('[data-grade="1"]').click();
 await answer(page,80,true,true);await snap(page,info,'animated-play');
 await page.keyboard.press('Escape');await page.locator('#confirm-yes').click();await dismiss(page);
 const count=await page.evaluate(()=>window.__brightmathTest.store.load().history.length);
 await page.locator('#open-settings').click();await page.locator('#demo-play').click();await page.waitForTimeout(1200);await page.keyboard.press(' ');
 await expect(page.locator('#screen-title')).toHaveClass(/is-active/);
 expect(await page.evaluate(()=>window.__brightmathTest.store.load().history.length)).toBe(count);
});
test('standalone opens from file URL offline and completes a round',async({page},info)=>{
 const url=pathToFileURL(path.resolve('dist/brightmath.html')).href+'?inspect&count=6';
 await boot(page,url);await page.context().setOffline(true);await page.locator('[data-grade="1"]').click();await answer(page);
 await expect(page.locator('#r-score')).toHaveText('100');await snap(page,info,'standalone-result');
});
test('ordinary launch has no debug state and tolerates blocked storage',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));
 await page.goto('/');await expect(page.locator('#guide')).toBeVisible();await dismiss(page);
 expect(await page.evaluate(()=>typeof window.__brightmathTest)).toBe('undefined');expect(await page.evaluate(()=>typeof window.__dopa)).toBe('undefined');
 await page.locator('[data-grade="1"]').click();await expect(page.locator('#screen-play')).toHaveClass(/is-active/);await bounds(page,'#pad');
});
