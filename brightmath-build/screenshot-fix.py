from pathlib import Path
root=Path(__file__).parent
p=root/'e2e/user-journeys.spec.mjs';s=p.read_text();assert 'fullPage:true' in s
s=s.replace('fullPage:true','fullPage:false,timeout:7000')
# Same geometry assertion after the entrance transition, not mid-transform.
old=' const r=await page.locator(selector).boundingBox();const v=page.viewportSize();'
new=''' const v=page.viewportSize();
 await expect.poll(async()=>{
  const box=await page.locator(selector).boundingBox();
  return !!box && box.x>=-1 && box.y>=-1 && box.x+box.width<=v.width+1 && box.y+box.height<=v.height+1;
 },{timeout:4000,message:'Settled control bounds must fit without clipping'}).toBe(true);
 const r=await page.locator(selector).boundingBox();'''
assert old in s;s=s.replace(old,new)
# Trophy rewards can arrive asynchronously after a result screen. Respond using
# the same visible OK button a person uses; never hide overlays or force clicks.
# Register only around the next navigation, so it cannot race explicit dismiss().
helper='''async function clickPastRewards(page, selector) {
 const overlay=page.locator('#trophy-got');
 await page.addLocatorHandler(overlay, async () => {
  console.log('ACKNOWLEDGE_TROPHY',await page.locator('#tg-title').innerText());
  await page.locator('#tg-ok').click();
 });
 try { await page.locator(selector).click({timeout:15000}); }
 finally { await page.removeLocatorHandler(overlay); }
}
'''
marker='async function boot(page,'
assert marker in s;s=s.replace(marker,helper+marker)
s=s.replace("await page.locator('#go-extra').click();","await clickPastRewards(page,'#go-extra');")
s=s.replace("await page.locator('#f-review').click();","await clickPastRewards(page,'#f-review');")
p.write_text(s)
p=root/'playwright.config.mjs';s=p.read_text().replace('fullyParallel:true,workers:3,retries:0','fullyParallel:true,workers:2,retries:0,maxFailures:5')
s=s.replace("trace:'retain-on-failure'","trace:'off'")
p.write_text(s)
print('Bounded captures, settled geometry, and real delayed-reward acknowledgement; all journeys retained')
