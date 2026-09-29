"""Apply the BrightLab identity to a fresh checkout of the pinned upstream.
Usage: python tools/brightlab/import.py apps/brightlab
Requires npm ci first so the bundled Three.js license can be copied.
"""
from pathlib import Path
import json, re, shutil, hashlib, sys
R=Path(sys.argv[1]).resolve(); B=R.parent/'brightlab-upstream-baseline'
if B.exists(): raise SystemExit('Refusing to overwrite baseline')
shutil.copytree(R,B,ignore=shutil.ignore_patterns('node_modules','dist','.git','fonts'))
shutil.rmtree(R/'public/fonts',ignore_errors=True)
# Only source and release assets are changed; no numerical/model rewrites.
for p in [*R.glob('src/**/*.ts'), R/'src/style.css']:
 s=p.read_text(); s=re.sub(r'\bthe lab\b', 'BrightLab', s, flags=re.I)
 s=s.replace('__lab','__brightlab').replace('__rec','__brightlabRecorder')
 s=s.replace('Outfit, ', '').replace('"DM Mono", ', '')
 p.write_text(s)
(R/'src/brand.ts').write_text('''/** BrightLab product identity. Keep deployed addresses empty until a host is assigned. */
export const BRAND = Object.freeze({
  name: 'BrightLab',
  parent: 'BrightClass',
  version: '1.0.0',
  tagline: 'Explore how things work.',
  description: 'Interactive science and engineering explorations by BrightClass. Open models, follow flows and try experiments.',
  site: '',
  shortUrl: '',
})

/** Share only the exhibit, never debugging, recording or arbitrary input parameters. */
export function makeShareUrl(exhibit: string, pageUrl: string, site: string = BRAND.site): string {
  const url = new URL(site || pageUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('BrightLab sharing requires an HTTP(S) page')
  url.search = ''
  url.hash = ''
  url.searchParams.set('ex', exhibit)
  return url.href
}
''')
p=R/'index.html'; s=p.read_text()
s=s.replace('<title>The lab: machines you can take apart in your browser</title>','<title>BrightLab | Interactive science by BrightClass</title>')
s=re.sub(r'<meta name="description" content="[^"]*" />','<meta name="description" content="BrightLab by BrightClass. Explore 11 interactive science and engineering exhibits: open models, follow invisible flows and try experiments." />',s)
s=re.sub(r'(<meta (?:property="og:|name="twitter:)(?:title|description)" content=")[^"]*',lambda m:m.group(1)+('BrightLab | Interactive science by BrightClass' if 'title' in m.group(1) else 'Explore how things work. Open models, follow invisible flows and try experiments.'),s)
s=re.sub(r'    <link rel="preload"[^\n]+\n','',s)
s=s.replace('<meta name="theme-color" content="#0a0d14" />','<meta name="theme-color" content="#0a0d14" />\n    <meta name="application-name" content="BrightLab" />\n    <meta property="og:site_name" content="BrightLab" />\n    <link rel="manifest" href="/manifest.webmanifest" />')
s=s.replace('aria-label="the lab"','aria-label="BrightLab home"').replace('alt="the lab"','alt="BrightLab"').replace('<h1>The lab</h1>','<h1>BrightLab</h1>')
s=s.replace('width="180" height="20"','width="200" height="36"').replace('width="126" height="14"','width="200" height="36"')
s=s.replace('</a>\n        <div class="sr">','</a>\n        <span class="brand-parent">by BrightClass</span>\n        <div class="sr">',1)
s=s.replace('The whole lab','Explore BrightLab').replace('Building the lab','Building BrightLab').replace('This interactive lab needs JavaScript and WebGL.','BrightLab needs JavaScript and WebGL 2. Please use a current browser.')
s=s.replace('<noscript><p', '<noscript><style>#app{display:none}</style><p')
s=s.replace('<h2>How to use it</h2>','<h2>Explore with BrightLab</h2>\n          <p class="fine">By BrightClass. These are simplified educational models, not engineering data or a validated curriculum.</p>')
s=s.replace('<button class="close" id="help-close">','<p class="fine"><a href="./credits.html" target="_blank" rel="noopener">Credits and model notices</a></p>\n          <button class="close" id="help-close">')
p.write_text(s)
p=R/'src/style.css';s=p.read_text();s=re.sub(r'@font-face\s*\{[^}]*\}\s*','',s)
s=s.replace("'Outfit', ",'').replace("'DM Mono', ",'')
s+='''\n/* BrightLab identity: the scientific flow colours remain unchanged. */
.brand img { height: 32px; width: auto; }
.brand-parent { display: block; margin: 4px 0 0 44px; font-size: 10px; color: #a8afb8; letter-spacing: .04em; }
.loader img { width: 200px; height: 36px; }
button:focus-visible, a:focus-visible { outline: 2px solid #f8c95a; outline-offset: 4px; }
.help-card a { color: #f8c95a; }
@media (max-width: 760px) {
  .brand img { height: 26px; }
  .brand-parent { margin-left: 36px; font-size: 9px; }
}
'''
p.write_text(s)
# Independent brand mark, not a recolour of the upstream icon.
mark='<rect x="1" y="1" width="34" height="34" rx="9" fill="#f8c95a"/><path d="M11 9h8a5 5 0 0 1 3 9 5 5 0 0 1-3 9h-8V9zm5 5v3h3a1.5 1.5 0 0 0 0-3h-3zm0 7v3h3a1.5 1.5 0 0 0 0-3h-3z" fill="#14181f"/>'
(R/'public/wordmark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 36" role="img" aria-label="BrightLab">'+mark+'<text x="45" y="27" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" letter-spacing="-1" fill="#ffffff">BrightLab</text></svg>\n')
(R/'public/favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><title>BrightLab</title>'+mark+'</svg>\n')
(R/'public/manifest.webmanifest').write_text(json.dumps({'name':'BrightLab by BrightClass','short_name':'BrightLab','description':'Interactive science and engineering explorations.','id':'./','start_url':'./','scope':'./','display':'standalone','background_color':'#0a0d14','theme_color':'#0a0d14','icons':[{'src':'./favicon.svg','sizes':'any','type':'image/svg+xml','purpose':'any'}]},indent=2)+'\n')
# Keep original upstream copyright and license unchanged.
notice=(B/'NOTICE.md').read_text().split('\nFonts:')[0]
notice+='''\n\n## BrightLab distribution

BrightLab is a BrightClass-branded derivative of AirsupHQ/airsup-lab, pinned to
commit e21864bda5a614ffae8d0a835518be8e2e571dce (28 September 2026).
Upstream: https://github.com/AirsupHQ/airsup-lab
Original copyright and MIT license are preserved in LICENSE. Rebranding does not
imply upstream endorsement. The original font assets are not distributed; this
version uses locally available system fonts. Three.js is distributed under MIT;
its license accompanies the runnable build. BrightLab modifications are MIT.
'''
(R/'NOTICE.md').write_text(notice)
(R/'public/credits.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BrightLab | Credits and model notices</title><style>body{max-width:760px;margin:48px auto;padding:24px;font:16px/1.6 system-ui;background:#0a0d14;color:#e8edf3}a{color:#f8c95a}pre{white-space:pre-wrap}</style><h1>BrightLab</h1><p>Interactive science by BrightClass.</p><h2>Model limitations</h2><p>All exhibits are simplified educational illustrations, not engineering data. Retained help panels distinguish published inputs from estimates. Neither classroom learning outcomes nor curriculum alignment have been independently validated.</p><h2>Attribution</h2><p>Derived from <a href="https://github.com/AirsupHQ/airsup-lab" rel="noopener">AirsupHQ/airsup-lab</a>, commit e21864bda5a614ffae8d0a835518be8e2e571dce. Original copyright: 2026 The lab authors. This distribution is not endorsed by the upstream authors.</p><p>Product names, including SpaceX, Tesla, Pratt &amp; Whitney and Formula 1, belong to their owners. No affiliation or endorsement is implied.</p><p><a href="./LICENSE.txt">Original MIT license</a> · <a href="./THREE-LICENSE.txt">Three.js license</a></p><p>No accounts, analytics, external fonts or network APIs are required by the runtime. Share uses your browser's native share sheet or clipboard.</p><a href="./">Return to BrightLab</a></html>\n''')
shutil.copy(B/'LICENSE',R/'public/LICENSE.txt'); shutil.copy(R/'node_modules/three/LICENSE',R/'public/THREE-LICENSE.txt')
for f in ['src/scene/room.ts','src/car/bay.ts']:
 p=R/f;s=p.read_text();s=s.replace('if (BRAND.shortUrl) g.fillText(BRAND.shortUrl,','g.fillText(BRAND.name,');p.write_text(s)
p=R/'src/director.ts';s=p.read_text();old='el.innerHTML = `<div class="ec-in"><span class="ec-k">Take it apart yourself</span>${BRAND.shortUrl ? `<span class="ec-u">${BRAND.shortUrl}</span>` : \'\'}</div>`'
new='''const inner = document.createElement('div')
    inner.className = 'ec-in'
    for (const [className, text] of [['ec-k', BRAND.tagline], ['ec-u', BRAND.name], ['ec-k', `by ${BRAND.parent}`]]) {
      const span = document.createElement('span')
      span.className = className
      span.textContent = text
      inner.appendChild(span)
    }
    if (BRAND.shortUrl) {
      const link = document.createElement('span')
      link.className = 'ec-k'
      link.textContent = BRAND.shortUrl
      inner.appendChild(link)
    }
    el.appendChild(inner)'''
assert old in s;s=s.replace(old,new);p.write_text(s)
p=R/'src/ui/ui.ts';s=p.read_text().replace("import { BRAND } from '../brand'","import { BRAND, makeShareUrl } from '../brand'")
s=s.replace("hall: 'BrightLab'","hall: 'Explore BrightLab'")
s=s.replace('  sync() {','  sync() {\n    document.title = `${TITLES[S.exhibit]} | ${BRAND.name}`')
s=s.replace("    const url = BRAND.site ? `${BRAND.site}${PATHS[S.exhibit]}` : `${location.origin}${location.pathname}?ex=${S.exhibit}`","    const url = makeShareUrl(S.exhibit, location.href)")
s=s.replace("const data = { title: TITLES[S.exhibit], text: 'An interactive lab: a fusion reactor, a rocket engine, a Cybertruck and a factory line you can take apart.', url }","const data = { title: `${TITLES[S.exhibit]} | ${BRAND.name}`, text: BRAND.description, url }")
p.write_text(s)
p=R/'src/state.ts';s=p.read_text().replace('under /lab','under /brightlab').replace("'/lab", "'/brightlab");p.write_text(s)
p=R/'src/main.ts';s=p.read_text();s="import { sanitizeParams } from './params'\n"+s
s=s.replace('const params = new URLSearchParams(location.search)','const params = sanitizeParams(location.search, Object.keys(SHOTS))')
old="  const path = PATHS[ex]\n  if (/^\\/(lab|rocket-engine)/.test(location.pathname) && location.pathname !== path) history.replaceState(null, '', path + location.search)"
assert old in s
s=s.replace(old,"  const url = new URL(location.href)\n  url.searchParams.set('ex', ex)\n  history.replaceState(null, '', url)")
p.write_text(s)
(R/'src/params.ts').write_text('''/** Untrusted share-link inputs must never create NaNs, invalid states or runaway render sizes. */
export function sanitizeParams(search: string, shots: readonly string[] = []): URLSearchParams {
  const input = new URLSearchParams(search)
  const out = new URLSearchParams()
  const enums: Record<string, readonly string[]> = {
    ex: ['hall','fusion','engine','pump','line','car','motor','robot','hole','jet','f1','drone'],
    q: ['low','mid','high'], rec: ['1'], fixed: ['1'], clean: ['1'], debug: ['1'],
    view: ['whole','cut','exploded'], fview: ['whole','cut','exploded'], mview: ['whole','cut','exploded'],
    cview: ['whole','xray','exploded'], follow: ['all','oxygen','methane','fire'],
    ffollow: ['all','plasma','magnets','neutrons','power'], cfollow: ['all','energy','motors','structure'],
    mfollow: ['all','current','field','gears'], cmode: ['cruise','launch','regen','steer'], mmode: ['drive','regen','coast'],
    shot: shots,
  }
  for (const [key, allowed] of Object.entries(enums)) {
    const value = input.get(key)
    if (value !== null && allowed.includes(value)) out.set(key, value)
  }
  const numeric: Record<string, readonly [number, number]> = {
    throttle: [.4,1], alt: [0,100], temp: [15,180], speed: [0,200], rpm: [0,16000],
    dpr: [.5,3], px: [300000,8300000], rs: [.5,2],
  }
  for (const [key, [min,max]] of Object.entries(numeric)) {
    const raw = input.get(key)
    if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) out.set(key, String(Math.max(min, Math.min(max, Number(raw)))))
  }
  return out
}
''')
pkg=json.loads((R/'package.json').read_text());pkg.update(name='brightlab',version='1.0.0',description='BrightLab by BrightClass: interactive science and engineering explorations.',engines={'node':'>=22.12.0'})
pkg['scripts'].update({'start':'node tools/serve.mjs','test':'node --test tests/unit.test.mjs','verify:source':'node tools/verify.mjs source','verify:dist':'node tools/verify.mjs dist','test:browser':'node tests/browser.mjs','eval':'npm run typecheck && npm run test && npm run verify:source && npm run build && npm run verify:dist && npm run test:browser'})
(R/'package.json').write_text(json.dumps(pkg,indent=2)+'\n')
lock=json.loads((R/'package-lock.json').read_text());lock['name']='brightlab';lock['packages']['']['name']='brightlab';lock['packages']['']['engines']=pkg['engines'];(R/'package-lock.json').write_text(json.dumps(lock,indent=2)+'\n')
(R/'tests').mkdir(exist_ok=True)
manifest={str(p.relative_to(B)):hashlib.sha256(p.read_bytes()).hexdigest() for p in B.glob('src/**/*.ts')}
(R/'tests/upstream-sha256.json').write_text(json.dumps({'commit':'e21864bda5a614ffae8d0a835518be8e2e571dce','files':manifest},indent=2)+'\n')
(R/'.gitignore').write_text('node_modules/\ndist/\ndist-subpath/\nevidence/\nfilms/\n.DS_Store\n*.mp4\n')
print('BrightLab identity applied. Original upstream source preserved separately.')
