"""Evidence-producing validation. No provider credentials or live publication.
Run with the fork root as argv[1]. Results are facts, including failures/skips.
"""
from pathlib import Path
import os,sys,json,subprocess,time,traceback,hashlib,re,xml.etree.ElementTree as ET
R=Path(sys.argv[1]).resolve();os.chdir(R);sys.path.insert(0,str(R))
E=R/'validation';E.mkdir(exist_ok=True)
results={};processes=[]
def check(name,fn):
 try:
  detail=fn();results[name]={'status':'passed','detail':detail}
 except Exception as exc:
  results[name]={'status':'failed','error':str(exc),'traceback':traceback.format_exc()}
 (E/'results.json').write_text(json.dumps(results,indent=2,default=str))
 print(name,results[name]['status'],flush=True)
def run(cmd,name,cwd=R,timeout=180):
 p=subprocess.run(cmd,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=timeout)
 (E/(name+'.log')).write_text(p.stdout)
 return p

def integrity():
 meta=json.loads((R/'UPSTREAM.json').read_text())
 assert not (R/'cloud').exists()
 assert hashlib.sha256((R/'LICENSE').read_bytes()).hexdigest()==meta['original_license_sha256']
 assert (R/'VERSION').read_text().strip()=='0.1.0-rc.1'
 forbidden=[str(p.relative_to(R)) for p in R.rglob('*') if p.is_file() and 'node_modules' not in p.parts and p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.ttc'}]
 assert not forbidden,forbidden
 assert not (R/'.env').exists()
 for pkg in ['dashboard','render-service','remotion']:
  obj=json.loads((R/pkg/'package.json').read_text());assert obj['version']=='0.1.0-rc.1';assert 'atlasshorts' in obj['name']
 return {'license_preserved':True,'cloud_absent':True,'font_binaries_absent':True,'package_versions':'0.1.0-rc.1'}
check('distribution_integrity',integrity)

def storage():
 code="""import assert from 'node:assert/strict';
const local={foreign:'keep',getItem(k){return this[k]??null},setItem(k,v){this[k]=String(v)},removeItem(k){delete this[k]}};
globalThis.window={localStorage:local,sessionStorage:{...local}};
const {atlasLocalStorage:s,atlasSessionStorage:t}=await import('./dashboard/src/lib/storage.js');
s.setItem('key','value');assert.equal(local['atlasshorts:key'],'value');assert.equal(s.getItem('key'),'value');s.clear();assert.equal(local.foreign,'keep');assert.equal(s.getItem('key'),null);t.setItem('session','x');assert.equal(t.getItem('session'),'x');console.log('6 storage namespace assertions passed');
"""
 p=run(['node','--input-type=module','-e',code],'storage');assert p.returncode==0,p.stdout
 return p.stdout.strip()
check('browser_storage_isolation',storage)

def regression():
 p=run([sys.executable,'-m','pytest','tests','-q','--junitxml='+str(E/'pytest.xml')],'pytest',timeout=300)
 detail={'exit_code':p.returncode,'excluded_cloud_files':json.loads((R/'tests/excluded-cloud-tests.json').read_text())}
 if (E/'pytest.xml').exists():
  suites=ET.parse(E/'pytest.xml').getroot();detail['suites']=[dict(s.attrib) for s in suites.iter('testsuite')];detail['failures']=[{'test':t.attrib.get('classname','')+'::'+t.attrib.get('name',''),'message':(t.find('failure') if t.find('failure') is not None else t.find('error')).attrib.get('message','')} for t in suites.iter('testcase') if t.find('failure') is not None or t.find('error') is not None]
 results['upstream_core_regression']={'status':'passed' if p.returncode==0 else 'failed','detail':detail};(E/'results.json').write_text(json.dumps(results,indent=2));print('upstream_core_regression',p.returncode,flush=True)
regression()

def api():
 from fastapi.testclient import TestClient
 import app
 with TestClient(app.app) as client:
  assert client.get('/health/ready').status_code==200
  cfg=client.get('/api/config');assert cfg.status_code==200
  init=client.post('/mcp',json={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'atlas-release-check','version':'1'}}})
  assert init.status_code==200,init.text
  server=init.json()['result']['serverInfo'];assert server['name']=='atlasshorts';assert server['version']=='0.1.0-rc.1'
  tools=client.post('/mcp',json={'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}}).json()['result']['tools']
  names=[t['name'] for t in tools];assert 'process_video' in names;assert 'add_subtitles' in names
  missing=client.get('/api/status/atlas-no-such-job');assert missing.status_code==404
  bad=client.post('/mcp',json={'jsonrpc':'2.0','id':3,'method':'does/not/exist'});assert 'error' in bad.json()
  return {'server':server,'tools':names,'missing_job':missing.status_code,'config':cfg.json()}
check('live_app_api_and_mcp',api)

def stdio():
 messages=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'atlas-test','version':'1'}}},{'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}}]
 p=subprocess.run([sys.executable,'mcp_stdio.py'],input=''.join(json.dumps(m)+'\n' for m in messages),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=45)
 (E/'mcp-stdio-stderr.log').write_text(p.stderr)
 lines=[json.loads(line) for line in p.stdout.splitlines() if line.strip()]
 assert p.returncode==0,p.stderr;assert len(lines)==2,p.stdout;assert lines[0]['result']['serverInfo']['name']=='atlasshorts'
 return {'json_rpc_responses':len(lines),'stdout_protocol_clean':True}
check('stdio_mcp',stdio)

def render():
 from subtitles import generate_ass,generate_srt
 sample=E/'synthetic-input.mp4';out=E/'synthetic-captioned.mp4';ass=E/'synthetic.ass';srt=E/'synthetic.srt'
 words=[{'word':word,'start':i*.6,'end':(i+1)*.6} for i,word in enumerate(['AtlasShorts','render','check','synthetic','fixture'])]
 transcript={'language':'en','segments':[{'start':0,'end':3,'text':'AtlasShorts render check synthetic fixture','words':words}]}
 assert generate_ass(transcript,0,3,str(ass),fontsize=24,uppercase=True,reveal=True)
 assert generate_srt(transcript,0,3,str(srt))
 p=run(['ffmpeg','-hide_banner','-y','-f','lavfi','-i','testsrc2=size=360x640:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','3','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',str(sample)],'fixture-input');assert p.returncode==0,p.stdout
 p=run(['ffmpeg','-hide_banner','-y','-i',str(sample),'-vf','ass='+str(ass),'-c:v','libx264','-preset','ultrafast','-c:a','copy',str(out)],'fixture-render');assert p.returncode==0,p.stdout
 p=run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(out)],'ffprobe');d=json.loads(p.stdout);v=next(s for s in d['streams'] if s['codec_type']=='video');assert (v['width'],v['height'])==(360,640);assert 2.9<float(d['format']['duration'])<3.2
 assert out.stat().st_size>1000
 return {'synthetic_only':True,'codec':v['codec_name'],'width':360,'height':640,'duration':d['format']['duration'],'ass_and_srt':True,'provider_calls':0}
