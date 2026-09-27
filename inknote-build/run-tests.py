"""Run every native test with bounded compilation and diagnostic timeout handling.
A timeout is a failure, never a reason to skip a test or claim a pass.
"""
import json,os,pathlib,signal,subprocess,sys,time
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
results=[]
def phase(name,args,limit):
    print('NATIVE TEST PHASE:',name,flush=True)
    start=time.monotonic()
    p=subprocess.Popen(args,start_new_session=True)
    timed_out=False
    try:code=p.wait(timeout=limit)
    except subprocess.TimeoutExpired:
        timed_out=True
        print('TIMEOUT:',name,'Collecting native process diagnostics',flush=True)
        ps=subprocess.run(['ps','-axo','pid,ppid,etime,%cpu,%mem,command'],capture_output=True,text=True,timeout=15)
        (out/(name+'-processes.txt')).write_text(ps.stdout)
        for row in ps.stdout.splitlines():
            fields=row.split(None,5)
            if len(fields)==6 and ('InknotePackageTests.xctest' in fields[5] or '/xctest ' in fields[5]):
                try:subprocess.run(['/usr/bin/sample',fields[0],'5','-file',str(out/(name+'-sample-'+fields[0]+'.txt'))],timeout=20,check=False)
                except (OSError,subprocess.TimeoutExpired):pass
        try:os.killpg(p.pid,signal.SIGTERM)
        except ProcessLookupError:pass
        try:p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            p.wait(timeout=10)
        code=124
    results.append({'phase':name,'command':args,'exit_code':code,'timed_out':timed_out,'seconds':round(time.monotonic()-start,3)})
    (out/'test-phases.json').write_text(json.dumps(results,indent=2)+'\n')
    if code:raise SystemExit(code)
phase('compile',['swift','build','--build-tests','--jobs','3'],480)
# One successful Intel run spent 381 seconds in native scroll/layout stress tests.
# Retain every test and allow measured slow-run behavior rather than weakening it.
phase('execute',['swift','test','--skip-build'],540)
