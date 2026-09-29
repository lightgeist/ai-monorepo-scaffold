"""Package only a candidate whose executable gates passed. Never include font binaries."""
from pathlib import Path
import json, os, hashlib, zipfile, re
R=Path('standalone/brightlab'); O=Path('release'); O.mkdir(exist_ok=True)
source_commit=(R/'evidence/source-commit.txt').read_text().strip()
browser=json.loads((R/'evidence/browser-report.json').read_text()); assert browser['failed']==0
runtime=json.loads((R/'evidence/runtime-report.json').read_text()); assert runtime['failed']==0
unit=(R/'evidence/unit.log').read_text(); assert re.search(r'# fail 0\b',unit)
gates={x:json.loads((R/f'evidence/{x}-gates.json').read_text()) for x in ['source','dist','subpath']}
assert all(v['failed']==0 for v in gates.values())
def allowed(p):
 return not any(x in p.parts for x in ['node_modules','.git','dist','dist-subpath','evidence','films']) and p.suffix.lower() not in ['.woff','.woff2','.ttf','.otf','.eot','.mp4']
source=[p for p in R.rglob('*') if p.is_file() and allowed(p.relative_to(R))]
with zipfile.ZipFile(O/'BrightLab-1.0.0-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(source): z.write(p,'BrightLab-1.0.0-source/'+str(p.relative_to(R)))
with zipfile.ZipFile(O/'BrightLab-1.0.0-web.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((R/'dist').rglob('*')):
  if p.is_file():
   assert p.suffix.lower() not in ['.woff','.woff2','.ttf','.otf','.eot']
   z.write(p,'BrightLab-1.0.0/'+str(p.relative_to(R)))
 for p in ['tools/serve.mjs','README.md','LICENSE','NOTICE.md']:
  z.write(R/p,'BrightLab-1.0.0/'+p)
 z.writestr('BrightLab-1.0.0/package.json',json.dumps({'name':'brightlab','version':'1.0.0','private':True,'type':'module','scripts':{'start':'node tools/serve.mjs'},'engines':{'node':'>=22.12.0'}}))
with zipfile.ZipFile(O/'BrightLab-1.0.0-evidence.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((R/'evidence').rglob('*')):
  if p.is_file(): z.write(p,str(p.relative_to(R)))
report={'product':'BrightLab','version':'1.0.0','upstream':'AirsupHQ/airsup-lab','upstream_commit':'e21864bda5a614ffae8d0a835518be8e2e571dce','source_commit':source_commit,'run_url':os.environ['RUN_URL'],'unit_passed':int(re.search(r'# pass (\d+)',unit)[1]),'browser_passed':browser['passed'],'browser_failed':browser['failed'],'normal_playback_passed':runtime['passed'],'normal_playback_failed':runtime['failed'],'gates':{k:{'passed':v['passed'],'failed':v['failed']} for k,v in gates.items()},'environment':browser['environment'],'source_files':len(source),'limitations':['Chromium Linux software WebGL; not physical-board or Safari/Firefox certification','Phone-size responsive layout is tested by resizing a touchscreen context, not a native mobile browser','Preserves upstream educational illustrations; not independent scientific or curriculum validation','Native share-sheet UI not automated; clipboard calls captured via isolated stub','No Atlas/LMS integration or new curriculum objects','No standalone independent LLM reviewer claimed','Recorder CLI not exercised by these tests; all scripted tours are executed in browser']}
(O/'BrightLab-1.0.0-report.json').write_text(json.dumps(report,indent=2)+'\n')
manifest={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source)}
(O/'BrightLab-1.0.0-source-sha256.json').write_text(json.dumps(manifest,indent=2)+'\n')
checksums=[]
for p in sorted(O.iterdir()):
 if p.is_file(): checksums.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name)
(O/'SHA256SUMS.txt').write_text('\n'.join(checksums)+'\n')
print(json.dumps(report,indent=2))
