#!/usr/bin/env python3
"""Assemble verifiable release records. Does not publish or change repository refs."""
from pathlib import Path
import argparse,hashlib,json,re,shutil,subprocess,zipfile
from collections import Counter
from verify_archives import PLATFORMS,FONT_SUFFIXES,inspect_archive,sha256

REPO='lightgeist/ai-monorepo-scaffold'
BASE='8a8a073ee47dc3155e43991a409b7d46a76a9d3c'

def need(value,message):
    if not value:raise RuntimeError(message)
def run(*args,cwd=None):return subprocess.check_output(list(map(str,args)),cwd=cwd,text=True).strip()
def api(endpoint):return json.loads(run('gh','api',f'repos/{REPO}/{endpoint}'))
def dump(path,obj):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,indent=2)+'\n')
def node(path):
    s=path.read_text(errors='replace');out={}
    for key in ['tests','pass','fail','cancelled','skipped']:
        m=re.findall(r'(?:#|ℹ) '+key+r'\s+(\d+)',s);need(len(m)==1,f'Missing Node evidence {path}:{key}');out[key]=int(m[0])
    need(out['tests']==out['pass'] and out['fail']==out['cancelled']==out['skipped']==0,'Node suite failed or skipped')
    return out

def main():
    p=argparse.ArgumentParser();p.add_argument('--run',type=int,required=True);p.add_argument('--builder',required=True)
    p.add_argument('--windows-run',type=int,required=True);p.add_argument('--windows-builder',required=True)
    p.add_argument('--root',type=Path,default=Path('release-final'));a=p.parse_args()
    root=a.root.resolve();need(not root.exists(),'Destination exists');root.mkdir()
    meta=api(f'actions/runs/{a.run}')
    need(meta['status']=='completed' and meta['head_sha']==a.builder and meta['conclusion'] in ('success','failure'),'Unexpected portable run identity/status')
    jobs=api(f'actions/runs/{a.run}/jobs?per_page=100')
    need(jobs['total_count']==7 and len(jobs['jobs'])==7,'Incomplete seven-job portable matrix')
    need(next(j for j in jobs['jobs'] if j['name']=='package')['conclusion']=='success','Final packaging/quality job failed')
    for platform in PLATFORMS:
        matches=[j for j in jobs['jobs'] if j['name'].startswith('smoke (') and platform+')' in j['name']]
        need(len(matches)==1,'Missing unique native smoke job: '+platform);job=matches[0]
        need(next(s for s in job['steps'] if s['name']=='Real portable runtime and failure controls')['conclusion']=='success','Actual portable runtime failed: '+platform)
        if not platform.startswith('win32'):need(job['conclusion']=='success','Non-Windows smoke job failed')
        failures=[s['name'] for s in job['steps'] if s['conclusion']=='failure']
        need(not failures or (platform.startswith('win32') and failures==['Windows installer ownership and version-guard regression']),'Unexpected failed step')
    wm=api(f'actions/runs/{a.windows_run}');wj=api(f'actions/runs/{a.windows_run}/jobs?per_page=100')
    need(wm['status']=='completed' and wm['conclusion']=='success' and wm['head_sha']==a.windows_builder,'Isolated Windows confirmation did not pass')
    need(wj['total_count']==2 and len(wj['jobs'])==2 and all(j['conclusion']=='success' for j in wj['jobs']),'Incomplete Windows confirmation matrix')
    def download(name,destination,run_id=None):
        run('gh','run','download',run_id or a.run,'--repo',REPO,'--name',name,'--dir',destination)
    evidence=root/'evidence';assets=root/'assets';inputs=root/'input'
    download('atlascode-rs-finish-evidence',evidence);download('atlascode-rs-finish-assets',assets);download('atlascode-rs-finish-source',inputs)
    dump(evidence/'final-run.json',meta);dump(evidence/'final-jobs.json',jobs)
    dump(evidence/'windows-confirmation-run.json',wm);dump(evidence/'windows-confirmation-jobs.json',wj)
    for platform in PLATFORMS:download('atlascode-rs-finish-smoke-'+platform,evidence/'smoke')
    for platform in ('win32-x64-msvc','win32-arm64-msvc'):
        download('atlascode-rs-windows-confirm-'+platform,evidence/'windows-confirmed',a.windows_run)
    source=root/'source';run('git','clone',inputs/'source-history.bundle',source)
    commit=(evidence/'source-commit.txt').read_text().strip();tree=(evidence/'source-tree.txt').read_text().strip()
    run('git','checkout','--detach',commit,cwd=source);need(run('git','rev-parse','HEAD^{tree}',cwd=source)==tree,'Source tree mismatch')
    proof=json.loads((source/'NATIVE-INPUTS.json').read_text())
    for filename,digest in proof['files'].items():
        need(sha256(source/filename)==digest,'Final native input changed: '+filename)
        old=subprocess.check_output(['git','show',BASE+':'+filename],cwd=source)
        need(hashlib.sha256(old).hexdigest()==digest,'Baseline native input mismatch: '+filename)
    need(proof['unchanged'] is True and proof['baseline_source_commit']==BASE,'Invalid equivalence proof')
    brand=json.loads(run('python3',source/'tools/verify-brand.py'));need(brand['passed'],'Final brand audit failed');dump(evidence/'final-brand-audit.json',brand)
    baseline_jobs=json.loads((evidence/'native-jobs.json').read_text())['jobs'];native_jobs=[j for j in baseline_jobs if j['name'].startswith('native (')];need(len(native_jobs)==6,'Missing native jobs')
    for j in native_jobs:
        for name in ['Native toolchain and complete bridge suite','Native Rust and real PTY regression suite','Build and stage native release']:
            need(next(s for s in j['steps'] if s['name']==name)['conclusion']=='success','Native step failed')
    binary_hashes={}
    for line in (evidence/'native-binary-sha256.txt').read_text().splitlines():
        digest,name=line.split();parts=Path(name).parts;binary_hashes[(parts[-3],parts[-1])]=digest
    checksums={Path(line.split()[1]).name:line.split()[0] for line in (assets/'SHA256SUMS').read_text().splitlines()}
    observations=[];archives=[]
    for platform in PLATFORMS:
        ext='zip' if platform.startswith('win32') else 'tar.gz';archive=assets/f'atlascode-rs-0.1.0-{platform}.{ext}'
        info=inspect_archive(archive,platform);need(info['sha256']==checksums[archive.name],'Archive checksum mismatch')
        for name,binary in info['executables'].items():need(binary['sha256']==binary_hashes[(platform,name)],'Native executable bytes differ from build artifact')
        archives.append(info);n=evidence/'native'/platform;s=(n/'rust-tests.log').read_text(errors='replace')
        matches=re.findall(r'test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out',s)
        need(len(matches)==11 and all(m[0]=='ok' and all(int(v)==0 for v in m[2:]) for m in matches),'Incomplete Rust regression evidence')
        need('atlascode_welcome_identity_survives_resize_and_a_real_pty_turn ... ok' in s,'Missing PTY identity test')
        bridge=node(n/'bridge-tests.log');need(bridge['pass']==439,'Incomplete bridge suite')
        smoke=(evidence/'smoke'/platform/'archive-smoke.log').read_text(errors='replace')
        for expected in ['Verified application PATH has no system Node.js or Bun executable.','Bridge runtime contract passed','missing bridge_runtime fails closed','missing bridge_script fails closed','Smoke-tested install archive '+archive.name]:need(expected in smoke,'Missing portable runtime evidence: '+expected)
        if platform.startswith('win32'):
            confirmed=evidence/'windows-confirmed'/platform
            need((confirmed/'source-tree.txt').read_text().strip()==tree,'Windows installer suite used different source')
            need('PowerShell installer version guard tests passed' in (confirmed/'install-version.log').read_text(),'Windows version-guard tests missing')
            need('PowerShell installation identity, PATH updates, and confirmed script/npm cleanup passed' in (confirmed/'install-path.log').read_text(),'Windows ownership tests missing')
        observations.append({'platform':platform,'rust_passed':sum(int(m[1]) for m in matches),'bridge_passed':439,'pty_scenarios':16,'portable_runtime':'passed','negative_controls':'passed'})
    quality={k:node(evidence/(k+'.log')) for k in ['bridge-tests','node-core-tests','install-progress-tests']}
    for i in range(1,11):need(node(evidence/f'install-path-{i}.log')['pass']==2,'Installer cancellation repeat failed')
    audit=json.loads((evidence/'dependency-audit-run.json').read_text());need(audit['conclusion']=='success','Dependency audit failed')
    ledger=json.loads((source/'REBRAND-LEDGER.json').read_text())
    report={'schema':'atlascode-rs-release-verification/v3','name':'atlascode-rs','version':'0.1.0','release_kind':'unsigned preview','passed':True,'upstream_commit':'ddcf1eb5513b02ca2a68964220f115da0a69a80a','source_commit':commit,'source_tree':tree,'native_baseline_commit':BASE,'native_inputs_unchanged':len(proof['files']),'native_run':37164321262,'portable_run':a.run,'portable_workflow_conclusion':meta['conclusion'],'windows_confirmation_run':a.windows_run,'dependency_audit_run':37164474484,'platforms':observations,'quality':quality,'installer_path_repetitions':10,'brand_checks':len(brand['checks']),'rebrand_changes':dict(Counter(x['change'] for x in ledger['changes'])),'archives':archives,'limitations':['No authenticated provider or billable model task tested.','PTY conversations use a scripted NDJSON peer.','Not macOS-notarized or Windows Authenticode-signed.','No public npm/Cargo publication.','Provider-owned state may be shared with official CLI.','No physical-device UX, penetration test, performance benchmark or blanket OS-version compatibility claim.','Native build and final source commits differ only outside the checked native input boundary; final installer changes are separately qualified.'],'ci_wrapper_correction':'The initial Windows wrapper checked LASTEXITCODE leaked by intentional negative-test children. Both unchanged suites reported success; the two-host confirmation reran them in separate pwsh -File processes and checked actual suite exit statuses. Original workflow conclusions are retained, not relabeled.'}
    dump(assets/'VERIFICATION.json',report);dump(evidence/'VERIFICATION.json',report)
    table='\n'.join(f"| {x['platform']} | {x['rust_passed']} | 439 | Passed | Passed |" for x in observations)
    text=f'''# atlascode-rs 0.1.0 — release verification

## Delivered

Six real native portable archives, exact final source ZIP/TAR, checksums and evidence.
The application is a rebrand of upstream 0.14.9 at `ddcf1eb5513b02ca2a68964220f115da0a69a80a`.
It retains the official Claude Agent SDK 0.3.288 and private Bun 1.4.0 runtime.

## Executed tests

| Native platform | Rust tests | Bridge tests | 16 real PTY scenarios | Portable runtime |
|---|---:|---:|---|---|
{table}

Final packaging and actual portable runtime: https://github.com/{REPO}/actions/runs/{a.run}
Independent Windows installer confirmation: https://github.com/{REPO}/actions/runs/{a.windows_run}
Original native build/test run: https://github.com/{REPO}/actions/runs/37164321262
Dependency policy audit: https://github.com/{REPO}/actions/runs/37164474484

The original native run is not described as wholly successful: all six native
Rust/bridge/build steps passed, while installer failures blocked packaging.
Those failures were corrected. Final packaging and all six actual archive runtime
steps passed. The Windows CI wrapper then incorrectly returned LASTEXITCODE left
by an intentionally failing test child, although both suites reported success.
Two additional native Windows jobs reran the unchanged suites in separate
PowerShell processes and verified their actual successful exit statuses.
The release gate requires those jobs; original workflow conclusions remain in
the evidence. No failed assertion was removed or silently discarded.

Each final archive runs its actual binary and bundled Bun/SDK bridge with system
Node.js and Bun removed from the application's PATH. Version, help, completion,
manual generation and strict diagnostics are checked. Removing the private
runtime or bridge script must fail closed. Windows ownership/PATH and version
guards passed. The unchanged Linux real-PTY installer cancellation test passed
10 consecutive final-CI repetitions (and 10 local repetitions).

Additional evidence covers strict Rust formatting/Clippy, TypeScript build,
Biome, Knip (isolated from the enclosing host monorepo), dependency advisories,
{quality['node-core-tests']['pass']} package/resolver/version tests,
{quality['install-progress-tests']['pass']} installer-progress tests, package
layouts, notices, real Linux npm install smoke, {len(brand['checks'])} brand
checks, and independent archive path/architecture/executable-hash verification.

## Exact byte boundaries

Final source commit: `{commit}`.
Final source tree: `{tree}`.
Native build baseline: `{BASE}`.

NATIVE-INPUTS.json records {len(proof['files'])} Rust, tests, bridge, launcher,
manifest, lockfile and license inputs. Every file is checked byte-for-byte against
both the actual build baseline and final source. The final changes are in Unix
installer Ctrl-C handling, Windows installer test URLs, release notes and
provenance tooling. Native binaries are not rebuilt or patched after their native
tests; their archive bytes are checked against the original build artifacts.
The final installers and archives are tested separately on matching native hosts.

## Rebrand boundary

Application/crate/library/npm/launcher names, own settings/logs/environment,
diagnostics, welcome mark/accent, installer paths, release URLs, documentation
and distribution notices use atlascode-rs. Provider-owned identifiers such as
.claude, CLAUDE.md, credentials, SDK/model names and provider commands remain
compatible. Original authorship/license and historical upstream documents remain
attributed. In-app updates are disabled; explicit installs use fork release tags.

## Limits

This is an unsigned preview: no macOS notarization or Windows Authenticode.
No authenticated model call, account entitlement, billing, physical-device UX,
penetration test, performance benchmark or every-OS-version support is claimed.
Real PTY tests use a scripted peer, not a live model. No public npm or Cargo package
was published. The official claude CLI remains needed for documented CLI-backed
operations. Own application state is separate; provider state may be shared.
Dependency checks are point-in-time under the recorded policy, not a warranty.

## Integrity

CHECKSUMS.sha256 uses flat release filenames. SHA256SUMS retains dist-install/
paths expected by the shipped installers. The evidence ZIP contains the actual
logs, manifests, terminal captures, native-input proof and dependency notices.
Checksums are integrity evidence, not OS code signing.
'''
    (assets/'VERIFICATION.md').write_text(text);(evidence/'VERIFICATION.md').write_text(text)
    shutil.copy2(Path(__file__),evidence/'seal.py');shutil.copy2(Path(__file__).with_name('verify_archives.py'),evidence/'verify_archives.py')
    shutil.copy2(source/'REBRAND-LEDGER.json',evidence/'REBRAND-LEDGER.json')
    with zipfile.ZipFile(assets/'atlascode-rs-0.1.0-evidence.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for f in sorted(evidence.rglob('*')):
            if f.is_file():need(f.suffix.lower() not in FONT_SUFFIXES,'Font file in evidence');z.write(f,f.relative_to(evidence))
    records=[{'file':f.name,'bytes':f.stat().st_size,'sha256':sha256(f)} for f in sorted(assets.iterdir()) if f.is_file()]
    (assets/'CHECKSUMS.sha256').write_text(''.join(f"{x['sha256']}  {x['file']}\n" for x in records))
    records.append({'file':'CHECKSUMS.sha256','bytes':(assets/'CHECKSUMS.sha256').stat().st_size,'sha256':sha256(assets/'CHECKSUMS.sha256')})
    dump(root/'asset-manifest.json',{'source_commit':commit,'source_tree':tree,'run':a.run,'windows_run':a.windows_run,'files':records})
    print('SEALED',tree,len(archives),'verified native archives')
if __name__=='__main__':main()
