"""Apply evidence-driven fixes to the rebrand and verifier; fail if source anchors drift."""
from pathlib import Path
import re, sys, json
R=Path(sys.argv[1])
def patch(p,old,new):
 s=p.read_text(); assert old in s,(p,old[:80]);p.write_text(s.replace(old,new))
# The pump inherited no help/tour affordance, unlike the other ten exhibit panels.
p=R/'index.html';s=p.read_text()
tour=re.search(r'<button class="icon tour".*?</button>',s)[0]
help_button=re.search(r'<button class="icon helpbtn".*?</button>',s)[0]
strobe=re.search(r'<button class="icon toggle" id="strobe".*?</button>',s)[0]
s=s.replace(strobe,strobe+'\n            '+tour+'\n            '+help_button);p.write_text(s)
patch(R/'src/main.ts','This needs WebGL 2. Try a recent Chrome, Safari or Firefox.','BrightLab needs WebGL 2. Try a recent Chrome, Safari or Firefox.')
# Preserve test oracles. Allow CPU WebGL to finish queued rendering before interaction.
p=R/'tests/browser.mjs'
patch(p,"const checks=[],errors=[],external=[];let page,context,browser;","const PHASE=process.env.BROWSER_PHASE||'all';\nif(!['all','desktop','touch','subpath'].includes(PHASE))throw new Error('Unknown browser phase');\nconst checks=[],errors=[],external=[];let page,context,browser;")
patch(p,'page.setDefaultTimeout(12000)','page.setDefaultTimeout(60000)')
patch(p,"}catch{}}};","}catch{} if(checks.filter(c=>!c.pass).length>=8)throw new Error('Stopping after eight failed checks; inspect browser-progress.json.');}};")
patch(p,"await page.waitForTimeout(1100);return Date.now()-started;","await page.locator('#loader').waitFor({state:'detached',timeout:180000});await page.evaluate(()=>document.querySelector('#gl').getContext('webgl2').finish());return Date.now()-started;")
patch(p,"await page.screenshot({path:file});return file;","await page.evaluate(()=>document.querySelector('#gl').getContext('webgl2').finish());await page.screenshot({path:file,timeout:90000});return file;")
patch(p," await guard('production build boots in Chromium'"," if(PHASE==='all'||PHASE==='desktop'){\n await guard('production build boots in Chromium'")
patch(p,'including 1.1 s loader removal wait','including renderer completion and loader removal')
patch(p," await guard('touchscreen layout, tap navigation and controls'"," }\n if(PHASE==='all'||PHASE==='touch'){\n await guard('touchscreen layout, tap navigation and controls'")
# Test the responsive phone layout by resizing the already-loaded touchscreen session.
patch(p,"await boot(root+'?ex=motor&fixed=1&q=low',{viewport:{width:390,height:844},hasTouch:true,isMobile:true});","await page.setViewportSize({width:390,height:844});await page.locator('#exhibits button[data-ex=\"motor\"]').tap();")
patch(p," if(process.env.SUBPATH_DIST)await guard('subpath build boots, shares and survives reload'"," }\n if(PHASE==='all'||PHASE==='subpath'){\n if(!process.env.SUBPATH_DIST)throw new Error('Subpath browser verification requires SUBPATH_DIST');\n await guard('subpath build boots, shares and survives reload'")
# Malformed inputs exercise a real boot rather than another redundant cold session.
patch(p,"await boot(sub+'?ex=motor&fixed=1&q=low');","await boot(sub+'?ex=motor&fixed=1&q=low&temp=NaN&rpm=-999&shot=missing&px=Infinity&rs=0');const initial=await page.evaluate(()=>window.__brightlab.S);assert.equal(initial.motor.rpm,0);assert.equal(initial.fusion.temp,150);")
p=R/'tests/browser.mjs';s=p.read_text();start=s.index(" await guard('malformed URL parameters do not poison runtime'");end=s.index(" await guard('no JavaScript displays BrightLab fallback'",start)
s=s[:start]+" }\n if(PHASE==='all'||PHASE==='desktop'){\n"+s[end:];s=s.replace(" await guard('all observed production sessions have no page/console errors'"," }\n await guard('all observed production sessions have no page/console errors'")
s=s.replace("kind:'executed-browser-evaluation',at:","kind:'executed-browser-evaluation',phase:PHASE,at:")
p.write_text(s)
# Normal playback uses the same truthful renderer-ready wait, not recorder-only success.
p=R/'tests/runtime.mjs';s=p.read_text().replace("const page=await browser.newPage({viewport:{width:960,height:600}});","const page=await browser.newPage({viewport:{width:960,height:600}});page.setDefaultTimeout(60000);")
s=s.replace("await check('normal startup has no recorder or legacy globals'","await page.locator('#loader').waitFor({state:'detached',timeout:180000});\n await page.evaluate(()=>document.querySelector('#gl').getContext('webgl2').finish());\n await check('normal startup has no recorder or legacy globals'")
s=s.replace("path:'evidence/normal-animation-motor.png'","path:'evidence/normal-animation-motor.png',timeout:90000")
p.write_text(s)
p=R/'package.json';pkg=json.loads(p.read_text());pkg['scripts']['test:runtime']='node tests/runtime.mjs';pkg['scripts']['eval']='npm run typecheck && npm test && npm run verify:source && npm run build && npm run verify:dist && BASE=/school/brightlab/ vite build --outDir dist-subpath && BASE=/school/brightlab/ node tools/verify.mjs dist dist-subpath && SUBPATH_DIST=dist-subpath npm run test:browser && npm run test:runtime';p.write_text(json.dumps(pkg,indent=2)+'\n')
# Keep pump actions in a separate row: otherwise they can intercept the Exploded control.
p=R/'index.html';s=p.read_text();start=s.index('<aside class="panel" id="panel-pump"');end=s.index('</aside>',start)
section=s[start:end];icons=re.search(r'<div class="icons">.*?</div>',section,re.S)[0]
section=section.replace(icons,'')+'        <div class="row pump-actions">'+icons+'</div>\n      '
s=s[:start]+section+s[end:];p.write_text(s)
with (R/'src/style.css').open('a') as f:f.write('\n#panel-pump .pump-actions { justify-content: flex-end; }\n')
print('Pump help/tour restored in a separate row; verifier waits for completed GPU work; isolated browser phases available.')
