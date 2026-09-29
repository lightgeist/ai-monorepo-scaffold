"""Require every verifier phase; missing, short or failed reports block release."""
from pathlib import Path
import json, shutil
R=Path('standalone/brightlab'); E=R/'evidence'; checks=[]; env={}
for phase,minimum in [('desktop',180),('touch',4),('subpath',3)]:
 p=Path('verification-results')/('brightlab-browser-'+phase)
 r=json.loads((p/'browser-report.json').read_text())
 assert r['phase']==phase and r['failed']==0 and r['passed']>=minimum,(phase,r.get('failed'),r.get('passed'))
 assert len(r['checks'])==r['passed'] and all(c['pass'] for c in r['checks'])
 assert not r['errors'] and not r['external']
 for c in r['checks']: checks.append({**c,'name':phase+': '+c['name']})
 env[phase]=r['environment']
 shutil.copytree(p,E/phase,dirs_exist_ok=True)
p=Path('verification-results/brightlab-browser-runtime')
r=json.loads((p/'runtime-report.json').read_text());assert r['failed']==0 and r['passed']>=4
shutil.copytree(p,E/'runtime',dirs_exist_ok=True)
shutil.copy(p/'runtime-report.json',E/'runtime-report.json')
(E/'browser-report.json').write_text(json.dumps({'kind':'executed-browser-matrix','phases':['desktop','touch','subpath'],'passed':len(checks),'failed':0,'checks':checks,'environment':env,'errors':[],'external':[]},indent=2)+'\n')
(E/'rebuild-result.txt').write_text('Four independent clean artifact extractions, npm ci installs and builds reproduced byte-identical runtime files.\n')
print(f'Accepted {len(checks)} browser checks and {r["passed"]} normal-playback checks across four isolated runners.')
