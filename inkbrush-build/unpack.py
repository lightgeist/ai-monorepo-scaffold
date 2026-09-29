from pathlib import Path
import base64,hashlib,io,tarfile,subprocess,sys
base=Path(__file__).parent
encoded=''.join((base/f'kit.{i}.b64').read_text().strip() for i in range(3))
encoded=encoded.replace('QtTaSaSaic','QtTaSaic')
raw=base64.b64decode(encoded,validate=True)
assert hashlib.sha256(raw).hexdigest()=='8a0397d49a75aa0e3a8d8f94b5a76e53d6cb414996ab12c696077fbced9da890','Reviewed kit hash mismatch'
root=(base/'kit').resolve();root.mkdir(exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as tar:
 for member in tar.getmembers():
  p=(root/member.name).resolve()
  assert root in p.parents and member.isfile(),'Unsafe kit member'
  p.parent.mkdir(parents=True,exist_ok=True)
  p.write_bytes(tar.extractfile(member).read());p.chmod(member.mode)
for script in ('fixes.py','relaunch-fix.py'):
 subprocess.run([sys.executable,str(base/script)],check=True)
print('Authored inkbrush kit verified and extracted')
