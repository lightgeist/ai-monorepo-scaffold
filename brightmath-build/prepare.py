from pathlib import Path
base=Path(__file__).parent
p=base/'bright-tile.js';s=p.read_text().replace('this.sq=new Spring(1);','this.lean=new Spring(0);this.tilt=new Spring(0);this.sq=new Spring(1);').replace("h.mode==='free'&&!h.carry?.hidden?.valueOf()?0.8:h.raise?0.5:0","h.mode==='free'?0.8:h.raise?0.5:0").replace('on?.7:0','on ? 0.7 : 0');p.write_text(s)
p=base/'rebrand.py';s=p.read_text();s=s.replace('assert not changed,changed', '''for name in changed:
 original_text=subprocess.check_output(['git','-C',str(root),'show','HEAD:app/js/'+name],text=True)
 assert (root/'app/js'/name).read_text()==original_text.replace('ドパ','ひかり'),name
 assert name=='trophies.js','Unexpected change outside display labels: '+name''').replace("'core_modules_unchanged':len(core)","'core_modules_unchanged':len(core)-len(changed)")
p.write_text(s)
p=base/'e2e/user-journeys.spec.mjs';s=p.read_text();s=s.replace("await page.locator('#motion').fill('35');await page.locator('#volume').fill('25');",'''for (const [id,value] of [['motion',35],['volume',25]]) {
 await page.locator('#'+id).focus();await page.keyboard.press('Home');
 for(let i=0;i<value;i++)await page.keyboard.press('ArrowRight');
}''')
a="""  await expect(page.locator('#go-review')).toBeVisible();await page.locator('#go-review').click();
 await answer(page);await expect(page.locator('#screen-result')).toHaveClass(/is-active/);
 await page.locator('#go-extra').click();await expect(page.locator('#screen-play')).toHaveClass(/is-active/);
 await expect(page.locator('#screen-final')).toHaveClass(/is-active/,{timeout:15000});await snap(page,info,'extra-result');""".lstrip()
b="""await page.locator('#go-extra').click();await expect(page.locator('#screen-play')).toHaveClass(/is-active/);
 await expect(page.locator('#screen-final')).toHaveClass(/is-active/,{timeout:15000});await snap(page,info,'extra-result');
 await expect(page.locator('#f-review')).toBeVisible();await page.locator('#f-review').click();
 await answer(page);await expect(page.locator('#screen-result')).toHaveClass(/is-active/);
 await expect(page.locator('#go-extra')).toBeHidden();"""
assert a in s,'Review/extra test block must match the reviewed source';p.write_text(s.replace(a,b))
print('Applied explicit display-label, presentation-contract and native browser-control corrections')
