from pathlib import Path
kit=Path(__file__).parent/'kit'
p=kit/'InkbrushUITests.swift';s=p.read_text()
a='private var output: URL { URL(fileURLWithPath: ProcessInfo.processInfo.environment["INKBRUSH_EVIDENCE_DIR"] ?? "/tmp/inkbrush-ui-evidence") }'
b='private var output: URL { URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Documents/inkbrush-ui-evidence") }'
assert a in s;s=s.replace(a,b)
s=s.replace('try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)','print("INKBRUSH_UI_OUTPUT=\\(output.path)")\n        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)',1)
p.write_text(s)
p=kit/'qualify.py';s=p.read_text();s=s.replace('import hashlib,json,os,plistlib,subprocess,sys','import hashlib,json,os,plistlib,subprocess,sys,shutil')
a="elif command=='summary':\n"
b="""elif command=='summary':
    # The XCTest runner is independently sandboxed; collect from its permitted container.
    if 'UIResults' in sys.argv[2]:
        destination=Path(sys.argv[3]).resolve().parent/'native-ui'
        sources=[Path.home()/'Library/Containers/app.inkbrush.mac.uitests.xctrunner/Data/Documents/inkbrush-ui-evidence',Path.home()/'Documents/inkbrush-ui-evidence']
        for source in sources:
            if source.is_dir():
                shutil.copytree(source,destination,dirs_exist_ok=True)
                print('Collected native UI evidence:',source)
"""
assert a in s;s=s.replace(a,b);p.write_text(s)
(kit/'applied-fixes.py').write_text(Path(__file__).read_text())
print('Corrected test-runner evidence storage; production app sandbox unchanged')
