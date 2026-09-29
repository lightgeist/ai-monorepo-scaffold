from pathlib import Path
import html,shutil,sys,json
root=Path(sys.argv[1]);kit=Path(__file__).parent
# Local attribution remains available even when the standalone HTML is copied alone.
notice=html.escape((root/'NOTICE.md').read_text());license=html.escape((root/'LICENSE').read_text())
about=f'<dialog id="brand-about" aria-labelledby="brand-about-title"><h2 id="brand-about-title">brightmath 1.0.0</h2><p>日本語版 / Japanese edition</p><pre>{notice}\n{license}</pre><button type="button" id="brand-about-close">Close / とじる</button></dialog>'
p=root/'app/index.html';s=p.read_text().replace('<a href="about.html" target="_blank" rel="noopener">About / ライセンス</a>','<button type="button" id="brand-about-open">About / ライセンス</button>');s=s.replace('</body>',about+'\n</body>');p.write_text(s)
p=root/'app/js/main.js';p.write_text(p.read_text()+'''\n// The same local About dialog is bundled into the standalone build.
const brandAbout = document.querySelector('#brand-about');
document.querySelector('#brand-about-open').addEventListener('click', () => brandAbout.showModal());
document.querySelector('#brand-about-close').addEventListener('click', () => brandAbout.close());
''')
p=root/'app/brand.css';p.write_text(p.read_text()+'''\n#brand-about{max-width:min(640px,90vw);max-height:80vh;border:2px solid #18344b;border-radius:20px;padding:24px;color:#18344b;background:#fffdf8;font:14px/1.7 system-ui,sans-serif;}
#brand-about::backdrop{background:#18344baa;}#brand-about pre{white-space:pre-wrap;font:12px/1.7 system-ui,sans-serif;}#brand-about-close{min-height:44px;padding:8px 20px;}#brand-about-open{font:inherit;border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;min-height:36px;}
''')
# Reward IDs remain stable; the new artwork's accessory badges are described truthfully.
p=root/'app/js/unlocks.js';s=p.read_text();names={'ぼうし':'プラス バッジ','はちまき':'イコール バッジ','マント':'かけざん バッジ','まるめがね':'むげん バッジ','リボン':'わりざん バッジ','おうかん':'スター バッジ','まほうの ぼうし':'ルート バッジ','ヘッドホン':'おんぷ バッジ'}
for a,b in sorted(names.items(),key=lambda item:-len(item[0])):s=s.replace("name: '"+a+"'","name: '"+b+"'")
p.write_text(s)
p=root/'docs/curriculum.md';p.write_text(p.read_text().replace('ドパドリル','brightmath').replace('`docs/SPEC.md`','`provenance/UPSTREAM-SPEC.md`'))
(root/'app/about.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>About brightmath</title><body><h1>brightmath</h1><pre style="white-space:pre-wrap;font:15px/1.6 system-ui">'+notice+'\n'+license+'</pre></body></html>')
(root/'playwright.config.mjs').write_text((kit/'playwright.config.mjs').read_text())
shutil.copytree(kit/'e2e',root/'e2e')
shutil.copytree(kit,root/'provenance/brightmath-build-recipe',dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules','evidence','__pycache__'))
print('Local attribution, accurate badge labels and browser test harness installed')
