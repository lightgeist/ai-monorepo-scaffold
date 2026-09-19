"""Acquire one author-created source overlay; verify bytes before applying code."""
import pathlib,json,hashlib,gzip,urllib.request,subprocess,shutil,os
root=pathlib.Path.cwd(); spec=json.loads((root/'incoming/wave.json').read_text()); cache=root/'incoming'/('wave-'+spec['wave']+'.json.gz')
if not cache.exists():
    req=urllib.request.Request(spec['url'],headers={'User-Agent':'AtlasCanvas-authorized-build'})
    with urllib.request.urlopen(req,timeout=60) as response: data=response.read(8*1024*1024+1)
    if len(data)>8*1024*1024: raise RuntimeError('Overlay limit exceeded')
else: data=cache.read_bytes()
if hashlib.sha256(data).hexdigest()!=spec['gzip_sha256']: raise RuntimeError('Transport hash mismatch')
raw=gzip.decompress(data)
if len(raw)>16*1024*1024 or hashlib.sha256(raw).hexdigest()!=spec['raw_sha256']: raise RuntimeError('Source hash mismatch')
overlay=json.loads(raw)
if overlay['upstream']!=spec['upstream']: raise RuntimeError('Wrong upstream')
cache.write_bytes(data)
source=root/'AtlasCanvas'
if source.exists(): shutil.rmtree(source)
subprocess.run(['git','clone','--no-checkout','--filter=blob:none','https://github.com/robbietilton/Compositor.git',str(source)],check=True)
subprocess.run(['git','checkout',spec['upstream']],cwd=source,check=True)
patch=overlay['patch'].encode()
if patch:
    subprocess.run(['git','apply','--check','-'],input=patch,cwd=source,check=True)
    subprocess.run(['git','apply','-'],input=patch,cwd=source,check=True)
for name,text in overlay['files'].items():
    path=pathlib.PurePosixPath(name)
    if path.is_absolute() or any(x in ('..','.git') for x in path.parts): raise RuntimeError('Unsafe source path')
    dest=source.joinpath(*path.parts); dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(text)
for name in overlay.get('deleted',[]):
    path=pathlib.PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '.git' in path.parts: raise RuntimeError('Unsafe deletion')
    dest=source.joinpath(*path.parts)
    if dest.is_file(): dest.unlink()
shutil.rmtree(source/'.git')
# The URL grants access to this source overlay only, and is short-lived. Do not retain it in the current tree.
spec.pop('url',None); (root/'incoming/wave.json').write_text(json.dumps(spec,indent=2)+'\n')
print('Verified source overlay',spec['wave'],spec['raw_sha256'],len(overlay['files']))
