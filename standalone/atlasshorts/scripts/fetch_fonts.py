"""Download optional pinned font assets; none are embedded in the release."""
from pathlib import Path
import hashlib,json,urllib.request,os,tempfile
root=Path(__file__).resolve().parent.parent
for item in json.loads((root/'scripts/font-assets.json').read_text()):
 dst=root/item['path']
 if dst.exists() and hashlib.sha256(dst.read_bytes()).hexdigest()==item['sha256']:continue
 with urllib.request.urlopen(item['url'],timeout=60) as resp:data=resp.read()
 if hashlib.sha256(data).hexdigest()!=item['sha256']:raise SystemExit('Integrity failure: '+item['path'])
 dst.parent.mkdir(parents=True,exist_ok=True)
 fd,tmp=tempfile.mkstemp(dir=dst.parent)
 try:
  with os.fdopen(fd,'wb') as out:out.write(data)
  os.replace(tmp,dst)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
 print('Verified',item['path'])
(root/'dashboard/public/fonts.css').write_text((root/'scripts/fonts.css.template').read_text())
(root/'dashboard/src/remotion/lib/fonts.ts').write_text((root/'scripts/remotion-fonts-dashboard.template').read_text())
(root/'remotion/src/lib/fonts.ts').write_text((root/'scripts/remotion-fonts-remotion.template').read_text())
