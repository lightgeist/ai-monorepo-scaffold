from pathlib import Path
import base64,hashlib,json,re,shutil,sys,urllib.request
root=Path(sys.argv[1]).resolve(); kit=Path(__file__).parent
for p in (kit/'quality').glob('normal-launch.*'):
    shutil.copy2(p,root/'scripts'/p.name)
# Paired native/JavaScript bridge identity. Never rewrite generic floor/writer code.
for base in ['Sources','Tests','tools']:
    for p in (root/base).rglob('*'):
        if not p.is_file():continue
        try:s=p.read_text()
        except UnicodeError:continue
        new=s.replace('"flo"','"inknote"').replace('"flo.','"inknote.')
        new=re.sub(r'messageHandlers\.flo\b','messageHandlers.inknote',new)
        new=new.replace('messageHandlers?: { flo?:','messageHandlers?: { inknote?:')
        if new!=s:p.write_text(new)
# Keep the original web-app vendor rebuild instructions as provenance, not as
# active scripts that silently reach into a differently named neighboring repo.
for p in (root/'tools').glob('*/build.sh'):
    target=root/'provenance/vendor-build-tools'/p.parent.name/'build.sh'
    target.parent.mkdir(parents=True,exist_ok=True);shutil.move(p,target)
(root/'tools/README.md').write_text('The native app builds from the checked-in renderer resources. Historical web-app vendor rebuild scripts are preserved in provenance/vendor-build-tools; they require a separate upstream web source and are not an inknote native build prerequisite.\n')
# Retrieve exact reviewed license blobs. These are notices, not runtime dependencies.
licenses=[
 ('KaTeX-MIT.txt','KaTeX/KaTeX','a997eae54b959320cc8769cca3b3db29be74738b'),
 ('CodeMirror-MIT.txt','codemirror/view','96014caf975e32bd908c9b90f1fd023a15911bab'),
 ('Beautiful-Mermaid-MIT.txt','lukilabs/beautiful-mermaid','39f9a13a6c9f1981b195f6dacaebd165caeafbf8'),
 ('DOMPurify-LICENSE.txt','cure53/DOMPurify','ec015d813a191567211f09900e35c18b4ba552740'),
 ('SIL-OFL-1.1.txt','spdx/license-list-data','6fe84ee21ebe5d2b54dc63b53b4d5c404c083409')]
notices=root/'Resources/ThirdPartyNotices';notices.mkdir(parents=True,exist_ok=True)
manifest=[]
for name,repo,sha in licenses:
    url=f'https://api.github.com/repos/{repo}/git/blobs/{sha}'
    req=urllib.request.Request(url,headers={'User-Agent':'inknote-release-build','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req,timeout=30) as response: obj=json.load(response)
    data=base64.b64decode(obj['content'])
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==sha,(name,'License blob mismatch')
    (notices/name).write_bytes(data)
    manifest.append({'file':name,'source':url,'git_blob_sha':sha,'sha256':hashlib.sha256(data).hexdigest()})
(notices/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(notices/'README.txt').write_text('These notices supplement, not replace, copyright and license notices embedded in the checked-in resources. Math-font copyright and Reserved Font Names remain in the unmodified upstream font metadata. Original library names are attribution, not inknote branding.\n')
p=root/'NOTICE.md';p.write_text(p.read_text()+'\nAdditional reviewed third-party license texts are in Resources/ThirdPartyNotices, with immutable source hashes. Original resource headers, font metadata and framework notices remain intact.\n')
p=root/'scripts/bundle.sh';s=p.read_text();needle='python3 scripts/write-plist.py'
assert needle in s
s=s.replace(needle,'ditto "$ROOT/Resources/ThirdPartyNotices" "$APP/Contents/Resources/ThirdPartyNotices"\n'+needle);p.write_text(s)
p=root/'scripts/audit-release.py';p.write_text(p.read_text()+"\nsubprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('normal-launch.py')),str(app),str(out)],check=True)\n")
p=root/'RELEASE.md';p.write_text(p.read_text()+'\nThe final gate also launches the installed application as a separate normal process through the packaged CLI, opens a folder and note through Launch Services, checks single-process reuse, performs normal termination and restarts from the saved session. No acceptance-test entry point is used for that check.\n')
# Ship the exact build recipe alongside the corresponding source.
recipe=root/'provenance/inknote-build-recipe';recipe.mkdir(parents=True,exist_ok=True)
shutil.copytree(kit,recipe,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
shutil.copy2(kit.parent/'.github/workflows/inknote-rebrand.yml',recipe/'workflow.yml')
print('Applied final bridge isolation, verified license notices and normal-launch gate')
