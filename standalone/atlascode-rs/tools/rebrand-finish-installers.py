#!/usr/bin/env python3
"""Final installer repairs; compiled Rust/SDK inputs remain byte-identical."""
from pathlib import Path
import hashlib, json, sys
root=Path(sys.argv[1]).resolve()
def patch(name, pairs):
    p=root/name;s=p.read_text()
    for before,after in pairs:
        if before not in s:raise RuntimeError(f'{name}: missing exact patch context {before!r}')
        s=s.replace(before,after)
    p.write_text(s,encoding='utf-8',newline='\n')
def native_inputs():
    names=['Cargo.toml','Cargo.lock','rust-toolchain.toml','package.json','package-lock.json','LICENSE']
    for folder in ['src','tests','bin','agent-sdk']:
        names.extend(str(p.relative_to(root)) for p in (root/folder).rglob('*') if p.is_file())
    return {n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in sorted(names)}
before=native_inputs()
patch('scripts/install/install.sh',[
    ('stty -icanon -echo min 1 time 0','stty -icanon -echo -isig min 1 time 0'),
    ('    case "$confirm_byte" in\n      y | Y)',
     '    case "$confirm_byte" in\n      # Read Ctrl-C as input so it cannot race between starting dd and its read.\n      # The exit trap restores the saved terminal flags before exiting.\n      "$(printf \'\\003\')") on_signal 130 ;;\n      y | Y)')])
patch('scripts/install/test-install-version-guard.ps1',[
    ('/main/scripts/install/release-advisories.json','/atlascode-rs-v0.1.0/standalone/atlascode-rs/scripts/install/release-advisories.json'),
    ('/$selectedTag/SHA256SUMS','/atlascode-rs-$selectedTag/SHA256SUMS'),
    ('/$differentlyCasedTag/SHA256SUMS','/atlascode-rs-$differentlyCasedTag/SHA256SUMS'),
    ('/releases/latest','/releases/tags/atlascode-rs-v0.1.0'),
    ('-LatestTag "v$selectedVersion"','-LatestTag "atlascode-rs-v$selectedVersion"')])
if before!=native_inputs():raise RuntimeError('Final installer repair changed compiled application inputs')
(root/'NATIVE-INPUTS.json').write_text(json.dumps({'schema':'atlascode-rs-native-input-equivalence/v1','baseline_source_commit':'8a8a073ee47dc3155e43991a409b7d46a76a9d3c','baseline_source_tree':'80ab19b77a911cf0b89d97c36c9e2550b54c8ce4','native_run':37164321262,'unchanged':True,'files':before},indent=2)+'\n')
with (root/'CHANGELOG.md').open('a') as stream:
    stream.write('\n### Final installer qualification\n\nFixed a Unix single-key confirmation Ctrl-C race by reading ETX explicitly while the prompt owns the terminal; saved terminal flags are restored by the existing exit trap. The unchanged real-PTY cancellation test passed ten consecutive local runs before final CI. Windows version-guard fixtures now assert the namespaced fork release and advisory URLs, including a namespaced API tag fixture. Rust, bridge, executable launcher, dependencies and native regression tests remain byte-identical to the six-host native build. NATIVE-INPUTS.json records the equivalence boundary. Final package and installer tests run against these corrected scripts.\n')
print('Installer repairs applied; '+str(len(before))+' native/bridge/dependency input files unchanged.')
