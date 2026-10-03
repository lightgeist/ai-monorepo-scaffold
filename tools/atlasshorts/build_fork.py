"""Build the AtlasShorts self-hosted core from an exact upstream checkout.
Usage: python tools/atlasshorts/build_fork.py upstream build/AtlasShorts-v0.1.0-rc.1
Never include the separately licensed cloud layer, credentials or font binaries.
"""
from pathlib import Path
import sys, shutil, re, json, hashlib, os
UP, R = map(Path, sys.argv[1:3])
V='0.1.0-rc.1'
PIN='06a119c280e545bc3f55f2b7b036d4c187630d50'
REPO='https://github.com/lightgeist/ai-monorepo-scaffold/tree/feature/atlasshorts-v0.1.0-rc.1/standalone/atlasshorts'
if R.exists(): raise SystemExit('Output already exists; refusing overwrite')
shutil.copytree(UP,R)
def write(p,s):
 p=R/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s.lstrip('\n'))
def edit(p,a,b):
 p=R/p;s=p.read_text()
 if a not in s:raise RuntimeError(f'Patch anchor missing: {p}: {a[:80]}')
 p.write_text(s.replace(a,b))
excluded=[]
for rel in ['cloud','alembic','alembic.ini','requirements-billing.txt','docker-compose.cloud.yml','docker-compose.e2e.local.yml','ops','docs','dashboard/seo','dashboard/vite-plugin-seo.js','dashboard/public/op1.js','.hallmark','.github','cli/openshorts.egg-info','screenshots','demo-openshorts.mp4','churchil_queen_vertical.gif','churchil_queen_vertical_short.gif','dashboard/public/n8n-content-machine-workflow.png','dashboard/public/og-image.png','dashboard/public/vite.svg','dashboard/src/assets/react.svg','glama.json','server.json','examples/n8n']:
 p=R/rel
 if p.exists():
  shutil.rmtree(p) if p.is_dir() else p.unlink()
  excluded.append(rel)
fonts=[]
for p in list(R.rglob('*')):
 if p.is_file() and p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.ttc'}:
  rel=p.relative_to(R).as_posix();fonts.append({'path':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'url':f'https://raw.githubusercontent.com/mutonby/openshorts/{PIN}/{rel}'});p.unlink()
for p in list(R.rglob('*')):
 if not p.is_file() or p.relative_to(R).as_posix() in {'LICENSE','NOTICE'}:continue
 try:s=p.read_text()
 except UnicodeError:continue
 s=s.replace('https://api.openshorts.app','http://localhost:8000').replace('https://mcp.openshorts.app','http://localhost:8000').replace('https://www.openshorts.app','http://localhost:5175').replace('https://openshorts.app','http://localhost:5175')
 s=s.replace('https://github.com/mutonby/openshorts',REPO).replace('https://github.com/mutonby/skill-autoshorts',REPO+'/skills/atlasshorts')
 s=s.replace('info@openshorts.app','about & privacy').replace('OPENSHORTS','ATLASSHORTS').replace('OpenShorts','AtlasShorts').replace('openshorts','atlasshorts')
 s=s.replace('mcp.atlasshorts.app','localhost:8000').replace('api.atlasshorts.app','localhost:8000').replace('atlasshorts.app','localhost:5175')
 s=s.replace('AutoCrop-Vertical with Viral Clip Detection.','AtlasShorts video processing pipeline.')
 p.write_text(s)
for p in sorted(R.rglob('*'),key=lambda p:len(p.parts),reverse=True):
 if 'openshorts' in p.name:p.rename(p.with_name(p.name.replace('openshorts','atlasshorts')))
for pkg,name in [('dashboard','@deepintuition/atlasshorts-dashboard'),('render-service','@deepintuition/atlasshorts-renderer'),('remotion','@deepintuition/atlasshorts-remotion')]:
 for fname in ['package.json','package-lock.json']:
  p=R/pkg/fname
  if not p.exists():continue
  d=json.loads(p.read_text());d.update(name=name,version=V)
  if 'packages' in d and '' in d['packages']:d['packages'][''].update(name=name,version=V)
  p.write_text(json.dumps(d,indent=2)+'\n')
