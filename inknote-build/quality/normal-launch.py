#!/usr/bin/env python3
"""Black-box positive CLI launch, Finder delivery, normal quit and process restart.
Only runs in an explicitly marked disposable CI environment; never edits user notes.
"""
import json,os,pathlib,subprocess,sys,tempfile,time,shutil
app=pathlib.Path(sys.argv[1]).resolve(); out=pathlib.Path(sys.argv[2]).resolve()
assert os.environ.get('CI')=='true','Run only in disposable CI'
out.mkdir(parents=True,exist_ok=True)
checks=[]
def check(value,name):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise RuntimeError(name)
def run(args,**kw):
 return subprocess.run(list(map(str,args)),check=True,capture_output=True,text=True,timeout=40,**kw).stdout
with tempfile.TemporaryDirectory(prefix='inknote-normal-') as td:
 tmp=pathlib.Path(td)
 helper=tmp/'app-observer'
 try:
  run(['swiftc',pathlib.Path(__file__).with_suffix('.swift'),'-o',helper])
  def status():return json.loads(run([helper,app]))
  def wait(predicate):
   until=time.monotonic()+20
   while time.monotonic()<until:
    value=status()
    if predicate(value):return value
    time.sleep(.25)
   raise RuntimeError('App state timeout: '+str(status()))
  check(status()['count']==0,'No existing matching app process before test')
  workspace=tmp/'Normal launch — notes';workspace.mkdir()
  note=workspace/'From the terminal.md'; text='# Normal launch\n\nActual CLI and Finder-event delivery.\n'
  note.write_text(text)
  cli=tmp/'inknote';cli.symlink_to(app/'Contents/MacOS/InknoteApp')
  env={**os.environ,'INKNOTE_APP_PATH':str(app)}
  run([cli,workspace],env=env)
  first=wait(lambda s:s['count']==1 and s['visibleWindows']>0)
  check(first['count']==1 and first['visibleWindows']>0,'Positive CLI folder launch creates a visible native app window')
  run([cli,note],env=env)
  time.sleep(2)
  check(status()['pids']==first['pids'],'Second CLI open uses the same running application')
  data=pathlib.Path.home()/'Library/Application Support/inknote'
  session=data/'sessions.json'
  check(session.exists() and str(note) in session.read_text(),'Finder open event persists the requested note in the app session')
  run([helper,app,'--terminate']);wait(lambda s:s['count']==0)
  check(note.read_text()==text,'Normal quit does not change untouched Markdown')
  run([cli],env=env)
  second=wait(lambda s:s['count']==1 and s['visibleWindows']>0)
  check(second['pids']!=first['pids'],'Normal application process restarts')
  time.sleep(1)
  check(str(note) in session.read_text(),'Normal restart preserves the saved workspace session')
  run([helper,app,'--terminate']);wait(lambda s:s['count']==0)
  check(note.read_text()==text,'Second normal quit preserves user content')
  shutil.copyfile(session,out/'normal-sessions.json')
  (out/'normal-processes.json').write_text(json.dumps({'first':first,'second':second},indent=2)+'\n')
 except Exception as e:
  checks.append({'name':'Normal-launch fatal error','passed':False,'detail':str(e)})
  try:run([helper,app,'--terminate'])
  except Exception:pass
 result={'passed':bool(checks) and all(c['passed'] for c in checks),'method':'Separate normal app process through installed CLI and Launch Services; external process/window observer; no acceptance-test entry point','checks':checks}
 (out/'normal-launch.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
 if not result['passed']:raise SystemExit(1)
