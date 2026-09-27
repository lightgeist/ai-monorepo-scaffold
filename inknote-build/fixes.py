from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
# These are writer dependency-injection fields, not product identities.
for rel in ['Sources/InknoteCore/App/SaveEngine.swift','Tests/InknoteCoreTests/AppEditorStoreTests.swift']:
    p=root/rel
    s=p.read_text()
    assert 'self.inknote' in s, rel
    p.write_text(s.replace('self.inknote','self.writer'))
# Keep the explicitly opt-in historical import target truthful; defaults never import.
for rel in ['Sources/InknoteCore/App/AppDataDirectory.swift','Tests/InknoteCoreTests/AppSettingsTests.swift']:
    p=root/rel;p.write_text(p.read_text().replace('com.inknote-computer','com.writer-computer'))
# Do not claim nonexistent separate vendored license files.
p=root/'NOTICE.md'
s=p.read_text().replace('The bundled KaTeX, Mermaid and HTML/code rendering resources retain their original license files and attribution; their names are not inknote branding.', 'The bundled KaTeX, Mermaid and HTML/code rendering resources are retained as supplied by the pinned upstream source; their names are third-party attribution, not inknote branding.')
p.write_text(s)
print('Applied scoped save-engine and provenance corrections')
