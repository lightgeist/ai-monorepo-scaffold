from pathlib import Path
import hashlib,json,shutil,sys,os,zipfile,re,datetime
root=Path(sys.argv[1]).resolve();evidence=root/'evidence';out=Path('publish').resolve();out.mkdir(exist_ok=True)
result=json.loads((evidence/'browser-results.json').read_text())
stats=result['stats'];assert stats['unexpected']==0 and stats['flaky']==0 and stats['skipped']==0,stats
static=json.loads((evidence/'static-checks.json').read_text());assert static['passed']
unit=(evidence/'unit-tests.log').read_text();assert '# fail 0' in unit and '# skipped 0' in unit
count=int(re.search(r'# tests (\d+)',unit)[1]);assert count>=63,count
stage=Path('brightmath-1.0.0').resolve();stage.mkdir()
shutil.copytree(root/'dist',stage/'app')
shutil.copytree(root/'evidence',stage/'evidence',ignore=shutil.ignore_patterns('browser-artifacts'))
source=stage/'source';source.mkdir()
for p in root.iterdir():
 if p.name in {'.git','node_modules','dist','evidence'}:continue
 if p.is_dir():shutil.copytree(p,source/p.name,ignore=shutil.ignore_patterns('__pycache__'))
 else:shutil.copy2(p,source/p.name)
# Never hide excluded artwork/fonts inside a history bundle or package.
files=sorted(p for p in stage.rglob('*') if p.is_file())
for p in files:
 assert p.suffix.lower() not in {'.woff','.woff2','.otf','.ttf','.ttc','.bundle'},p
 assert p.name not in {'dopakichi.js','dopakichi.svg'},p
assert not any(p.name=='.git' for p in stage.rglob('*'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'product':'brightmath','version':'1.0.0','language':'ja','upstream':'grmchn/dopa-drill','upstream_commit':'fdacd5fc8322f251f92ddc07f13ae85ccb2263dd','recipe_commit':os.environ['GITHUB_SHA'],'qualified_run':'https://github.com/'+os.environ['GITHUB_REPOSITORY']+'/actions/runs/'+os.environ['GITHUB_RUN_ID'],'unit_tests':count,'browser_statistics':stats,'browser_projects':[x['name'] for x in result['config']['projects']],'static_checks':len(static['checks']),'core_preservation':json.loads((root/'provenance/core-preservation.json').read_text()),'standalone_sha256':sha(root/'dist/brightmath.html'),'limits':['Japanese interface; not an English localization','Original Japanese grade mapping retained; no curriculum certification','Automated browser engines and phone viewports, not physical mobile devices or every branded browser','No human listening test or accessibility certification','No AI tutor or external runtime service','Local file storage persistence is browser/location dependent'],'files':{str(p.relative_to(stage)):{'bytes':p.stat().st_size,'sha256':sha(p)} for p in files}}
(stage/'VERIFICATION.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
report=f'''# brightmath 1.0.0 — release verification\n\n## Start here\n\nOpen `app/brightmath.html` in a current desktop browser. It is a self-contained application, not a mockup. For stable origin-based storage and mobile use, deploy `app/site/` on a static host. The full source and replay instructions are in `source/`.\n\n**Japanese edition.** This rebrand retains the original Japanese interface, 58 arithmetic skills and grades 1–6 mapping. English localization, India-specific alignment, native desktop installation and AI tutoring are not part of this release.\n\n## Executed release gates\n\n- Original baseline: 58 tests passed.\n- Rebranded math and product tests: {count} passed, zero failures or skips.\n- Browser journeys: {stats['expected']} passed, zero unexpected failures, skips or flaky retries.\n- Static identity, privacy and packaging checks: {len(static['checks'])} passed.\n\nBrowser projects: {', '.join(manifest['browser_projects'])}. Tests use actual keyboard/pointer UI input; the opt-in diagnostic fixture is read to choose known answers, not used to bypass user interactions. Core math correctness is independently covered by unit tests. The release tested the built modular site under its actual CSP, and the standalone HTML via a file URL in offline mode.\n\nCoverage: onboarding, all six grades, wrong answers and deletion, full scored sessions, review, accelerated extra-round fixture, persisted settings, local storage isolation, reset cancellation/confirmation, blocked storage, skill tree, trophy filters, collectible badges, calendar navigation, non-reduced animation transport, demo interruption, local About and standalone offline play. Screenshots, runtime error reports and structured browser results are included. Phone tests emulate viewport/touch behavior; they are not physical iPhone or Safari-app qualification. Audio was exercised programmatically, not judged by ear. No medical, learning-effectiveness, exhaustive accessibility or long-duration reliability claim is made.\n\n## Independent identity\n\nOriginal brightmath wordmark, icon and mathematical-tile artwork replace the excluded upstream mascot/logo; an embedded seventh-day mascot sticker was also replaced. Settings use `brightmath:v1`. No implicit migration from dopa-drill; reset preserves unrelated apps. System fonts replace redistributed font binaries. No analytics, ads, accounts, external font requests or AI services. Six core rule modules remain byte-identical; trophies only change the visible Japanese energy label.\n\n## Provenance and packaging\n\nUpstream: {manifest['upstream']} at {manifest['upstream_commit']}. Original MIT notice and its asset exclusions are retained. Restricted artwork and font binaries are excluded, including Git history objects that would reintroduce them. The package includes source, pinned hashes and a replay recipe instead.\n\nQualified run: {manifest['qualified_run']}\n\nAll payload files have SHA-256 entries. The final ZIP is extracted/read back and every entry is checked before release. The application is not rebuilt or altered after testing.\n'''
(stage/'START-HERE.md').write_text(report)
(stage/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.relative_to(stage)}\n' for p in sorted(stage.rglob('*')) if p.is_file()))
package=out/'brightmath-1.0.0-complete.zip'
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(stage.rglob('*')):
  if p.is_file():z.write(p,str(Path(stage.name)/p.relative_to(stage)))
with zipfile.ZipFile(package) as z:
 assert z.testzip() is None
 for line in (stage/'SHA256SUMS.txt').read_text().splitlines():
  expected,name=line.split('  ',1);assert hashlib.sha256(z.read(stage.name+'/'+name)).hexdigest()==expected,name
shutil.copy2(stage/'START-HERE.md',out/'brightmath-1.0.0-release-report.md');shutil.copy2(stage/'VERIFICATION.json',out/'brightmath-1.0.0-verification.json');shutil.copy2(root/'dist/brightmath.html',out/'brightmath.html')
receipt={'file':package.name,'bytes':package.stat().st_size,'sha256':sha(package),'checked_payload_files':len((stage/'SHA256SUMS.txt').read_text().splitlines()),'qualified_run':manifest['qualified_run'],'unit_tests':count,'browser_tests':stats['expected'],'zero_failures':True,'excludes_original_character_and_font_binaries':True}
(out/'brightmath-1.0.0-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print('RELEASE_RECEIPT',json.dumps(receipt))
