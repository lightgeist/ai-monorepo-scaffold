#!/usr/bin/env python3
"""Repair installer verification fixtures without changing install behavior."""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
def edit(path,a,b,count=1):
 p=root/path;s=p.read_text();assert s.count(a)==count,(path,a,s.count(a));p.write_text(s.replace(a,b),encoding='utf-8',newline='\n')
p='scripts/install/test-install-version-guard.ps1'
edit(p,'/releases/latest','/releases/tags/atlascode-rs-v0.1.0',2)
edit(p,'-LatestTag "v$selectedVersion"','-LatestTag "atlascode-rs-v$selectedVersion"')
edit(p,'/main/scripts/install/release-advisories.json','/atlascode-rs-v0.1.0/standalone/atlascode-rs/scripts/install/release-advisories.json')
edit(p,'/$selectedTag/SHA256SUMS','/atlascode-rs-$selectedTag/SHA256SUMS')
edit(p,'/$differentlyCasedTag/SHA256SUMS','/atlascode-rs-$differentlyCasedTag/SHA256SUMS')
p='scripts/install/install-path.test.mjs'
s=(root/p).read_text()
start=s.index('  // GNU timeout must preserve the foreground process group for Ctrl-C delivery.')
end=s.index('  assert.equal(status, 130, output);',start)
s=s[:start]+r'''  // Fork a controlling PTY directly: no pipeline shell or timeout process
  // can inherit an ignored SIGINT disposition or steal the foreground group.
  const driver = String.raw`
import base64, errno, os, pty, select, signal, sys, tempfile, time
with tempfile.TemporaryDirectory(prefix="atlascode-cancel-test-") as directory:
    script_path = os.path.join(directory, "fixture.sh")
    with open(script_path, "wb") as stream:
        stream.write(base64.b64decode(sys.argv[1]))
    pid, fd = pty.fork()
    if pid == 0:
        signal.signal(signal.SIGINT, signal.SIG_DFL)
        os.execlp("sh", "sh", script_path)
    output = bytearray()
    cancelled = False
    status = None
    deadline = time.monotonic() + 10
    try:
        while time.monotonic() < deadline:
            ready, _, _ = select.select([fd], [], [], 0.05)
            if ready:
                try:
                    data = os.read(fd, 65536)
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
                    data = b""
                output.extend(data)
            if not cancelled and b"y Yes / N No" in output:
                # Test cancellation while the prompt is accepting input, not
                # the fork-time race immediately after its first output byte.
                time.sleep(0.1)
                os.write(fd, b"\x03")
                cancelled = True
            result, value = os.waitpid(pid, os.WNOHANG)
            if result:
                status = value
                break
        if status is None:
            os.killpg(pid, signal.SIGKILL)
            _, status = os.waitpid(pid, 0)
            sys.stdout.buffer.write(output)
            raise SystemExit("Timed out waiting for actual Ctrl-C cancellation")
        while select.select([fd], [], [], 0)[0]:
            try:
                data = os.read(fd, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                break
            if not data:
                break
            output.extend(data)
        sys.stdout.buffer.write(output)
        if not cancelled:
            raise SystemExit("Confirmation prompt was not observed")
        raise SystemExit(os.waitstatus_to_exitcode(status))
    finally:
        os.close(fd)
`;
  const child = spawn("python3", ["-c", driver, encoded], { env });
  let output = "";
  const status = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.on("close", resolve);
  });
''' +s[end:]
(root/p).write_text(s,encoding='utf-8',newline='\n')
with (root/'CHANGELOG.md').open('a') as f:f.write('\nInstaller qualification uses the fork tag/advisory URLs in PowerShell fixtures and a direct controlling pseudo-terminal for the Unix Ctrl-C test. Ctrl-C is sent after the displayed prompt settles for 100 ms; the real exit code 130, cancellation message and terminal-state restoration remain mandatory.\n')
print('Applied installer fixture channel assertions and direct-PTY cancellation driver.')
