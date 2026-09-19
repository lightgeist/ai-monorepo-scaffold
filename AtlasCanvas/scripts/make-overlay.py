#!/usr/bin/env python3
"""Prepare the exact source delta relative to the pinned upstream for connector transport."""
import pathlib,subprocess,json,gzip,base64,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
files={}
for name in subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines():
 p=root/name
 if not p.is_file() or name.endswith(('.png','.jpg','.jpeg','.zip')) or name.startswith(('evidence/','.github/','incoming/')):continue
 files[name]=p.read_text()
raw=json.dumps({'upstream':'a19db9011282399785dc18efcfded904627bdcc2','files':files,'patch':subprocess.check_output(['git','diff','--no-ext-diff','--binary','HEAD'],cwd=root,text=True),'deleted':[]},sort_keys=True,separators=(',',':')).encode()
encoded=base64.b64encode(gzip.compress(raw,compresslevel=9,mtime=0)).decode()
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/mnt/data/atlascanvas-work/overlay.b64');out.write_text(encoded+'\n')
print('FILES',len(files),'RAW',len(raw),'BASE64',len(encoded),'SHA256',hashlib.sha256(raw).hexdigest())
print(encoded)