edit('app.py','BILLING_ENABLED = os.environ.get("BILLING_ENABLED", "").lower() in ("1", "true", "yes")','BILLING_ENABLED = os.environ.get("BILLING_ENABLED", "").lower() in ("1", "true", "yes")\nif BILLING_ENABLED:\n    raise RuntimeError("AtlasShorts includes only the MIT self-hosted core. Set BILLING_ENABLED=0. The upstream commercial cloud package is not included.")')
edit('app.py','app = FastAPI(lifespan=lifespan)',f'app = FastAPI(title="AtlasShorts", version="{V}", lifespan=lifespan)')
edit('app.py','allow_origins=cloud.settings.allowed_origins if BILLING_ENABLED else ["*"],','allow_origins=cloud.settings.allowed_origins if BILLING_ENABLED else [x.strip() for x in os.environ.get("ATLASSHORTS_ALLOWED_ORIGINS", "http://localhost:5175,http://127.0.0.1:5175").split(",") if x.strip()],')
edit('app.py','APP_HOST = "http://localhost:5175"','APP_HOST = os.environ.get("ATLASSHORTS_PUBLIC_APP_URL", "http://localhost:5175").rstrip("/")')
edit('app.py','GALLERY_HOST = "http://localhost:8000"','GALLERY_HOST = os.environ.get("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")')
edit('mcp_server.py','"title": "AtlasShorts", "version": "1.0.0"',f'"title": "AtlasShorts", "version": "{V}"')
edit('mcp_server.py','and analyses the video on its own servers.','and analyses the video on the configured self-hosted machine.')
edit('ffmpeg_utils.py','AI-generated content produced with AtlasShorts (localhost:5175)','AI-generated content produced with AtlasShorts by Deep Intuition')
edit('cli/pyproject.toml','name = "atlasshorts"','name = "deepintuition-atlasshorts"')
edit('cli/pyproject.toml','version = "0.1.0"',f'version = "{V}"')
edit('cli/pyproject.toml','authors = [{ name = "AtlasShorts" }]','authors = [{ name = "Deep Intuition" }]')
edit('cli/atlasshorts_cli.py','    key = os.environ.get("ATLASSHORTS_API_KEY")','    for env, header in (("GEMINI_API_KEY", "X-Gemini-Key"), ("UPLOAD_POST_API_KEY", "X-Upload-Post-Key")):\n        if os.environ.get(env): headers[header] = os.environ[env]\n    key = os.environ.get("ATLASSHORTS_API_KEY")')
edit('cli/atlasshorts_cli.py','    parser.add_argument("--json", action="store_true", help="raw JSON output")',f'    parser.add_argument("--version", action="version", version="AtlasShorts {V}")\n    parser.add_argument("--json", action="store_true", help="raw JSON output")')
p=R/'cli/atlasshorts_cli.py';s=p.read_text();end=s.index('"""',3);p.write_text('"""AtlasShorts CLI: install from ./cli or the supplied wheel.\nATLASSHORTS_API_URL defaults to localhost:8000. BYOK keys may be passed via\nGEMINI_API_KEY and UPLOAD_POST_API_KEY. No hosted account or registry publication\nis implied. ATLASSHORTS_API_KEY is only for an operator-provided auth proxy.\n"""'+s[end+3:])
edit('dashboard/src/App.jsx','const keysMissing = !billingEnabled && (!geminiOk || !uploadPostKey);','const keysMissing = !billingEnabled && !geminiOk;')
p=R/'dashboard/src/App.jsx';s=p.read_text();s=s.replace('mailto:about & privacy','#legal').replace('>atlasshorts<','>AtlasShorts<').replace('font-display lowercase text-lg text-ink','font-display text-lg text-ink');s=s.replace('Set your Gemini and Upload-Post API keys to use AtlasShorts.','Set a Gemini key or local LLM to clip. Publishing is optional.');s=s.replace('Gemini & Upload-Post keys missing','Clipping provider not configured').replace('Set your Upload-Post API key to use AtlasShorts.','Publishing is optional. Configure it only when needed.');s=s.replace('AtlasShorts needs both a <strong className="text-ink2">Gemini</strong> API key and an <strong className="text-ink2">Upload-Post</strong> API key. Both have free tiers.','Clipping needs a <strong className="text-ink2">Gemini</strong> key or configured local LLM. <strong className="text-ink2">Upload-Post</strong> is optional and only needed for publishing.');s=s.replace('git clone '+REPO+'/skills/atlasshorts','See skills/atlasshorts/SKILL.md in this release');p.write_text(s)
for p in (R/'dashboard/src').rglob('*'):
 if p.suffix not in {'.js','.jsx','.ts','.tsx'}:continue
 s=p.read_text();names=[]
 for old,new in [('localStorage','atlasLocalStorage'),('sessionStorage','atlasSessionStorage')]:
  if old in s:s=s.replace('window.'+old,old);s=re.sub(r'\b'+old+r'\b',new,s);names.append(new)
 if names:
  rel=os.path.relpath(R/'dashboard/src/lib/storage.js',p.parent).replace(os.sep,'/');rel=rel if rel.startswith('.') else './'+rel
  s='import { '+', '.join(names)+' } from '+json.dumps(rel)+';\n'+s
 p.write_text(s)
