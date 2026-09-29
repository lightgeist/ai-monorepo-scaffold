from pathlib import Path
root=Path(__file__).parent
p=root/'e2e/user-journeys.spec.mjs';s=p.read_text();assert 'fullPage:true' in s
s=s.replace('fullPage:true','fullPage:false,timeout:7000')
# Assert the same one-pixel bounds after the visible transition has settled,
# rather than measuring the intermediate entrance transform in faster engines.
old=' const r=await page.locator(selector).boundingBox();const v=page.viewportSize();'
new=''' const v=page.viewportSize();
 await expect.poll(async()=>{
  const box=await page.locator(selector).boundingBox();
  return !!box && box.x>=-1 && box.y>=-1 && box.x+box.width<=v.width+1 && box.y+box.height<=v.height+1;
 },{timeout:4000,message:'Settled control bounds must fit without clipping'}).toBe(true);
 const r=await page.locator(selector).boundingBox();'''
assert old in s;s=s.replace(old,new);p.write_text(s)
p=root/'playwright.config.mjs';s=p.read_text().replace('fullyParallel:true,workers:3,retries:0','fullyParallel:true,workers:2,retries:0,maxFailures:5')
# Per-frame SVG snapshots generated 1.45 GB in a canceled run. Keep native
# interactions, failure screenshots and JSON outcomes without recorder pressure.
s=s.replace("trace:'retain-on-failure'","trace:'off'")
p.write_text(s)
print('Bounded viewport captures and settled geometry assertions; all journeys retained')
