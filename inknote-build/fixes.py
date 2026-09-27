from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
def replace(rel,a,b):
    p=root/rel;s=p.read_text();assert a in s,(rel,a[:80]);p.write_text(s.replace(a,b))
# These are writer dependency-injection fields, not product identities.
for rel in ['Sources/InknoteCore/App/SaveEngine.swift','Tests/InknoteCoreTests/AppEditorStoreTests.swift']:
    replace(rel,'self.inknote','self.writer')
# Preserve exact explicitly opt-in historical import path; defaults never import.
for rel in ['Sources/InknoteCore/App/AppDataDirectory.swift','Tests/InknoteCoreTests/AppSettingsTests.swift']:
    replace(rel,'com.inknote-computer','com.writer-computer')
# The preset title is generated from its resource directory, not a string literal.
(root/'Sources/InknoteCore/Resources/themes/writer').rename(root/'Sources/InknoteCore/Resources/themes/inknote')
replace('Sources/InknoteCore/App/Theme.swift','        slug.split(separator: "-").map', '        if slug == "inknote" { return "inknote" }\n        return slug.split(separator: "-").map')
replace('Tests/InknoteCoreTests/AppSettingsTests.swift','["Default", "High Contrast", "Warm Paper", "inknote"]','["Default", "High Contrast", "inknote", "Warm Paper"]')
# Rename only the old application's CSS prefix, never generic writer identifiers.
for base in ['Sources','Tests']:
    for p in (root/base).rglob('*'):
        if not p.is_file():continue
        try:s=p.read_text()
        except UnicodeError:continue
        if '--writer-' in s:p.write_text(s.replace('--writer-','--inknote-'))
replace('Sources/InknoteApp/App/InknoteApp.swift','Invoked through the `writer` symlink','Invoked through the `inknote` symlink')
replace('Package.swift','In-app updates (pinned; bump deliberately — scripts/release.sh uses its bin/ tools).','Optional update framework retained for compatibility; no update feed is configured.')
# Do not claim nonexistent separate vendored license files.
replace('NOTICE.md','The bundled KaTeX, Mermaid and HTML/code rendering resources retain their original license files and attribution; their names are not inknote branding.', 'The bundled KaTeX, Mermaid and HTML/code rendering resources are retained as supplied by the pinned upstream source; their names are third-party attribution, not inknote branding.')
print('Applied scoped save-engine, preset-resource, CSS and provenance corrections')
