from pathlib import Path
import re,sys
root=Path(sys.argv[1]);p=root/'app/js/main.js';s=p.read_text()
# The seventh-day sticker also embedded an upstream mascot face. Replace its complete
# drawing with an independent geometric crown, not just its colors or name.
start=s.index('function stickerSvg(');end=s.index('let titleRewardTimer',start)
section=s[start:end]
replacement="crown: `<path d=\"M-15 11L-17 -9L-7 -1L0 -15L7 -1L17 -9L15 11Z\" fill=\"#f7cd68\" stroke=\"#18344b\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/><path d=\"M-13 15H13\" stroke=\"#18344b\" stroke-width=\"3\" stroke-linecap=\"round\"/>`,"
section,n=re.subn(r'crown: `.*?`,',replacement,section,count=1,flags=re.S);assert n==1
s=s[:start]+section+s[end:];p.write_text(s)
print('Replaced embedded seventh-day mascot sticker with independent crown geometry')
