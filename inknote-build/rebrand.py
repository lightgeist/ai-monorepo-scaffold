from pathlib import Path
import re, subprocess, shutil, sys
root=Path(sys.argv[1]).resolve()
# Preserve upstream notices and original design documentation as provenance.
prov=root/'provenance'; prov.mkdir(exist_ok=True)
shutil.copy2(root/'README.md',prov/'UPSTREAM-README.md')
for directory in ('docs','release-notes'):
    shutil.move(str(root/directory),str(prov/directory))

def rename(s):
    for a,b in [('Flo State Native','inknote'),('Flo State','inknote'),('FloStateNative','InknoteApp'),('FloStateCLI','InknoteCLI'),('FloState','Inknote'),('FLOSTATE','INKNOTE'),('app.flostate.native','app.inknote.mac'),('flostate','inknote'),('FLO_','INKNOTE_'),('flo-state','inknote'),('flo-','inknote-'),('.writer','.inknote'),('"Writer"','"inknote"')]:
        s=s.replace(a,b)
    s=re.sub(r'Flo(?=[A-Z])','Inknote',s)
    s=re.sub(r'flo(?=[A-Z])','inknote',s)
    return s

for p in list(root.rglob('*')):
    if not p.is_file() or '.git' in p.parts or 'provenance' in p.parts: continue
    if p.name=='LICENSE': continue
    try: old=p.read_text()
    except (UnicodeError,OSError): continue
    new=rename(old)
    if new!=old: p.write_text(new)
for p in sorted(root.rglob('*'),key=lambda x:len(x.parts),reverse=True):
    if '.git' in p.parts or 'provenance' in p.parts: continue
    name=rename(p.name)
    if name!=p.name: p.rename(p.with_name(name))

def replace(p,a,b):
    f=root/p;s=f.read_text(); assert a in s,(p,a[:70]);f.write_text(s.replace(a,b))
replace('Package.swift','name: "InknoteApp",\n    platforms:','name: "Inknote",\n    platforms:')
replace('Sources/InknoteCore/App/ResourceBundle.swift','InknoteApp_InknoteCore.bundle','Inknote_InknoteCore.bundle')
replace('Sources/InknoteCore/App/AppDataDirectory.swift','appendingPathComponent("InknoteApp",','appendingPathComponent("inknote",')
replace('Sources/InknoteCore/App/AppDataDirectory.swift','legacyURL: URL? = AppDataDirectory.legacyBaseURL','legacyURL: URL? = nil')
replace('Sources/InknoteApp/App/ShellModel.swift','importLegacy: Bool = true','importLegacy: Bool = false')
replace('Sources/InknoteApp/App/InknoteCLI.swift','?? "0.1"','?? "1.0.0"')
# One native toolbar geometry regression, one native button geometry regression,
# and one test-coordinate ambiguity seen in pristine upstream on macOS 15.7.9.
replace('Sources/InknoteApp/App/ShellWindow.swift','w.toolbar = tb\n        w.toolbarStyle', 'w.toolbar = tb\n        // An empty visible toolbar intercepts the custom tab strip on macOS 15.\n        // Keep the native toolbar identity, but let our own chrome receive clicks.\n        tb.isVisible = false\n        w.toolbarStyle')
replace('Sources/InknoteApp/App/ShellWindow.swift','let topInset = y - 9   // 20: close button top, from the window top','let topInset = y - 2 - bh / 2 // centre at y-2 even when native button height changes')
replace('Tests/InknoteKitTests/LinkClickTests.swift','NSPoint(x: win.midX, y: win.midY)','NSPoint(x: win.minX + win.width * 0.25, y: win.midY)')
replace('Tests/InknoteKitTests/LinkClickTests.swift','Window point of the middle of char','Window point in the leading quarter of char')
# Original icon is replaced by locally generated native artwork.
(root/'Resources/AppIcon.icns').unlink()
(root/'VERSION').write_text('1.0.0\n')
# Remove upstream publication automation; only audited local packaging is retained.
for n in ('release.sh','test-update.sh','appcast.py','install.sh','bundle.sh'):
    (root/'scripts'/n).unlink()
replace('Sources/InknoteApp/App/InknoteApp.swift','let args = CommandLine.arguments\n','let args = CommandLine.arguments\n        if args.contains("--acceptance-test") { NativeAcceptance.run(args) }\n')
for rel in ['Sources/InknoteApp/App/ShellMenus.swift','Sources/InknoteCore/App/EditorModel.swift']:
    p=root/rel;s=p.read_text();s=s.replace('"Inknote"','"inknote"');p.write_text(s)
replace('Sources/InknoteApp/App/ShellSnapshot.swift','let msg = "Add a folder with your specs, docs, notes, or any markdown files."', '''let wordmark = TextStyle(font: NSFont.systemFont(ofSize: 44, weight: .semibold), color: p.textPrimary, kern: -1.7)
        wordmark.draw("inknote", x: (bounds.width - wordmark.width("inknote")) / 2,
                      lineTop: bounds.height / 2 - 158, lineHeight: 58, in: ctx)
        let msg = "A quiet place for your ideas. Open a note or bring your own folder."''')
replace("Tests/InknoteCoreTests/AppSettingsTests.swift", "Library/Application Support/InknoteApp", "Library/Application Support/inknote")