write('dashboard/src/lib/storage.js',"""const PREFIX = 'atlasshorts:';
function namespaced(kind) {
 const store = () => window[kind];
 return { getItem:key=>store().getItem(PREFIX+key), setItem:(key,value)=>store().setItem(PREFIX+key,value), removeItem:key=>store().removeItem(PREFIX+key), clear:()=>{ const s=store(); for(const key of Object.keys(s)) if(key.startsWith(PREFIX)) s.removeItem(key); } };
}
export const atlasLocalStorage = namespaced('localStorage');
export const atlasSessionStorage = namespaced('sessionStorage');
""")
write('dashboard/src/main.jsx',"""import { StrictMode, lazy, Suspense, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
const App=lazy(()=>import('./App.jsx'));
const Landing=lazy(()=>import('./Landing.jsx'));
const Legal=lazy(()=>import('./Legal.jsx'));
function Root(){ const [hash,setHash]=useState(window.location.hash); useEffect(()=>{const f=()=>setHash(window.location.hash);window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[]);if(hash==='#legal')return <Legal/>;if(hash==='#landing'||hash.startsWith('#/pricing')||hash.startsWith('#/account')||hash.startsWith('#/auth')||hash.startsWith('#/oauth'))return <Landing onLaunchApp={()=>{window.location.hash='#app'}}/>;return <App/>; }
createRoot(document.getElementById('root')).render(<StrictMode><AuthProvider><Suspense fallback={<div className="min-h-screen bg-paper text-muted p-12">Loading AtlasShorts…</div>}><Root/></Suspense></AuthProvider></StrictMode>);
""")
write('dashboard/src/Landing.jsx',"""import React from 'react';
export default function Landing({onLaunchApp}){return <div className="min-h-screen bg-paper text-ink2 p-6 sm:p-12"><header className="flex items-center justify-between border-b border-rule pb-6"><a href="#app" className="font-display text-2xl text-ink">AtlasShorts</a><span className="font-mono text-xs text-muted">BY DEEP INTUITION</span></header><main className="max-w-3xl mx-auto py-16"><p className="font-mono text-xs text-muted mb-6">SELF-HOSTED VIDEO WORKSPACE</p><h1 className="font-display text-5xl sm:text-6xl text-ink">Long stories.<br/>Short, well-made clips.</h1><p className="text-lg text-muted mt-8">Find moments, reframe the shot, edit captions, and prepare the next cut. Your footage. Your workspace.</p><button onClick={onLaunchApp} className="btn-primary px-6 py-3 mt-8">Open workspace →</button><div className="grid sm:grid-cols-3 gap-8 mt-16 border-t border-rule pt-8">{[['01 / CLIP','Select moments and export vertical clips.'],['02 / CREATE','Use your provider accounts for AI-presenter videos.'],['03 / FINISH','Edit captions and thumbnails. Publish only when you choose.']].map(([a,b])=><section key={a}><h2 className="font-mono text-xs text-brass mb-3">{a}</h2><p className="text-sm">{b}</p></section>)}</div><p className="mt-12 text-sm text-muted">No hosted service, subscription or API credit is included. <a className="underline" href="#legal">About, privacy & attribution</a>.</p></main></div>}
""")
write('dashboard/src/Legal.jsx',"""import React from 'react';
export default function Legal(){return <main className="min-h-screen bg-paper text-ink2 p-6 sm:p-12"><div className="max-w-3xl mx-auto space-y-6"><a href="#app" className="text-brass">← AtlasShorts workspace</a><h1 className="font-display text-3xl text-ink">About this self-hosted release</h1><p>AtlasShorts 0.1.0-rc.1 by Deep Intuition is a fork of the OpenShorts MIT core. Original notices are retained. The separately licensed commercial cloud package is not included.</p><h2 className="font-display text-xl text-ink">Data and credentials</h2><p>The operator controls storage. Browser Settings persist API keys; obfuscation is not encryption. Do not expose this unauthenticated instance to the internet.</p><p>Gemini, fal.ai, ElevenLabs, Upload-Post, S3 and external upload handoffs may receive data for selected features. Private footage must not be sent to a public temporary host without explicit permission. No product analytics script is loaded by this release.</p><h2 className="font-display text-xl text-ink">Retention and rights</h2><p>Default retention is 24 hours with disk caps. Export clips or deliberately change retention. Public galleries are public. Publishing, voice cloning and likeness generation require authorization and rights.</p><p>This is an operator notice, not a hosted-service privacy policy. Read SECURITY.md, VALIDATION.md and THIRD-PARTY-NOTICES.md before deployment.</p></div></main>}
""")
write('dashboard/src/components/PricingPage.jsx',"import Landing from '../Landing.jsx';\nexport default function PricingPage(){return <Landing onLaunchApp={()=>{window.location.hash='#app'}}/>}\n")
write('dashboard/index.html','<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/><meta name="theme-color" content="#252a28"/><meta name="description" content="AtlasShorts by Deep Intuition. Self-hosted video clipping and editing."/><meta name="robots" content="noindex,nofollow"/><link rel="icon" type="image/svg+xml" href="/atlas-mark.svg"/><link rel="manifest" href="/manifest.webmanifest"/><link rel="stylesheet" href="/fonts.css"/><title>AtlasShorts — Video workspace</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n')
write('dashboard/public/atlas-mark.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="AtlasShorts"><rect width="64" height="64" rx="12" fill="#252a28"/><path d="M12 49 28 15h8l16 34H41l-4-9H24l-4 9ZM28 31h6l-3-7Z" fill="#f6f4ee"/><path d="m36 19 14 9-14 9Z" fill="#b28b52"/></svg>')
for p in (R/'dashboard').rglob('*'):
 if p.is_file() and p.suffix in {'.js','.jsx','.html','.json'}:p.write_text(p.read_text().replace('/logo-atlasshorts.png','/atlas-mark.svg').replace('Your video, product name and script will be visible at localhost:5175/gallery','Your video, product name and script may become public through your configured gallery'))
