from pathlib import Path
import base64, hashlib, io, tarfile, sys, subprocess
kit=Path(__file__).parent
raw=base64.b64decode(''.join((kit/f'overlay.{i}.b64').read_text().strip() for i in range(4)),validate=True)
assert hashlib.sha256(raw).hexdigest()=='f2f5341fc2a1465e2a0b22479a33b547aca04300f1706fba2a897bada6add042','Overlay checksum mismatch'
root=Path(sys.argv[1]).resolve()
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as t:
    for m in t.getmembers():
        p=(root/m.name).resolve()
        assert root in p.parents and m.isfile(),'Unsafe overlay member'
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(t.extractfile(m).read())
        p.chmod(m.mode)
print('Applied verified authored overlay')
subprocess.run([sys.executable,str(kit/'fixes.py'),str(root)],check=True)
subprocess.run([sys.executable,str(kit/'finish.py'),str(root)],check=True)
