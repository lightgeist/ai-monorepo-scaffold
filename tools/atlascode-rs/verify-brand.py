#!/usr/bin/env python3
"""Fail-closed first-party identity, provider-boundary and provenance audit."""
from pathlib import Path
import hashlib, json, re, sys, tomllib

ROOT = Path(__file__).resolve().parents[1]
if not (ROOT/'Cargo.toml').exists():
    ROOT=Path(sys.argv[1]).resolve()
checks=[]
errors=[]
def check(label, condition):
    checks.append({'check':label,'passed':bool(condition)})
    if not condition:errors.append(label)
def text(p):return (ROOT/p).read_text()
def digest(obj):return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()

cargo=tomllib.loads(text('Cargo.toml'))
check('Cargo package is atlascode-rs 0.1.0',cargo['package']['name']=='atlascode-rs' and cargo['package']['version']=='0.1.0')
check('Library and executable identities',cargo['lib']['name']=='atlascode_rs' and [p['name'] for p in cargo['bin']]==['atlascode-rs'])
check('No registry publish without explicit ownership decision',cargo['package'].get('publish') is False)
check('Upstream LICENSE preserved byte-for-byte',sha('LICENSE')=='1ddfd99f2ee4677d05544245a3112c839a56f8b733bcbdd2cfe9c4b2998da3c2')
check('Provider path implementation unchanged',sha('src/claude_paths.rs')=='123c86970dd6f7f8b860490d3f51c8e5fa5ab16b91d1fc1d78a165cc2efebfdc')
check('Bun source hashes unchanged',sha('scripts/runtime/bun-runtime-manifest.json')=='90ede346e8f2623739f58610296f498e130e421eb7a1a0a9f2e414ba44c0b322')
locks=[('package-lock.json','68f24e5fd09cb6656dd86b8163a672d02302c643d01a2c1b522f75f73b98ac21'),('agent-sdk/package-lock.json','a6bd9b00f14f9b454c9933d13b58a23d9f61a2902823afea4237e4542efea6aa')]
for f,expected in locks:
    lock=json.loads(text(f)); deps={k:v for k,v in lock['packages'].items() if k}
    check(f+' dependency graph unchanged',digest(deps)==expected)
    pkg=json.loads(text(f.replace('package-lock','package')))
    check(f+' root metadata matches',lock['name']==pkg['name'] and lock['version']==pkg['version'] and lock['packages']['']['version']==pkg['version'])
    check(f+' provider SDK pin',pkg['dependencies']['@anthropic-ai/claude-agent-sdk']=='0.3.288')
    check(f+' registry publication disabled',pkg.get('private') is True)
lock=tomllib.loads(text('Cargo.lock'))['package']
check('Rust dependency graph unchanged',digest([p for p in lock if p['name']!='atlascode-rs'])=='4d16288f964a1e77ed106204672aaff03dfc9d40cca878d74d2db9b02e3f7984')
check('Old executable absent',(ROOT/'bin/atlascode-rs.js').is_file() and not (ROOT/'bin/claude-rs.js').exists())
check('Attribution in NOTICE',all(x in text('NOTICE') for x in ['Simon Peter Rothgang','ddcf1eb5513b02ca2a68964220f115da0a69a80a','Apache']))
check('No inherited funding routing',not (ROOT/'.github/FUNDING.yml').exists())
check('Old mascot assets not presented',not (ROOT/'assets/demo.gif').exists())
check('Automatic updates disabled','pub const UPDATES_ENABLED: bool = false;' in text('src/brand.rs'))
check('Update-check policy gate','!crate::brand::UPDATES_ENABLED || no_update_check_flag' in text('src/app/update_check.rs'))
check('Cached prompt policy gate','update_check_disabled(cli.no_update_check)' in text('src/app/connect/mod.rs'))
check('Manual updater policy gate','if !atlascode_rs::brand::UPDATES_ENABLED' in text('src/main.rs'))
check('New own settings path','SETTINGS_DIR_NAME: &str = "atlascode-rs"' in text('src/app/settings.rs'))
check('New own log path','DEFAULT_LOG_DIR: &str = "atlascode-rs"' in text('src/logging.rs'))
check('New bridge env prefix','"ATLASCODE_RS_AGENT_BRIDGE"' in text('src/agent/bridge.rs'))
check('Provider runtime command preserved','CLAUDE_CODE_EXECUTABLE' in text('agent-sdk/src/bridge/session_lifecycle.ts'))
check('Provider command not renamed','"claude"' in text('src/app/claude_cli.rs'))
for p in ['scripts/install/install.sh','scripts/install/install.ps1']:
    s=text(p)
    check(p+' namespaced release download','releases/download/atlascode-rs-$tag' in s)
    check(p+' version-qualified channel','releases/tags/atlascode-rs-v0.1.0' in s and 'releases/latest' not in s)
    check(p+' owned repository','ai-monorepo-scaffold' in s and 'lightgeist' in s)
for p in ['scripts/install/generate-install-archives.mjs','scripts/npm/generate-npm-packages.mjs']:
    check(p+' distributes attribution',all('copyFileFromRepo("'+f+'"' in text(p) for f in ['LICENSE','NOTICE','PROVENANCE.json']))

pattern=re.compile(r'claude[-_ ]?rs|claude[-_ ]?(?:code[-_ ]?)?rust|@srothgan|srothgan\.github\.io',re.I)
scanned=0
for directory in ['src','bin','agent-sdk/src','agent-sdk/scripts','scripts','.github']:
    for p in sorted((ROOT/directory).rglob('*')):
        if not p.is_file():continue
        try:s=p.read_text()
        except UnicodeError:continue
        scanned+=1
        for n,line in enumerate(s.splitlines(),1):
            if pattern.search(line):errors.append(f'Legacy runtime identity: {p.relative_to(ROOT)}:{n}: {line[:160]}')
check('Runtime legacy-identity scan ('+str(scanned)+' files)',not any(e.startswith('Legacy runtime') for e in errors))

fonts=[]
for p in ROOT.rglob('*'):
    if any(x in {'.git','node_modules','target','dist-platform','dist-install','dist-npm','dist-pack','evidence'} for x in p.relative_to(ROOT).parts):continue
    if p.is_file() and p.suffix.lower() in {'.woff','.woff2','.ttf','.otf','.eot'}:fonts.append(str(p.relative_to(ROOT)))
check('No font binaries in source archive',not fonts)

broken=[]
for p in [ROOT/'README.md',*(ROOT/'docs/src').glob('*.md')]:
    for raw in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        link=raw.split('#')[0]
        if not link or re.match(r'^[a-z]+:',link) or link.startswith('/') :continue
        if not (p.parent/link).exists():broken.append(str(p.relative_to(ROOT))+': '+link)
check('Active relative documentation links resolve',not broken)
for x in broken:errors.append('Broken documentation link: '+x)
report={'schema':'atlascode-rs-brand-audit/v1','passed':not errors,'checks':checks,'errors':errors,'runtime_files_scanned':scanned}
print(json.dumps(report,indent=2))
sys.exit(0 if not errors else 1)