(R/'dashboard/public/logo-atlasshorts.png').unlink(missing_ok=True)
write('dashboard/public/robots.txt','User-agent: *\nDisallow: /\n')
write('dashboard/public/manifest.webmanifest',json.dumps({'name':'AtlasShorts','short_name':'AtlasShorts','start_url':'/#app','display':'standalone','theme_color':'#252a28','background_color':'#252a28','icons':[{'src':'/atlas-mark.svg','sizes':'any','type':'image/svg+xml'}]},indent=2))
write('dashboard/vite.config.js',"""import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const backend=process.env.VITE_PROXY_TARGET||'http://backend:8000';
const proxy=Object.fromEntries(['/api','/mcp','/videos','/thumbnails','/gallery','/video','/health'].map(p=>[p,{target:backend,changeOrigin:true}]));
proxy['/render']={target:process.env.VITE_RENDER_TARGET||'http://renderer:3100',changeOrigin:true};
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',proxy},preview:{host:'127.0.0.1',proxy}});
""")
write('dashboard/nginx.conf',"""server {
 listen 80 default_server;
 server_name _;
 root /usr/share/nginx/html;
 index index.html;
 client_max_body_size 2100m;
 location ~ ^/(api|mcp|videos|thumbnails|gallery|video|health)(/|$) { proxy_pass http://backend:8000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 600s; proxy_buffering off; }
 location /render { resolver 127.0.0.11 valid=30s; set $renderer http://renderer:3100; proxy_pass $renderer; proxy_read_timeout 600s; }
 location / { try_files $uri $uri/ /index.html; }
}
""")
write('docker-compose.yml',"""name: atlasshorts
services:
  backend:
    build: .
    env_file: .env
    environment:
      BILLING_ENABLED: "0"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      - uploads:/app/uploads
      - output:/app/output
      - model_cache:/app/.cache/huggingface
    restart: unless-stopped
  frontend:
    build:
      context: ./dashboard
      target: prod
    ports:
      - "127.0.0.1:5175:80"
    depends_on: [backend]
    restart: unless-stopped
  renderer:
    profiles: [renderer]
    build:
      context: .
      dockerfile: render-service/Dockerfile
    environment:
      REMOTION_BUNDLE_PATH: /app/remotion
      OUTPUT_DIR: /output
      PORT: "3100"
    volumes:
      - output:/output
    restart: unless-stopped
volumes:
  uploads:
  output:
  model_cache:
""")
write('docker-compose.gpu.yml',"""services:
  backend:
    build:
      context: .
      args:
        GPU: "1"
    environment:
      WHISPER_DEVICE: cuda
      WHISPER_COMPUTE: float16
      FFMPEG_ENCODER: auto
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu, video]
""")
write('.env.example',"""# AtlasShorts: local, single-operator. Never commit .env.
BILLING_ENABLED=0
MAX_CONCURRENT_JOBS=1
JOB_RETENTION_SECONDS=86400
OUTPUT_MAX_GB=25
UPLOADS_MAX_GB=15
WHISPER_MODEL=small
WHISPER_DEVICE=cpu
WHISPER_COMPUTE=int8
FFMPEG_ENCODER=x264
# GEMINI_API_KEY=
# LLM_BASE_URL=http://host.docker.internal:11434/v1
# LLM_MODEL=your-installed-model
# LLM_API_KEY=
# FAL_KEY=
# ELEVENLABS_API_KEY=
# UPLOAD_POST_API_KEY=
# Optional storage; a public bucket makes media PUBLIC.
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=
# AWS_S3_BUCKET=
# AWS_S3_PUBLIC_BUCKET=
PUBLIC_API_URL=http://localhost:8000
ATLASSHORTS_ALLOWED_ORIGINS=http://localhost:5175,http://127.0.0.1:5175
""")
write('scripts/font-assets.json',json.dumps(fonts,indent=2))
write('scripts/fonts.css.template',(R/'dashboard/public/fonts.css').read_text())
write('dashboard/public/fonts.css','/* System fallbacks. Optional exact fonts: python scripts/fetch_fonts.py */\n')
restores=[('dashboard/public/fonts.css','scripts/fonts.css.template')]
for rel in ['dashboard/src/remotion/lib/fonts.ts','remotion/src/lib/fonts.ts']:
 p=R/rel
 if p.exists():
  s=p.read_text();template='scripts/remotion-fonts-'+rel.split('/')[0]+'.template';write(template,s);restores.append((rel,template));s=re.sub(r'export const (notoSerifFontFace|montserratFontFace|antonFontFace) = `.*?`;','export const \\1 = "";',s,flags=re.S);s=s.replace('import { staticFile } from "remotion";','// Optional typefaces restored by scripts/fetch_fonts.py.');p.write_text(s)
