// Original brightmath artwork and motion adapter. No upstream character drawing is used.
// The adapter preserves the presentation contract while math/session state remains elsewhere.
import { tween, wait, lerp, clamp, Spring } from './core.js';
const NS = 'http://www.w3.org/2000/svg';
const palette = Object.freeze({pink:'#ee7390',blue:'#4f78e8',mint:'#19a891',yellow:'#e6b43b',violet:'#8b73d1',snow:'#a6c6d5',gold:'#cf9825',rainbow:'#ee7390'});
export const COSTUMES = Object.freeze({cap:'+',hachimaki:'=',cape:'×',glasses:'∞',ribbon:'÷',crown:'★',wizard:'√',headphones:'♪'});
function element(tag, attrs = {}, text) {
  const e=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,String(v));
  if(text!==undefined)e.textContent=String(text);
  return e;
}
function artwork(name='pink',costume=null) {
  const c=palette[name]||palette.blue;
  const colors=name==='rainbow'?['#ee7390','#4f78e8','#19a891','#e6b43b']:[c,'#f7cd68','#f8f7f2','#4f78e8'];
  const blocks=[[-49,-121,'+',colors[0]], [4,-132,'−',colors[1]], [-57,-68,'×',colors[2]], [-4,-79,'÷',colors[3]]];
  return blocks.map(([x,y,s,fill])=>`<g><rect x="${x+3}" y="${y+5}" width="48" height="48" rx="13" fill="#18344b" opacity=".11"/><rect x="${x}" y="${y}" width="48" height="48" rx="13" fill="${fill}" stroke="#18344b" stroke-width="2.5"/><text x="${x+24}" y="${y+26}" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="700" fill="${fill==='#4f78e8'?'#fff':'#18344b'}">${s}</text></g>`).join('')+(costume&&COSTUMES[costume]?`<g><circle cx="40" cy="-28" r="18" fill="#fff" stroke="${c}" stroke-width="3"/><text x="40" y="-26" dominant-baseline="middle" text-anchor="middle" font-family="system-ui,sans-serif" font-size="21" fill="#18344b">${COSTUMES[costume]}</text></g>`:'');
}
export function brightTileSVG(name='pink',costume=null) {return `<svg xmlns="${NS}" viewBox="-70 -145 140 140" aria-hidden="true">${artwork(name,costume)}</svg>`;}
export function brightTileSprite(name='pink',size=96) {const img=new Image(size,size);img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(brightTileSVG(name));return img;}
export class BrightTile {
  constructor(layer,{scale=.7,palette:name='pink',front}={}) {
    this.S=scale;this.x=0;this.y=0;this.home={x:0,y:0};this.ground=0;
    this.visible=true;this.lift=0;this.rot=0;this.bob=0;this.shake=0;this.stretchX=1;this.stretchY=1;
    this.token=0;this.jobCounter=0;this.destroyed=false;this.costume=null;this.palette=name;
    this.baseEyes='open';this.baseMouth='smile';this.cheekPuff=0;
    // Legacy names here are mechanical attachment points, not anatomical artwork.
    this.sq=new Spring(1);this.earL=new Spring(0);this.earR=new Spring(0);
    this.hands=[-1,1].map(side=>({side,mode:'rest',x:0,y:0,job:0,carry:null,raise:0}));
    this.root=element('g',{'data-brightmath-tile':'true'});this.art=element('g');
    this.root.append(this.art);layer.append(this.root);
    this.armsFront=element('g',{'data-brightmath-pointers':'true','pointer-events':'none'});
    this.pointers=this.hands.map(()=>element('circle',{r:5,fill:'#19a891',opacity:0}));
    this.pointers.forEach(p=>this.armsFront.append(p));
    this.sweat=element('g',{opacity:0});this.sweat.append(element('path',{d:'M39 -142h10m-5 -5v10',stroke:'#19a891','stroke-width':3}));
    this.root.append(this.sweat);(front||layer).append(this.armsFront);this.refresh();
  }
  refresh(){this.art.innerHTML=artwork(this.palette,this.costume);}
  setPalette(name){this.palette=Object.hasOwn(palette,name)?name:'blue';this.refresh();}
  setCostume(id){this.costume=Object.hasOwn(COSTUMES,id)?id:null;this.refresh();}
  setFace(eyes,mouth,base=false){if(base){this.baseEyes=eyes;this.baseMouth=mouth;}this.art.setAttribute('opacity',eyes==='closed'?.72:1);this.sq.kick(eyes==='happy'?1.4:0);}
  resetFace(){this.setFace(this.baseEyes,this.baseMouth);this.cheekPuff=0;this.sweat.setAttribute('opacity',0);}
  get headCenter(){return this.toScreen(0,-83);}
  toScreen(x,y){const a=this.rot*Math.PI/180;return{x:this.x+(x*Math.cos(a)-y*Math.sin(a))*this.S,y:this.y-this.lift+(x*Math.sin(a)+y*Math.cos(a))*this.S};}
  shoulder(side){return this.toScreen(side*48,-74);}
  restHand(side,h){return this.toScreen(side*(60+24*h.raise),-55-90*h.raise);}
  place(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return;this.x=x;this.y=y;this.home={x,y};this.ground=y;}
  update(dt,t,ctx={}){
    if(this.destroyed)return;
    this.sq.step(dt);this.earL.step(dt);this.earR.step(dt);
    this.root.style.display=this.visible?'':'none';this.armsFront.style.display=this.visible?'':'none';
    const reduced=ctx.reduced===true;const pulse=reduced?0:Math.sin(t*.003)*Math.min(3,this.bob*3);
    const scale=reduced?1:clamp(this.sq.value,.86,1.15);
    this.root.setAttribute('transform',`translate(${this.x} ${this.y-(reduced?0:this.lift)-pulse}) rotate(${reduced?0:this.rot}) scale(${this.S*this.stretchX*scale} ${this.S*this.stretchY/scale})`);
    this.hands.forEach((h,i)=>{const p=h.mode==='free'?h:this.restHand(h.side,h);this.pointers[i].setAttribute('cx',p.x);this.pointers[i].setAttribute('cy',p.y);this.pointers[i].setAttribute('r',Math.max(2,5*this.S));this.pointers[i].setAttribute('opacity',h.mode==='free'&&!h.carry?.hidden?.valueOf()?0.8:h.raise?0.5:0);});
  }
  lookAt(pt){this.look=pt;}
  freeHand(pt){return this.hands.find(h=>!h.job)||this.hands[pt.x<this.x?0:1];}
  begin(){this.token++;const token=this.token;return()=>!this.destroyed&&token===this.token;}
  async carry(from,to,digit,{E=0,onGrab,onPlace}={}){
    if(this.destroyed)return false;
    const hand=this.freeHand(from),job=++this.jobCounter;hand.job=job;hand.mode='free';
    const glyph=element('text',{'text-anchor':'middle','dominant-baseline':'middle',fill:'#18344b','font-family':'system-ui,sans-serif','font-size':28,'font-weight':800},digit);
    this.armsFront.append(glyph);hand.carry=glyph;onGrab?.();
    try{
      await tween(180+100*(1-clamp(E)),k=>{const x=lerp(from.x,to.x,k),y=lerp(from.y,to.y,k)-Math.sin(k*Math.PI)*32;glyph.setAttribute('x',x);glyph.setAttribute('y',y);if(hand.job===job){hand.x=x;hand.y=y;}});
      if(!this.destroyed){onPlace?.();return true;}return false;
    }finally{glyph.remove();if(hand.job===job){hand.job=0;hand.mode='rest';hand.carry=null;}}
  }
  async swipe(pt){const h=this.freeHand(pt);h.mode='free';h.x=pt.x;h.y=pt.y;await wait(140);if(!h.job)h.mode='rest';}
  async hop(height=30,dur=360,{spin=0,to=null}={}){const alive=this.begin(),start={x:this.x,y:this.y};await tween(dur,k=>{if(!alive())return;this.lift=Math.sin(k*Math.PI)*height;this.rot=spin*k;if(to){this.x=lerp(start.x,to.x,k);this.y=lerp(start.y,to.y,k);}});if(!alive())return false;this.lift=0;this.rot=0;if(to){this.x=to.x;this.y=to.y;}return true;}
  async clap(times=3){const alive=this.begin();for(let i=0;i<times&&alive();i++){this.sq.kick(2);await wait(120);}return alive();}
  async celebrate(E,{big=false}={}){return this.hop((big?36:18)+20*clamp(E),320,{spin:big?12:0});}
  async hurt(){this.setFace('closed','smile');await wait(170);if(!this.destroyed)this.resetFace();return !this.destroyed;}
  async point(pt,hold=900,{staticPose=false}={}){const h=this.hands[pt.x<this.x?0:1];if(h.job)return false;h.mode='free';h.x=pt.x;h.y=pt.y;if(staticPose)return true;await wait(hold);if(!h.job)h.mode='rest';return !this.destroyed;}
  async reachPose(on){this.hands.forEach(h=>{if(!h.job)h.raise=on?.7:0;});return !this.destroyed;}
  async leapTo(pt,height=80,{spin=0}={}){return this.hop(height,380,{to:pt,spin});}
  destroy(){this.destroyed=true;this.token++;this.root.remove();this.armsFront.remove();}
}
