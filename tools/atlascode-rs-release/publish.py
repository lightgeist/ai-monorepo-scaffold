#!/usr/bin/env python3
"""Publish exactly the verified payload; never executes application code or alters main."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess
from pathlib import Path

REPO='lightgeist/ai-monorepo-scaffold'
BRANCH='atlascode-rs/rebrand-20261004'
TAG='atlascode-rs-v0.1.0'
SOURCE_TAG='atlascode-rs-source-v0.1.0'
MAIN='adb14c16c590ecb2489b254bbf9dcf2e6d2e10f3'
SUBDIR='standalone/atlascode-rs'
PLATFORMS=('darwin-arm64','darwin-x64','linux-x64-gnu','linux-arm64-gnu','win32-x64-msvc','win32-arm64-msvc')
ALLOWED={f'atlascode-rs-0.1.0-{p}.'+('zip' if p.startswith('win32') else 'tar.gz') for p in PLATFORMS}
ALLOWED.update({'atlascode-rs-0.1.0-source.zip','atlascode-rs-0.1.0-source.tar.gz','atlascode-rs-0.1.0-evidence.zip','atlascode-rs-0.1.0-dependency-notices.zip','VERIFICATION.md','VERIFICATION.json','SHA256SUMS','CHECKSUMS.sha256'})

def require(condition,message):
    if not condition:raise RuntimeError(message)

def run(*args):
    return subprocess.check_output([str(x) for x in args],text=True,stderr=subprocess.STDOUT).strip()

def api(endpoint):return json.loads(run('gh','api','repos/'+REPO+'/'+endpoint))

def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def get_release():
    result=subprocess.run(['gh','api',f'repos/{REPO}/releases/tags/{TAG}'],capture_output=True,text=True)
    if result.returncode==0:return json.loads(result.stdout)
    require('404' in result.stderr,'Cannot establish whether release already exists: '+result.stderr)
    return None

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assembly-run',required=True,type=int)
    parser.add_argument('--assembly-sha',required=True)
    parser.add_argument('--qualification-run',required=True,type=int)
    parser.add_argument('--qualification-sha',required=True)
    a=parser.parse_args()
    require(os.environ.get('GITHUB_REPOSITORY')==REPO,'Wrong repository')
    require(os.environ.get('GITHUB_REF')=='refs/heads/'+BRANCH,'Wrong publication branch')
    runmeta=api(f'actions/runs/{a.assembly_run}')
    require(runmeta['head_sha']==a.assembly_sha and runmeta['head_branch']==BRANCH,'Wrong assembly source')
    require(runmeta['status']=='completed' and runmeta['conclusion']=='success','Assembly gate has not passed')
    require(api('git/ref/heads/main')['object']['sha']==MAIN,'main changed; re-evaluate before publishing')
    root=Path('publication-input').resolve();require(not root.exists(),'Input destination already exists');root.mkdir()
    run('gh','run','download',a.assembly_run,'--repo',REPO,'--name','atlascode-rs-release-payload','--dir',root/'payload')
    manifest=json.loads((root/'payload/asset-manifest.json').read_text());assets=root/'payload/assets'
    require(manifest['qualification_run']==a.qualification_run,'Wrong qualification reference')
    files=manifest['files'];require(len(files)==len(ALLOWED),'Wrong release asset count')
    expected={x['file']:x for x in files};require(set(expected)==ALLOWED,'Unexpected asset names')
    require({p.name for p in assets.iterdir()}==ALLOWED,'Unexpected payload directory members')
    for name,item in expected.items():
        p=assets/name
        require(p.is_file() and not p.is_symlink(),'Invalid asset type')
        require(p.stat().st_size==item['bytes'] and sha(p)==item['sha256'],'Asset hash mismatch: '+name)
    report=json.loads((assets/'VERIFICATION.json').read_text())
    require(report['passed'] is True and report['version']=='0.1.0','Unqualified product/version')
    require(report['builder_commit']==a.qualification_sha and report['qualification']['run_id']==a.qualification_run,'Qualification source mismatch')
    source=report['source_commit'];tree=report['source_tree']
    require(manifest['source_commit']==source and manifest['source_tree']==tree,'Source metadata disagrees')
    require(all(re.fullmatch('[0-9a-f]{40}',x) for x in (source,tree)),'Invalid Git identities')
    run('gh','run','download',a.qualification_run,'--repo',REPO,'--name','atlascode-rs-prepared','--dir',root/'prepared')
    prepared=root/'prepared'
    require((prepared/'evidence/source-tree.txt').read_text().strip()==tree,'Prepared tree differs')
    require((prepared/'evidence/source-commit.txt').read_text().strip()==source,'Prepared commit differs')
    require((prepared/'evidence/builder-commit.txt').read_text().strip()==a.qualification_sha,'Prepared builder differs')
    for line in (prepared/'evidence/source-sha256.txt').read_text().splitlines():
        digest,name=line.split();require(sha(prepared/Path(name).name)==digest,'Prepared input digest mismatch')
    run('git','fetch',prepared/'atlascode-rs-history.bundle',source)
    require(run('git','rev-parse',source+'^{tree}')==tree,'Fetched source object differs')
    run('git','fetch','origin',BRANCH)
    before=run('git','rev-parse','FETCH_HEAD')
    require(before==os.environ['GITHUB_SHA'],'Branch advanced during publication; no overwrite performed')
    require(run('git','rev-parse','HEAD')==before,'Checkout is not the exact publication recipe')
    require(not Path(SUBDIR).exists(),'Application subdirectory already exists; refusing replacement')
    run('git','read-tree','--prefix='+SUBDIR+'/', '-u',source)
    staged_tree=run('git','write-tree')
    require(run('git','rev-parse',staged_tree+':'+SUBDIR)==tree,'Imported subtree is not byte-identical')
    docs=Path('releases/atlascode-rs/0.1.0');docs.mkdir(parents=True,exist_ok=False)
    for name in ('VERIFICATION.md','VERIFICATION.json','CHECKSUMS.sha256','SHA256SUMS'):
        shutil.copyfile(assets/name,docs/name)
    shutil.copyfile(root/'payload/asset-manifest.json',docs/'asset-manifest.json')
    (docs/'README.md').write_text('# atlascode-rs 0.1.0\n\nVerified native terminal release.\n\nRelease: https://github.com/'+REPO+'/releases/tag/'+TAG+'\n\nSource: `standalone/atlascode-rs`; its exact tree is `'+tree+'`.\nOriginal source commit is retained by `'+SOURCE_TAG+'`.\nSee VERIFICATION.md and VERIFICATION.json for executed tests and explicit limits.\nNo modification or merge of main is performed.\n')
    run('git','add','--',str(docs))
    changed=run('git','diff','--cached','--name-only').splitlines()
    require(changed and all(p.startswith(SUBDIR+'/') or p.startswith(str(docs)+'/') for p in changed),'Unexpected staged change')
    run('git','-c','user.name=atlascode-rs release','-c','user.email=atlascode-rs-release@users.noreply.github.com','commit','-m','release(atlascode-rs): import qualified 0.1.0 source and verification record')
    commit=run('git','rev-parse','HEAD')
    require(run('git','rev-parse',commit+':'+SUBDIR)==tree,'Committed subtree differs')
    existing_tags=run('git','ls-remote','--tags','origin','refs/tags/'+TAG,'refs/tags/'+SOURCE_TAG)
    require(not existing_tags,'A release/source tag already exists; refusing replacement')
    require(get_release() is None,'Release already exists; refusing replacement')
    run('git','push','origin','HEAD:refs/heads/'+BRANCH)
    run('git','tag',SOURCE_TAG,source);run('git','tag',TAG,commit)
    run('git','push','--atomic','origin','refs/tags/'+SOURCE_TAG,'refs/tags/'+TAG)
    native_table='\n'.join(f'| {x["platform"]} | {x["rust"]["passed"]} | {x["bridge"]["pass"]} | Passed |' for x in report['platforms'])
    notes=root/'release-notes.md'
    notes.write_text(f'''# atlascode-rs 0.1.0

An independent, attributed rebrand of claude-code-rust 0.14.9 at
`{report['upstream_commit']}`. Native Rust UI with the official Claude Agent SDK.

## Download and run

Choose the matching OS/architecture portable archive. Keep its extracted directory
together: it contains the app, private Bun runtime, bridge and production SDK.
No separate Node.js, Bun or Rust installation is needed for these archives.
Run `./atlascode-rs --version`, then `./atlascode-rs doctor`; Windows uses
`.\\atlascode-rs.exe`. Read the included START-HERE.md and MIGRATION.md.

Verify the archive with the flat `CHECKSUMS.sha256`. `SHA256SUMS` additionally
retains the paths required by the optional installers. Source and evidence
archives are supplied separately. Npm packages are not publicly published.

## Executed verification

| Native platform | Rust tests | Bridge tests | Extracted archive |
|---|---:|---:|---|
{native_table}

[Full qualification]({report['qualification']['url']}) and
[dependency-policy audit]({report['dependency_audit']['url']}) passed.
Each native archive ran on its matching host without system Node/Bun in the app
PATH; the real bundled bridge and missing-file failure controls were exercised.
Additional packaging, installer, lint, attribution and binary-hash checks are
recorded in VERIFICATION.md/JSON and the evidence archive.

## Branding and safety boundaries

Application/CLI/crate/package names, own settings/logs/environment variables,
terminal identity, diagnostics, installers and release channels are rebranded.
The original license/copyright and provider identifiers remain intact. Own app
state is separate; provider state may be shared. In-app updates are disabled.

**No authenticated provider task, billing entitlement, signing/notarization,
physical-device UX, or security penetration test is claimed.** PTY conversations
use a scripted peer. Provider authentication and terms remain Anthropic's.

Source tree: `{tree}`. Qualified source commit: `{source}`.
[Imported source](https://github.com/{REPO}/tree/{TAG}/{SUBDIR}).
This release does not merge or change `main` and is not the monorepo's latest release.
''')
    run('gh','release','create',TAG,'--repo',REPO,'--verify-tag','--draft','--latest=false','--title','atlascode-rs 0.1.0','--notes-file',notes)
    for name in sorted(ALLOWED):
        print('Uploading verified asset:',name,flush=True)
        run('gh','release','upload',TAG,assets/name,'--repo',REPO)
    release=get_release();require(release is not None and release['draft'] is True,'Expected draft release')
    uploaded={x['name']:x for x in release['assets']}
    require(set(uploaded)==ALLOWED,'Uploaded asset list differs')
    for name,item in expected.items():
        actual=uploaded[name]
        require(actual['state']=='uploaded' and actual['size']==item['bytes'],'Uploaded size/state mismatch: '+name)
        require(actual.get('digest')=='sha256:'+item['sha256'],'GitHub asset digest mismatch: '+name)
    require(api('git/ref/heads/main')['object']['sha']==MAIN,'main changed during publishing')
    require(api('git/ref/tags/'+TAG)['object']['sha']==commit,'Release tag moved')
    run('gh','release','edit',TAG,'--repo',REPO,'--draft=false','--latest=false')
    public=get_release();require(public and public['draft'] is False,'Release not published')
    receipt={'schema':'atlascode-rs-publication-receipt/v1','release_url':public['html_url'],'release_id':public['id'],'release_tag':TAG,'source_tag':SOURCE_TAG,'import_commit':commit,'source_commit':source,'source_tree':tree,'main_unchanged':MAIN,'assembly_run':a.assembly_run,'assembly_sha':a.assembly_sha,'qualification_run':a.qualification_run,'assets':[{k:item[k] for k in ('name','size','digest','browser_download_url')} for item in public['assets']]}
    Path('publication-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('PUBLISHED:',public['html_url'])

if __name__=='__main__':main()