write('scripts/fetch_fonts.py', '''"""Download optional pinned font assets; none are embedded in the release."""
from pathlib import Path
import hashlib,json,urllib.request,os,tempfile
root=Path(__file__).resolve().parent.parent
for item in json.loads((root/'scripts/font-assets.json').read_text()):
 dst=root/item['path']
 if dst.exists() and hashlib.sha256(dst.read_bytes()).hexdigest()==item['sha256']:continue
 with urllib.request.urlopen(item['url'],timeout=60) as resp:data=resp.read()
 if hashlib.sha256(data).hexdigest()!=item['sha256']:raise SystemExit('Integrity failure: '+item['path'])
 dst.parent.mkdir(parents=True,exist_ok=True)
 fd,tmp=tempfile.mkstemp(dir=dst.parent)
 try:
  with os.fdopen(fd,'wb') as out:out.write(data)
  os.replace(tmp,dst)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
 print('Verified',item['path'])
'''+''.join(f'(root/{a!r}).write_text((root/{b!r}).read_text())\n' for a,b in restores))
p=R/'Dockerfile';s=p.read_text().replace('COPY requirements.txt requirements-billing.txt ./','COPY requirements.txt ./').replace('RUN pip install --no-cache-dir -r requirements-billing.txt','').replace('# Register the bundled fonts','RUN python scripts/fetch_fonts.py\n\n# Register the fetched fonts').replace('"--forwarded-allow-ips", "*", ','');s=re.sub(r'# Cloud \(paid mode\).*?self-host\.\n','',s,flags=re.S);p.write_text(s)
p=R/'dashboard/Dockerfile';p.write_text(p.read_text().replace('node:18-alpine','node:22-alpine').replace('RUN npm install','RUN npm ci'))
p=R/'render-service/Dockerfile';p.write_text(p.read_text().replace('node:18-bookworm-slim','node:22-bookworm-slim').replace('COPY render-service/package.json ./\nRUN npm install','COPY render-service/package.json render-service/package-lock.json ./\nRUN npm ci'))
p=R/'assets/make_watermark.py';s=p.read_text().replace('from PIL import Image, ImageDraw, ImageFont, ImageFilter','from PIL import Image, ImageDraw, ImageFont, ImageFilter\nfrom pathlib import Path');s=re.sub(r'font = ImageFont.truetype\([^\n]+','font = ImageFont.load_default(size=int(38 * S))',s);s=s.replace('out.save("watermark.png")','out.save(Path(__file__).with_name("watermark.png"))');p.write_text(s)
write('VERSION',V+'\n')
write('UPSTREAM.json',json.dumps({'repository':'https://github.com/mutonby/openshorts','commit':PIN,'upstream_date':'2026-10-01','fork':'AtlasShorts','version':V,'core_license':'MIT','cloud_included':False,'original_license_sha256':hashlib.sha256((UP/'LICENSE').read_bytes()).hexdigest(),'excluded_paths':excluded,'font_files_included':False},indent=2))
write('NOTICE',(UP/'NOTICE').read_text()+'\nATLAS SHORTS DISTRIBUTION NOTE\nAtlasShorts modifications: Copyright (c) 2026 Deep Intuition.\nThe separately licensed cloud/ software is excluded in full.\nOriginal root MIT license is preserved unchanged. No upstream endorsement implied.\n')
cloudtests=[]
for p in (R/'tests').glob('test_*.py'):
 if re.search(r'\bfrom cloud\b|\bimport cloud\b|[\'\"]cloud[./]',p.read_text()):cloudtests.append(p.name)
