#!/usr/bin/env python3
"""Read-only assembly gate. Never publishes, changes refs, or invokes provider APIs."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, sys, zipfile
from collections import Counter
from pathlib import Path
from verify_archives import PLATFORMS, FONT_SUFFIXES, inspect_archive, sha256

REPO='lightgeist/ai-monorepo-scaffold'
BRANCH='atlascode-rs/rebrand-20261004'
UPSTREAM='ddcf1eb5513b02ca2a68964220f115da0a69a80a'
VERSION='0.1.0'

def require(condition, message):
    if not condition:raise RuntimeError(message)

def run(*args, cwd=None):
    return subprocess.check_output([str(a) for a in args],cwd=cwd,text=True,stderr=subprocess.STDOUT).strip()

def api(endpoint):return json.loads(run('gh','api',f'repos/{REPO}/{endpoint}'))
def save(path, obj):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,indent=2)+'\n')

def gate(run_id:int, builder:str, count:int):
    meta=api(f'actions/runs/{run_id}')
    require(meta['conclusion']=='success' and meta['status']=='completed','Run is not successfully completed')
    require(meta['head_sha']==builder and meta['head_branch']==BRANCH,'Unexpected run source')
    jobs=api(f'actions/runs/{run_id}/jobs?per_page=100&filter=latest')
    require(jobs['total_count']==count and len(jobs['jobs'])==count,'Unexpected/truncated job matrix')
    require(all(j['conclusion']=='success' for j in jobs['jobs']),'A qualification job did not pass')
    return {'run_id':run_id,'builder':builder,'url':meta['html_url'],'status':'success','jobs':[{k:j[k] for k in ('id','name','conclusion')} for j in jobs['jobs']]}

def node_summary(path):
    text=path.read_text(errors='replace')
    result={}
    for key in ('tests','pass','fail','cancelled','skipped'):
        matches=re.findall(r'(?:#|ℹ) '+key+r'\s+(\d+)',text)
        require(len(matches)==1,f'Incomplete node test evidence {path}: {key}')
        result[key]=int(matches[0])
    require(result['tests']==result['pass'] and not any(result[k] for k in ('fail','cancelled','skipped')),f'Incomplete/failing Node suite {path}')
    return result

def rust_summary(path):
    text=path.read_text(errors='replace')
    matches=re.findall(r'test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out',text)
    require(len(matches)>=10,'Truncated Rust all-targets log')
    require(all(m[0]=='ok' and all(int(v)==0 for v in m[2:]) for m in matches),'Rust tests failed/skipped/filtered')
    require('atlascode_welcome_identity_survives_resize_and_a_real_pty_turn ... ok' in text,'Missing actual PTY identity test')
    return {'passed':sum(int(m[1]) for m in matches),'test_binaries':len(matches),'failed':0,'ignored':0,'filtered_out':0}

def zip_tree(source, destination):
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(source.rglob('*')):
            if p.is_file():
                require(not p.is_symlink() and p.suffix.lower() not in FONT_SUFFIXES,'Unsafe evidence member')
                z.write(p,p.relative_to(source))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--run',type=int,required=True);ap.add_argument('--builder',required=True)
    ap.add_argument('--audit-run',type=int,required=True);ap.add_argument('--audit-builder',required=True)
    ap.add_argument('--output',type=Path,default=Path('release-stage'))
    a=ap.parse_args();root=a.output.resolve();require(not root.exists(),'Assembly destination already exists')
    root.mkdir();inputs=root/'inputs';inputs.mkdir();assets=root/'assets';assets.mkdir();evidence=root/'evidence';evidence.mkdir()
    qualification=gate(a.run,a.builder,15);audit_gate=gate(a.audit_run,a.audit_builder,1)
    save(evidence/'qualification-gate.json',qualification);save(evidence/'audit-gate.json',audit_gate)
    inventory=api(f'actions/runs/{a.run}/artifacts?per_page=100')
    require(inventory['total_count']==len(inventory['artifacts']),'Truncated artifact inventory')
    save(evidence/'artifacts.json',inventory)
    expected_names={'atlascode-rs-prepared','atlascode-rs-quality-evidence','atlascode-rs-package-evidence'}
    expected_names.update('atlascode-rs-'+prefix+'-'+p for prefix in ('native','install','smoke') for p in PLATFORMS)
    selected={x['name']:x for x in inventory['artifacts'] if x['name'] in expected_names}
    require(set(selected)==expected_names,'Missing release input artifact')
    require(all(not x['expired'] and x['workflow_run']['head_sha']==a.builder for x in selected.values()),'Expired/mismatched artifact')
    def download(name, run_id=a.run):
        target=inputs/name
        print('Retrieve',name,flush=True)
        run('gh','run','download',run_id,'--repo',REPO,'--name',name,'--dir',target)
        return target
    prepared=download('atlascode-rs-prepared');quality=download('atlascode-rs-quality-evidence');package=download('atlascode-rs-package-evidence')
    audit=download('atlascode-rs-dependency-audit',a.audit_run)
    source_commit=(prepared/'evidence/source-commit.txt').read_text().strip();source_tree=(prepared/'evidence/source-tree.txt').read_text().strip()
    require((prepared/'evidence/builder-commit.txt').read_text().strip()==a.builder,'Prepared source builder mismatch')
    for line in (prepared/'evidence/source-sha256.txt').read_text().splitlines():
        digest,filename=line.split();require(sha256(prepared/Path(filename).name)==digest,'Prepared artifact checksum mismatch')
    require((audit/'audited-source-tree.txt').read_text().strip()==source_tree,'Dependency audit was not run on the final source')
    require(json.loads((audit/'dependency-identity-audit.json').read_text())['passed'],'Audit source identity failed')
    source=root/'source';run('git','clone',prepared/'atlascode-rs-history.bundle',source)
    run('git','checkout','--detach',source_commit,cwd=source)
    require(run('git','rev-parse','HEAD^{tree}',cwd=source)==source_tree,'Source tree mismatch')
    require(run('git','status','--porcelain',cwd=source)=='','Source checkout is dirty')
    audit_text=run(sys.executable,source/'tools/verify-brand.py');brand=json.loads(audit_text);require(brand['passed'],'Brand audit failed')
    save(evidence/'brand-audit.json',brand)
    checksums={Path(line.split()[1]).name:line.split()[0] for line in (package/'SHA256SUMS').read_text().splitlines()}
    observations=[];archive_results=[]
    for platform in PLATFORMS:
        native=download('atlascode-rs-native-'+platform)
        smoke=download('atlascode-rs-smoke-'+platform)
        install=download('atlascode-rs-install-'+platform)
        extension='zip' if platform.startswith('win32') else 'tar.gz'
        name=f'atlascode-rs-{VERSION}-{platform}.{extension}';archive=install/name
        require(sha256(archive)==checksums[name],'Archive does not match packaging checksum')
        item=inspect_archive(archive,platform);archive_results.append(item)
        n=native/'evidence'/platform;metadata=(n/'build-metadata.txt').read_text()
        require('builder_commit='+a.builder in metadata and source_tree in metadata,'Native build source mismatch')
        rust=rust_summary(n/'rust-tests.log');bridge=node_summary(n/'bridge-tests.log')
        require(bridge['tests']==439,'Incomplete full bridge suite')
        for binary,details in item['executables'].items():
            require(sha256(native/'dist-platform'/platform/'bin'/binary)==details['sha256'],'Archive binary differs from tested native build')
        smoke_log=(smoke/platform/'archive-smoke.log').read_text(errors='replace')
        for phrase in ['Verified application PATH has no system Node.js or Bun executable.','Bridge runtime contract passed','missing bridge_runtime fails closed','missing bridge_script fails closed','Smoke-tested install archive '+name]:
            require(phrase in smoke_log,'Missing real portable smoke evidence: '+phrase)
        captures=n/'terminal-captures'
        require(all((captures/f).is_file() for f in ('welcome.txt','welcome.ansi','mock-turn.txt','mock-turn.ansi')),'Missing PTY captures')
        shutil.copytree(n,evidence/'native'/platform);shutil.copytree(smoke/platform,evidence/'smoke'/platform)
        shutil.copy2(archive,assets/name)
        observations.append({'platform':platform,'rust':rust,'bridge':bridge,'native_build':True,'real_pty':True,'portable_smoke':True,'missing_file_negative_controls':True})
        shutil.rmtree(native);shutil.rmtree(install)
    quality_summary={n:node_summary(quality/(n+'.log')) for n in ['bridge-tests','node-core-tests','install-path-tests','install-progress-tests']}
    require(sum(quality_summary[n]['tests'] for n in ['node-core-tests','install-path-tests','install-progress-tests'])==60,'Incomplete packaging regression tests')
    shutil.copytree(quality,evidence/'quality');shutil.copytree(package,evidence/'package');shutil.copytree(prepared/'evidence',evidence/'source')
    for name in ('AUDIT-SCOPE.txt','audited-source-tree.txt','dependency-identity-audit.json','rust-dependency-inventory.json','rust-doc-tests.log'):
        shutil.copy2(audit/name,evidence/name)
    shutil.copy2(source/'deny.toml',evidence/'deny.toml')
    inv=json.loads((audit/'rust-dependency-inventory.json').read_text())
    doc_matches=re.findall(r'test result: ok\. (\d+) passed', (audit/'rust-doc-tests.log').read_text())
    require(doc_matches==['0'],'Unexpected doctest result; inspect before reporting')
    ledger=json.loads((source/'REBRAND-LEDGER.json').read_text())
    report={'schema':'atlascode-rs-release-qualification/v1','version':VERSION,'upstream_commit':UPSTREAM,
      'source_commit':source_commit,'source_tree':source_tree,'builder_commit':a.builder,
      'qualification':qualification,'dependency_audit':audit_gate,'platforms':observations,'quality':quality_summary,
      'brand_audit_checks':len(brand['checks']),'runtime_files_scanned':brand['runtime_files_scanned'],
      'rebrand_changes':dict(Counter(x['change'] for x in ledger['changes'])),'archives':archive_results,
      'rust_dependency_inventory':{'packages':len(inv['packages']),'root_notice_files':sum(len(p['notices']) for p in inv['packages']),'scope':inv['scope']},
      'doctests':{'command_succeeded':True,'tests_found':0},
      'limitations':['No authenticated provider login or billable model task.','Real PTY uses a scripted NDJSON peer, not a model.','Not macOS-notarized or Windows Authenticode-signed.','No public npm or Cargo publication.','Own app state is isolated; provider state may be shared.','No physical-device UX, penetration test, performance benchmark or all-OS-version compatibility claim.','Dependency audit is point-in-time under the checked-in policy; notice inventory includes build/dev packages and is not a static-link composition or legal opinion.'],
      'passed':True}
    save(assets/'VERIFICATION.json',report);save(evidence/'VERIFICATION.json',report)
    table='\n'.join(f"| {x['platform']} | {x['rust']['passed']} | {x['bridge']['pass']} | Passed | Passed |" for x in observations)
    docs=f'''# atlascode-rs 0.1.0 — release verification

## Release identity

Independent rebrand of claude-code-rust 0.14.9 at `{UPSTREAM}`.
Qualified source commit: `{source_commit}`.
Qualified source tree: `{source_tree}`.
Builder recipe commit: `{a.builder}`.

The source archives, native build metadata and package manifests bind to this
same source tree. Native binary bytes are checked against the original native
build artifacts before release. There is no post-test runtime patch.

## Executed qualification

[Native qualification]({qualification['url']}) — all 15 jobs passed.
[Dependency policy audit]({audit_gate['url']}) — passed on the same source tree.

| Native host/architecture | Rust tests passed | Bridge tests passed | Real PTY | Real portable archive |
|---|---:|---:|---|---|
{table}

The 439-test bridge suite runs on every platform. Its recursive glob is quoted
so Unix does not silently omit root-level tests. Rust tests include CLI/config,
logging, rendering, permission/protocol behavior and 16 real pseudo-terminal
scenarios. PTY conversations use a scripted peer, not authenticated inference.

Additional executed gates: strict Rust formatting and Clippy with warnings as
errors; bridge TypeScript build, Biome and Knip; npm dependency audit; 60 Node
packaging/installer regression tests; all six real package layouts; real Linux
npm install smoke; original LICENSE hash and locked dependency graph preservation;
{len(brand['checks'])} identity/provenance checks across {brand['runtime_files_scanned']}
runtime/tooling files; independent archive path, architecture, byte-hash, runtime,
SDK-version, notice and no-font-binary checks. `cargo test --doc` succeeded but
found **zero doctests** and is not counted as additional test coverage.

Each portable test executes the real binary with system Node.js and Bun removed
from its PATH. It checks exact version, help, generated completions/manuals,
strict diagnostics and the actual bundled Bun/SDK bridge protocol. Removing the
private runtime or bridge script must fail closed; the original files are then
restored. No provider credentials or billable calls are supplied.

## Changes and repairs

The rebrand covers Cargo/library/binary/npm names, launcher and private runtime,
TUI wordmark/accent, own settings/logs/environment variables, diagnostic schemas,
release URLs, installers, manuals, contributor guidance and distribution notices.
Original copyright and upstream historical documents remain attributed.
Provider-owned `.claude`, `CLAUDE.md`, `CLAUDE_*`, model identifiers, SDK and wire
contracts intentionally remain compatible. In-app update checks and installation
are disabled; explicit installers use namespaced fork release tags.

Native qualification caught and corrected stale branding assertions, incomplete
Unix test discovery, an SDK resolver test-hook boundary, macOS canonical-path
fixtures, a Windows ARM fixture response budget, and a blocked-writer fixture
that could exit during debug serialization. The shutdown test still uses its
50 ms deadline and two-second bound. These fixture changes are recorded in the
source ledger; production SDK behavior and dependency versions are unchanged.

## Checksums and artifacts

`CHECKSUMS.sha256` uses flat release filenames for convenient local verification.
`SHA256SUMS` retains the `dist-install/` paths expected by the shipped installers.
Native archives are the original CI artifacts, not repacked or mock binaries.
The source ZIP/TAR contains the exact qualified source tree. The evidence ZIP
contains full logs, manifests, source patch/ledger metadata and actual terminal
captures. The dependency-notices ZIP includes the inventory of {len(inv['packages'])}
locked Rust dependencies and {sum(len(p['notices']) for p in inv['packages'])} available
root-level license/notice files, including build/dev and non-host packages.
It is not a declaration that all those packages are statically linked.

## Boundaries

This release is not OS-signed/notarized. Provider authentication, billing,
subscription entitlement and real model work were not tested. Public npm/Cargo
publication, physical-device UX, security penetration testing, performance
benchmarks, musl Linux and every historical OS version are not qualified.
Own app state is isolated, but provider state may be shared. Dependency checks
are point-in-time under `deny.toml` (including its warning levels), not a guarantee
of vulnerability absence or a legal opinion. No monitoring or support SLA is
inherited from upstream. See SECURITY.md, NOTICE and MIGRATION.md.
'''
    (assets/'VERIFICATION.md').write_text(docs);(evidence/'VERIFICATION.md').write_text(docs)
    save(evidence/'independent-archive-audit.json',{'passed':True,'archives':archive_results})
    shutil.copy2(Path(__file__),evidence/'assemble.py');shutil.copy2(Path(__file__).with_name('verify_archives.py'),evidence/'verify_archives.py')
    shutil.copy2(prepared/'source.tar.gz',assets/f'atlascode-rs-{VERSION}-source.tar.gz')
    run('git','archive','--format=zip','--prefix=atlascode-rs/',f'--output={assets}/atlascode-rs-{VERSION}-source.zip',source_commit,cwd=source)
    names=run('git','ls-files',cwd=source).splitlines();require(not any(Path(n).suffix.lower() in FONT_SUFFIXES for n in names),'Font in source archive')
    notices=root/'notices';notices.mkdir();shutil.copytree(audit/'rust-dependency-notices',notices/'rust-dependency-notices')
    shutil.copy2(audit/'rust-dependency-inventory.json',notices/'rust-dependency-inventory.json')
    (notices/'README.md').write_text('Root-level notice texts from the exact locked dependency inventory. Includes build/dev and non-host dependencies; not a static-link composition report. Missing root notice files are explicitly represented by empty arrays in the inventory. SDK and Bun notices remain in every native archive. This inventory is not a legal opinion.\n')
    zip_tree(notices,assets/f'atlascode-rs-{VERSION}-dependency-notices.zip')
    zip_tree(evidence,assets/f'atlascode-rs-{VERSION}-evidence.zip')
    (assets/'SHA256SUMS').write_text(''.join(f"{x['sha256']}  dist-install/{x['file']}\n" for x in archive_results))
    manifest=[{'file':p.name,'bytes':p.stat().st_size,'sha256':sha256(p)} for p in sorted(assets.iterdir()) if p.is_file()]
    (assets/'CHECKSUMS.sha256').write_text(''.join(f"{x['sha256']}  {x['file']}\n" for x in manifest))
    manifest.append({'file':'CHECKSUMS.sha256','bytes':(assets/'CHECKSUMS.sha256').stat().st_size,'sha256':sha256(assets/'CHECKSUMS.sha256')})
    save(root/'asset-manifest.json',{'source_commit':source_commit,'source_tree':source_tree,'qualification_run':a.run,'audit_run':a.audit_run,'files':manifest})
    print('ASSEMBLY PASSED:',source_tree, len(archive_results),'native archives')

if __name__=='__main__':main()