check('real_ffmpeg_caption_render',render)

def cli():
 p=run([sys.executable,'cli/atlasshorts_cli.py','--version'],'cli-version');assert p.returncode==0 and 'AtlasShorts 0.1.0-rc.1' in p.stdout
 p=run([sys.executable,'cli/atlasshorts_cli.py','--help'],'cli-help');assert p.returncode==0
 return {'version':'AtlasShorts 0.1.0-rc.1','help':True}
check('cli_smoke',cli)

def browser():
 api_log=(E/'browser-api.log').open('w');web_log=(E/'browser-server.log').open('w')
 backend=subprocess.Popen([sys.executable,'-m','uvicorn','app:app','--host','127.0.0.1','--port','8000'],stdout=api_log,stderr=subprocess.STDOUT);processes.append(backend)
 env=os.environ.copy();env['VITE_PROXY_TARGET']='http://127.0.0.1:8000'
 frontend=subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1','--port','5175'],cwd=R/'dashboard',env=env,stdout=web_log,stderr=subprocess.STDOUT);processes.append(frontend)
 import urllib.request
 for _ in range(60):
  try:
   urllib.request.urlopen('http://127.0.0.1:5175',timeout=1);urllib.request.urlopen('http://127.0.0.1:8000/health/ready',timeout=1);break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Servers not ready')
 # Required agent-browser gut check, with independent detailed browser assertions below.
 for label,args in [('open',['open','http://127.0.0.1:5175']),('wait',['wait','--load','networkidle']),('snapshot',['snapshot','-i']),('screenshot',['screenshot',str(E/'agent-browser-desktop.png')]),('close',['close'])]:
  p=run(['agent-browser',*args],'agent-browser-'+label,timeout=60);assert p.returncode==0,p.stdout
 from playwright.sync_api import sync_playwright
 captures=[]
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox'])
  for name,width,height in [('desktop',1440,1000),('mobile',393,852)]:
   context=b.new_context(viewport={'width':width,'height':height});page=context.new_page();errors=[];external=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('request',lambda req:external.append(req.url) if not req.url.startswith(('http://127.0.0.1','http://localhost','data:','blob:')) else None)
   page.goto('http://127.0.0.1:5175',wait_until='networkidle');page.wait_for_timeout(1000)
   text=page.inner_text('body');assert 'AtlasShorts' in text and len(text)>300,text[:300]
   assert not page.locator('vite-error-overlay').count();assert not errors,errors
   page.screenshot(path=str(E/(name+'-workspace.png')),full_page=True)
   overflow=page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')
   settings=page.get_by_role('button',name=re.compile('Go to Settings|^Settings$',re.I))
   if settings.count():settings.first.click();page.wait_for_timeout(400)
   assert 'Gemini' in page.inner_text('body')
   page.screenshot(path=str(E/(name+'-settings.png')),full_page=True)
   page.goto('http://127.0.0.1:5175/#legal',wait_until='networkidle');assert 'About this self-hosted release' in page.inner_text('body')
   page.goto('http://127.0.0.1:5175/#landing',wait_until='networkidle');assert 'Open workspace' in page.inner_text('body');page.get_by_role('button',name='Open workspace').click();page.wait_for_timeout(500);assert '#app' in page.url
   assert not errors,errors
   captures.append({'viewport':name,'page_errors':errors,'horizontal_overflow':overflow,'external_request_urls':sorted(set(external)),'settings_and_routes':True});context.close()
  b.close()
 return captures
