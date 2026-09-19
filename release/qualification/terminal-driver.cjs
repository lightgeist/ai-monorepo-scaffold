/* Actual PTY + headless terminal emulator. No UI elements are fabricated. */
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const pty = createRequire(path.resolve(__dirname,'../../packages/tui/package.json'))('node-pty');
const {Terminal} = createRequire(path.resolve(__dirname,'../../third_party/pi-mono/packages/tui/package.json'))('@xterm/headless');
const out = path.resolve(process.argv[2]);
const cli = path.resolve(process.argv[3]);
const cwd = path.resolve(process.argv[4]);
const args = JSON.parse(process.argv[5] || '[]');
fs.mkdirSync(out, {recursive: true});
const term = new Terminal({cols: 120, rows: 40, scrollback: 5000, allowProposedApi: true});
const child = pty.spawn(process.execPath, [cli, ...args], {name:'xterm-256color',cols:120,rows:40,cwd,env:{...process.env, TERM:'xterm-256color',COLORTERM:'truecolor',FORCE_COLOR:'3',DO_NOT_TRACK:'1'}});
let count=0, processed=0;
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function color(cell, side) {
  const rgb = side === 'fg' ? cell.isFgRGB() : cell.isBgRGB();
  const indexed = side === 'fg' ? cell.isFgPalette() : cell.isBgPalette();
  const n = side === 'fg' ? cell.getFgColor() : cell.getBgColor();
  if (rgb) return '#' + n.toString(16).padStart(6,'0');
  if (indexed) {
    const base=['#050B15','#FF92AA','#8BDCAB','#EDC776','#8265EB','#AD9AFF','#92D8E9','#ECECF5','#83899F','#FF92AA','#8BDCAB','#EDC776','#AD9AFF','#D6CCFF','#92D8E9','#FFFFFF'];
    if(n<16)return base[n];
    if(n>=232){const c=(8+10*(n-232)).toString(16).padStart(2,'0');return '#'+c+c+c;}
    const b=n-16,levels=[0,95,135,175,215,255];return '#'+[levels[Math.floor(b/36)],levels[Math.floor(b/6)%6],levels[b%6]].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  return side==='fg'?'#ECECF5':'#050B15';
}
function snapshot(label) {
  const b=term.buffer.active, plain=[], rows=[];
  for(let y=0;y<term.rows;y++){
    const line=b.getLine(b.viewportY+y);if(!line){plain.push('');rows.push('');continue;}
    plain.push(line.translateToString(true));let html='';
    for(let x=0;x<term.cols;x++){
      const c=line.getCell(x);if(!c||c.getWidth()===0)continue;
      let fg=color(c,'fg'),bg=color(c,'bg');if(c.isInverse())[fg,bg]=[bg,fg];
      html+=`<span style="color:${fg};background:${bg};${c.isBold()?'font-weight:700;':''}${c.isItalic()?'font-style:italic;':''}">${esc(c.getChars()||' ')}</span>`;
    } rows.push(html);
  }
  fs.writeFileSync(path.join(out,label+'.txt'),plain.join('\n'));
  fs.writeFileSync(path.join(out,label+'.html'),`<!doctype html><meta charset="utf-8"><title>AtlasCode — recorded PTY frame</title><style>body{margin:0;background:#050B15;color:#ECECF5}pre{margin:20px;font:14px/20px 'DejaVu Sans Mono',monospace;white-space:pre}</style><pre>${rows.join('\n')}</pre>`);
  fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({label,cols:term.cols,rows:term.rows,capturedAt:new Date().toISOString(),source:'node-pty process output interpreted by @xterm/headless'},null,2));
}
child.onData(data=>{
  fs.appendFileSync(path.join(out,'terminal.ansi'),data);
  fs.appendFileSync(path.join(out,'events.jsonl'),JSON.stringify({t:Date.now(),data})+'\n');
  term.write(data);
});
term.onData(data=>child.write(data));
child.onExit(ev=>{snapshot('exit');fs.writeFileSync(path.join(out,'exit.json'),JSON.stringify(ev));clearInterval(timer);process.exit(0);});
const timer=setInterval(()=>{
  let commands=[];try{commands=fs.readFileSync(path.join(out,'commands.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);}catch{return;}
  for(const c of commands.slice(processed)){
    processed++; if(c.write!==undefined)child.write(c.write);
    if(c.resize){child.resize(...c.resize);term.resize(...c.resize);}
    if(c.capture)setTimeout(()=>snapshot(c.capture),400);
    if(c.kill)child.kill();
  }
},100);
setTimeout(()=>snapshot('startup'),3500);
fs.writeFileSync(path.join(out,'process.json'),JSON.stringify({pid:child.pid,cli,args,cwd}));
