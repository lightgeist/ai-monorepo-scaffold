from pathlib import Path
import hashlib,json,re,shutil,sys,subprocess
root=Path(sys.argv[1]).resolve(); kit=Path(__file__).parent.resolve()
assert subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()=='fdacd5fc8322f251f92ddc07f13ae85ccb2263dd'
# Do not distribute the excluded mascot/logo source or font binaries, even in history archives.
(root/'app/js/dopakichi.js').unlink();(root/'docs/dopakichi.svg').unlink();shutil.rmtree(root/'app/fonts');shutil.rmtree(root/'tools')
provenance=root/'provenance';provenance.mkdir()
shutil.copy2(root/'README.md',provenance/'UPSTREAM-README.md')
shutil.move(str(root/'docs/SPEC.md'),str(provenance/'UPSTREAM-SPEC.md'))
core=['problems.js','skills.js','session.js','scoring.js','growth.js','quests.js','trophies.js']
original={n:hashlib.sha256((root/'app/js'/n).read_bytes()).hexdigest() for n in core}
for base in [root/'app',root/'tests']:
 for p in base.rglob('*'):
  if not p.is_file():continue
  try:s=p.read_text()
  except UnicodeError:continue
  for a,b in [('dopakichiSVG','brightTileSVG'),('dopakichiSprite','brightTileSprite'),("'./dopakichi.js'","'./bright-tile.js'"),('Dopakichi','BrightTile'),('ドパドリル','brightmath'),('ドパキチ','ひかりタイル'),('Dopa Drill','brightmath'),('dopa-drill','brightmath')]:s=s.replace(a,b)
  # Only visible Japanese branding; mathematical variables and stable skill identifiers stay intact.
  s=s.replace('ドパ','ひかり')
  s=s.replace('"Dela Gothic One"','system-ui').replace("'Dela Gothic One'",'system-ui').replace('"Zen Maru Gothic"','system-ui').replace("'Zen Maru Gothic'",'system-ui')
  p.write_text(s)
# Fonts are system-owned, not redistributed. Remove every external font loader.
p=root/'app/style.css';s=p.read_text();s=re.sub(r'@font-face\s*\{[^}]*\}\s*','',s,flags=re.S);p.write_text(s)
# Replace the entire protected logo rather than recoloring or renaming its artwork.
p=root/'app/index.html';s=p.read_text();logo='<h1 id="logo" class="logo" aria-label="brightmath"><span class="brightmath-wordmark">'+(kit/'icon.svg').read_text().strip()+'<span>bright<em>math</em></span></span><span class="brightmath-tagline">ひとつずつ、できるをふやそう。</span></h1>'
s,n=re.subn(r'<h1 id="logo".*?</h1>',logo,s,count=1,flags=re.S);assert n==1
s=s.replace('viewport-fit=cover, user-scalable=no','viewport-fit=cover')
s=s.replace('<title>brightmath</title>','<title>brightmath — 算数れんしゅう</title>')
s=s.replace('算数を解くたびに、演出と音がどんどんインフレするドリル。','brightmath: 58の算数スキル。ブラウザで楽しくれんしゅう。記録はこの端末だけ。')
s=s.replace('<link rel="stylesheet" href="style.css">','<link rel="stylesheet" href="style.css">\n  <link rel="stylesheet" href="brand.css">')
s=s.replace('<p class="hint">数字キーとBackspaceでも操作できます</p>','<p class="hint">数字キーとBackspaceでも操作できます</p><footer class="brand-footer">brightmath 1.0.0 · 日本語版 · 記録は端末内のみ<br><a href="about.html" target="_blank" rel="noopener">About / ライセンス</a></footer>')
s=s.replace('<button type="button" class="big-btn" id="close-settings">','<p class="brand-note">brightmath 1.0.0 · 日本語版<br>ログイン・広告・外部送信なし。</p><button type="button" class="big-btn" id="close-settings">')
p.write_text(s)
p=root/'app/js/main.js';s=p.read_text();a=s.index('// Logo burst:');b=s.index('const saved = store.settings();',a);s=s[:a]+'// brightmath uses a static original wordmark, not the upstream logo.\n'+s[b:]
s=s.replace('window.__dopa = { S, audio };','const inspection = { S, audio };\n// Opt-in local diagnostic fixture; absent from ordinary launches.\nif (params.has("inspect")) window.__brightmathTest = inspection;')
s=s.replace('Object.assign(window.__dopa,','Object.assign(inspection,')
s=s.replace('const ctx = { beat: S.kick };','const ctx = { beat: S.kick, reduced: S.reduced };')
p.write_text(s)
shutil.copy2(kit/'bright-tile.js',root/'app/js/bright-tile.js');shutil.copy2(kit/'brand.css',root/'app/brand.css');shutil.copy2(kit/'icon.svg',root/'app/icon.svg')
# Add deployment-specific headers, without imposing a nonexistent product URL.
(root/'app/_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; connect-src \'none\'; font-src \'none\'; object-src \'none\'; base-uri \'none\'; frame-ancestors \'none\'\n')
# Any change to a retained math module must be made explicit and reviewed, not masked by rebranding.
changed={n:{'before':h,'after':hashlib.sha256((root/'app/js'/n).read_bytes()).hexdigest()} for n,h in original.items() if h!=hashlib.sha256((root/'app/js'/n).read_bytes()).hexdigest()}
(provenance/'core-preservation.json').write_text(json.dumps({'upstream_commit':'fdacd5fc8322f251f92ddc07f13ae85ccb2263dd','retained_core_hashes':original,'changed':changed},indent=2)+'\n')
assert not changed,changed
(root/'NOTICE.md').write_text('''# brightmath attribution and scope\n\nOriginal reusable code: dopa-drill by gear_machine (2026), MIT subject to the exclusions in LICENSE. This independent brightmath edition is not affiliated with or endorsed by the original author.\n\nThe original Dopakichi character source, mascot artwork, Dopa Drill logo, and bundled font binaries are excluded from this delivery. Brightmath uses original geometric mathematical-tile artwork and system fonts. The upstream LICENSE is retained unmodified, including its exclusions. References to original names in provenance and this notice are attribution, not product branding.\n\nNew work: brightmath identity, independent presentation adapter, namespace isolation, standalone packaging, tests and release evidence. No AI service, student account, ads, analytics, or server-side learner records have been added.\n\nJapanese interface and the original Japanese grade mapping are retained. English localization and India-specific curriculum alignment are not claimed. This is a browser app, not a signed native macOS application.\n''')
for name in ['README.md','ARCHITECTURE.md','about.html','build.mjs','qualify.mjs','server.mjs','package.json']:
 src=kit/name
 if src.exists():
  dst=root/('app/about.html' if name=='about.html' else name);shutil.copy2(src,dst)
for p in (kit/'tests').glob('*') if (kit/'tests').exists() else []:shutil.copy2(p,root/'tests'/p.name)
# Human-readable replay recipe. No .git objects (which contain excluded assets) enter delivery.
shutil.copytree(kit,provenance/'brightmath-build-recipe',ignore=shutil.ignore_patterns('node_modules','evidence','__pycache__'))
print('BRIGHTMATH_REBRAND_OK',json.dumps({'upstream': 'fdacd5fc8322f251f92ddc07f13ae85ccb2263dd','core_modules_unchanged':len(core),'language':'ja','runtime_dependencies':0}))
