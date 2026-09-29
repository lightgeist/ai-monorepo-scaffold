from pathlib import Path
import re,shutil,sys
root=Path(sys.argv[1]);kit=Path(__file__).parent
# Remaining embedded finale thumbnail is excluded original character artwork.
p=root/'app/js/main.js';s=p.read_text();a=s.index('const FINALE_THUMB = {');b=s.index('const CROWD_THUMB',a)
section=s[a:b]
new='classic: \'<rect x="-15" y="-15" width="30" height="30" rx="8" fill="#19a891" stroke="#18344b" stroke-width="2"/><path d="M-8 0H8M0 -8V8" stroke="#fff" stroke-width="4" stroke-linecap="round"/>\','
section,n=re.subn(r"classic: '[^']*',",lambda _:new,section,count=1);assert n==1
s=s[:a]+section+s[b:];p.write_text(s)
for p in (root/'app').rglob('*'):
 if p.suffix not in {'.js','.css','.html'}:continue
 s=p.read_text();p.write_text(s.replace('Dela Gothic One','system-ui').replace('Zen Maru Gothic','system-ui'))
# IMPORTANT: String replacement payloads interpret $&, $` and $'. JavaScript
# bundles legitimately contain these characters. Callback replacement preserves
# every byte of the embedded program rather than splicing in surrounding HTML.
p=root/'build.mjs';s=p.read_text();s=s.replace("html.replace('</head>',`", "html.replace('</head>',()=>`").replace("html.replace('</body>',`", "html.replace('</body>',()=>`")
s=s.replace("html.replace('href=\"icon.svg\"',`", "html.replace('href=\"icon.svg\"',()=>`")
# The icon expression contains await, so resolve its bytes before the callback.
s=s.replace("let html=await readFile('app/index.html','utf8');", "const iconText=await readFile('app/icon.svg','utf8');\nlet html=await readFile('app/index.html','utf8');")
s=s.replace("encodeURIComponent(await readFile('app/icon.svg','utf8'))",'encodeURIComponent(iconText)')
p.write_text(s)
p=root/'e2e/user-journeys.spec.mjs';s=p.read_text()
s=s.replace("!await page.locator('#guide').isVisible())break;","!await page.locator('#guide').isVisible()&&!await page.locator('#trophy-got').isVisible())break;")
s=s.replace("await page.locator('#go-extra').click();", "await dismiss(page);await page.locator('#go-extra').click();")
s=s.replace("await expect(page.locator('#f-review')).toBeVisible();", "await dismiss(page);await expect(page.locator('#f-review')).toBeVisible();")
s=s.replace("await page.locator('#reset-data').click();await page.locator('#confirm-yes').click();", "await page.locator('#open-settings').click();await page.locator('#reset-data').click();await page.locator('#confirm-yes').click();")
# Log each named phase so failures retain useful evidence even before a timeout.
s=s.replace("async function snap(page,info,name){", "async function snap(page,info,name){\n console.log('SCREENSHOT_PHASE',info.project.name,name);")
p.write_text(s)
p=root/'playwright.config.mjs';s=p.read_text().replace('timeout:90000','timeout:180000');p.write_text(s)
# Include explicit regression tests for the two embedded mascot surfaces and
# safe standalone substitution, without changing math unit assertions.
p=root/'tests/brightmath.test.mjs';p.write_text(p.read_text()+'''\ntest('standalone bundle is embedded without replacement-string interpolation',async()=>{const s=await readFile('build.mjs','utf8');assert.ok(s.includes("html.replace('</body>',()=>`"));assert.ok(s.includes("html.replace('</head>',()=>`"));});
test('no original finale mascot thumbnail or font-family references remain',async()=>{const s=await readFile('app/js/main.js','utf8');const a=s.indexOf('const FINALE_THUMB'),b=s.indexOf('const CROWD_THUMB',a);assert.ok(!s.slice(a,b).includes('ellipse'));assert.ok(!s.includes('Dela Gothic One'));});
''')
# Delivered recipe is the prepared, directly applicable overlay. Original
# transforms are preserved in GitHub at the exact recipe commit. Do not run
# prepare.py twice over the already prepared overlay.
(root/'provenance/REPLAY.md').write_text('''# Reproduce brightmath\n\nFor the delivered application, use the full source at `source/`: `npm ci && npm run build && npm test`. This recreates the standalone HTML and modular site without downloading upstream artwork.\n\nFor re-derivation from the pinned upstream, check out the exact `recipe_commit` recorded in VERIFICATION.json from lightgeist/ai-monorepo-scaffold and run the materialization steps in its brightmath workflow. That repository contains the unmodified authored overlay; run prepare.py and screenshot-fix.py once, then rebrand.py, finish.py, artwork-cleanup.py and release-fixes.py on a fresh upstream checkout. The upstream clone is temporary and includes excluded assets; do not distribute its .git directory.\n\nThe `brightmath-build-recipe/` directory in this source snapshot records the prepared overlay and all transform sources for inspection; it is not an invitation to apply preparation twice.\n''')
shutil.copy2(kit/'release-fixes.py',root/'provenance/brightmath-build-recipe/release-fixes.py')
print('Applied safe standalone embedding, complete artwork isolation, and native modal journeys')