check('desktop_mobile_browser',browser)
for p in processes:
 try:p.terminate();p.wait(timeout=10)
 except Exception:p.kill()
(E/'results.json').write_text(json.dumps(results,indent=2,default=str))
lines=['# Validation — AtlasShorts 0.1.0-rc.1','','This report is generated from the actual run, not a planned test list.','','| Check | Result |','|---|---|']
for name,result in results.items():lines.append('| '+name+' | '+result['status']+' |')
lines+=['','Full details and logs are under `validation/`. Regression results explicitly list excluded commercial-cloud test files and all failures/skips. A green build does not imply a tested provider pipeline.','','## Not tested','','Live Gemini/local-LLM moment selection; ASR or face-tracking inference with downloaded model weights; paid fal.ai/ElevenLabs video generation; real publishing/scheduling; GPU operation; full Docker image execution; public or multi-user deployment; dependency-vulnerability and commercial-license clearance. The sample video is a synthetic FFmpeg fixture, not an AI-generated customer video.','','Frontend and renderer build logs are included separately by the release workflow.']
(R/'VALIDATION.md').write_text('\n'.join(lines)+'\n')
print('ATLAS_VALIDATION_JSON='+json.dumps(results,default=str),flush=True)
# Core regression failures are recorded, not hidden; packaging an RC is allowed.
# Broken product build, distribution boundary, API or browser does block publication.
required=['distribution_integrity','browser_storage_isolation','live_app_api_and_mcp','stdio_mcp','real_ffmpeg_caption_render','cli_smoke','desktop_mobile_browser']
raise SystemExit(0 if all(results.get(k,{}).get('status')=='passed' for k in required) else 2)
