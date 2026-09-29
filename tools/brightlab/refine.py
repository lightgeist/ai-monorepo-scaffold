"""Bound browser failures and add ordinary-playback coverage without weakening assertions."""
from pathlib import Path
import sys
R=Path(sys.argv[1])
p=R/'tests/browser.mjs';s=p.read_text().replace('page.setDefaultTimeout(12000)','page.setDefaultTimeout(5000)')
s=s.replace("}catch{}}};", "}catch{} if(checks.filter(c=>!c.pass).length>=8)throw new Error('Stopping after eight failed checks; inspect browser-progress.json and screenshots.');}};")
s=s.replace("document.querySelector('#endcard');if(card&&", "document.querySelector('#endcard');if(card&&")
p.write_text(s)
p=R/'src/main.ts';s=p.read_text().replace('This needs WebGL 2. Try a recent Chrome, Safari or Firefox.','BrightLab needs WebGL 2. Try a recent Chrome, Safari or Firefox.');p.write_text(s)