write('tests/excluded-cloud-tests.json',json.dumps(cloudtests,indent=2))
p=R/'tests/conftest.py';p.write_text(p.read_text()+'\n# The separately licensed cloud package is intentionally excluded.\nimport json\nfrom pathlib import Path\ncollect_ignore = json.loads((Path(__file__).parent / "excluded-cloud-tests.json").read_text())\n')
write('.gitignore',(R/'.gitignore').read_text()+'\n.env\ndata/\n.venv/\nvenv/\n*.egg-info/\n**/node_modules/\n**/dist/\n__pycache__/\n.pytest_cache/\n*.ttf\n*.otf\n*.woff\n*.woff2\n*.ttc\n')
# Documentation is copied from the auditable recipe directory, not manufactured by a model at runtime.
for p in Path(__file__).parent.glob('*.md'):shutil.copy2(p,R/p.name)
shutil.copy2(R/'AGENTS.md',R/'CLAUDE.md')
(R/'skills/atlasshorts').mkdir(parents=True,exist_ok=True)
shutil.copy2(R/'AGENTS.md',R/'skills/atlasshorts/SKILL.md')
write('cli/README.md','# AtlasShorts CLI\n\nInstall `python -m pip install ./cli` from the release root, or install the supplied wheel.\nNo public package-registry publication is implied. `atlasshorts --help` lists commands.\n`ATLASSHORTS_API_URL` defaults to localhost:8000. Configure provider keys on the backend\nor use GEMINI_API_KEY and UPLOAD_POST_API_KEY as needed. See START-HERE.md.\n')
write('examples/n8n/README.md','# n8n\n\nUse HTTP requests against your authenticated private backend. POST /api/process, then\npoll /api/status/{job_id} or verify its signed webhook. Keep a human approval step\nbefore publishing. Hosted-account templates are not working Atlas templates and\nare omitted. Consult the running backend /docs for current request schemas.\n')
print(json.dumps({'output':str(R),'files':sum(p.is_file() for p in R.rglob('*')),'excluded_cloud_test_files':len(cloudtests),'font_manifest_entries':len(fonts)}))
