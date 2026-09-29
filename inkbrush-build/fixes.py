from pathlib import Path
base=Path(__file__).parent
kit=base/'kit'
p=kit/'InkbrushUITests.swift';s=p.read_text()
a='private var output: URL { URL(fileURLWithPath: ProcessInfo.processInfo.environment["INKBRUSH_EVIDENCE_DIR"] ?? "/tmp/inkbrush-ui-evidence") }'
b='private var output: URL { URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Documents/inkbrush-ui-evidence") }'
assert a in s;s=s.replace(a,b)
s=s.replace('try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)','print("INKBRUSH_UI_OUTPUT=\\(output.path)")\n        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)',1)
a=s.index('    @MainActor private func goTo(');b=s.index('    @MainActor func testCreateCanvasAndNavigation',a)
s=s[:a]+(base/'dialog-helpers.swift').read_text()+s[b:]
s=s.replace('app.buttons["Cancel"].firstMatch.click()','app.sheets.buttons["action-button-2"].firstMatch.click()')
s=s.replace('app.buttons["Don’t Save"].firstMatch','app.sheets.buttons["action-button-3"].firstMatch')
s=s.replace('app.buttons["Export…"].firstMatch','app.windows.buttons["Export…"].firstMatch')
p.write_text(s)
p=kit/'qualify.py';s=p.read_text();s=s.replace('import hashlib,json,os,plistlib,subprocess,sys','import hashlib,json,os,plistlib,subprocess,sys,shutil')
a="elif command=='summary':\n"
b="""elif command=='summary':
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
(kit/'dialog-helpers.swift').write_text((base/'dialog-helpers.swift').read_text())
print('Corrected sandbox evidence and native modal targeting; production app unchanged')
