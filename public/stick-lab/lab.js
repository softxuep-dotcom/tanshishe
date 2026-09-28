import { REST, CLIPS } from './motions.js';

const $ = id => document.getElementById(id);
const canvas = $('stage'), ctx = canvas.getContext('2d');
const rad = a => a * Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const add = (p, angle, length) => ({ x: p.x + Math.cos(rad(angle)) * length, y: p.y + Math.sin(rad(angle)) * length });
const angles = ['lean', 'fu', 'fl', 'bu', 'bl', 'ft', 'fs', 'bt', 'bs'];
const contactFor = (name, j) => name === 'kick' ? j.ff : name === 'cross' ? j.bw : j.fw;
function sample(clip, time) {
  const t = clamp(time, 0, clip.duration), frames = clip.frames;
  let i = 0; while (i < frames.length - 2 && frames[i + 1].t <= t) i++;
  const a = frames[i], b = frames[i + 1] ?? a;
  let u = clamp((t - a.t) / Math.max(.00001, b.t - a.t), 0, 1);
  const ease = b.ease ?? 'inout';
  if (ease === 'hold') u = u >= 1 ? 1 : 0;
  else if (ease === 'out') u = 1 - (1 - u) ** 3;
  else if (ease === 'inout') u = u * u * (3 - 2 * u);
  const from = { ...REST, ...a.pose }, to = { ...REST, ...b.pose }, result = {};
  for (const key of Object.keys(REST)) {
    const delta = angles.includes(key) ? ((to[key] - from[key] + 540) % 360) - 180 : to[key] - from[key];
    result[key] = from[key] + delta * u;
  }
  return result;
}
function joints(p) {
  const hip = { x: p.x, y: -68 + p.y }, shoulder = add(hip, p.lean - 90, 45), head = add(shoulder, p.lean - 90, 22);
  const fe = add(shoulder, p.fu, 28), fw = add(fe, p.fl, 27), be = add(shoulder, p.bu, 28), bw = add(be, p.bl, 27);
  const fk = add(hip, p.ft, 38), ff = add(fk, p.fs, 36), bk = add(hip, p.bt, 38), bf = add(bk, p.bs, 36);
  return { hip, shoulder, head, fe, fw, be, bw, fk, ff, bk, bf };
}
let key = 'combo', time = 0, playing = true, speed = 1, mirror = false, bones = false, freeze = 0;
let last = performance.now(), backgroundTime = 0, displayed = -1;
const HERO = { body: '#efe9db', back: '#9d9e97', wrap: '#ed9273', band: '#e9896c' };
const TARGET = { body: '#85b6b7', back: '#506f76', wrap: '#d1c4a7', band: '#42606a' };
const combo = [ { name: 'jab', at: 0 }, { name: 'cross', at: .24 }, { name: 'uppercut', at: .48 } ];
function plan() { return key === 'combo' ? combo : [{ name: key, at: 0 }]; }
function length() { if (key === 'combo') return 1.95; if (key === 'tornado') return 1.95; const c = CLIPS[key]; return c.duration + (c.loop ? 0 : .95); }
function current(t = time) {
  const parts = plan(); let part = parts[0];
  for (const entry of parts) if (entry.at <= t) part = entry;
  return { clip: CLIPS[part.name], name: part.name, local: Math.max(0, t - part.at), at: part.at };
}
function impacts() { return plan().filter(p => CLIPS[p.name].hit !== undefined).map(p => ({ ...p, t: p.at + CLIPS[p.name].hit + (p.name === 'tornado' ? 140 / 225 : 0) })); }
function poseAt(t) {
  const c = current(t);
  return sample(c.clip, c.local);
}
function drawPerson(c, pose, x, y, facing, size, palette, options = {}) {
  const j = joints(pose);
  c.save(); c.translate(x, y); c.scale(facing * size, size); c.globalAlpha = options.alpha ?? 1;
  const line = (a, b, width, color) => { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#121d22'; c.lineWidth = width + 3; c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke(); c.strokeStyle = options.flash ? '#fffde9' : color; c.lineWidth = width; c.stroke(); };
  const chain = (a,b,d,color,w) => { line(a,b,w,color); line(b,d,w-1,color); };
  const hand = (p,color) => { c.fillStyle = options.flash ? '#fffde9' : color; c.beginPath(); c.arc(p.x,p.y,6.3,0,Math.PI*2); c.fill(); };
  const shoe = (p,color) => line({x:p.x-3,y:p.y},{x:p.x+8,y:p.y},8,color);
  chain(j.hip,j.bk,j.bf,palette.back,9); shoe(j.bf,palette.back);
  chain(j.shoulder,j.be,j.bw,palette.back,8); hand(j.bw,palette.wrap);
  line(j.hip,j.shoulder,13,palette.body);
  chain(j.hip,j.fk,j.ff,palette.body,10); shoe(j.ff,palette.body);
  line(j.shoulder,j.head,8,palette.body);
  c.fillStyle=options.flash?'#fffde9':palette.body; c.beginPath();c.arc(j.head.x,j.head.y,13,0,Math.PI*2);c.fill();
  // A headband and two wraps are enough to keep the protagonist recognisable.
  c.strokeStyle=palette.band;c.lineWidth=5;c.beginPath();c.moveTo(j.head.x-12,j.head.y-3);c.lineTo(j.head.x+11,j.head.y-3);c.stroke();
  c.lineWidth=3;c.beginPath();c.moveTo(j.head.x-11,j.head.y-2);c.lineTo(j.head.x-26,j.head.y+Math.sin(backgroundTime*6)*3-7);c.lineTo(j.head.x-32,j.head.y-2);c.stroke();
  c.fillStyle='#25323a';c.fillRect(j.head.x+6,j.head.y-1,3,3);
  chain(j.shoulder,j.fe,j.fw,palette.body,9);hand(j.fw,palette.wrap);
  if (bones && !options.thumbnail) { c.fillStyle='#ffe2a1'; for (const p of Object.values(j)) {c.beginPath();c.arc(p.x,p.y,2.2,0,Math.PI*2);c.fill();} c.strokeStyle='#ffe2a1';c.lineWidth=1;c.strokeRect(j.hip.x-3,j.hip.y-3,6,6); }
  c.restore(); return j;
}
function targetX() {
  const first = impacts()[0]; if (!first) return 446;
  if (first.name === 'tornado') return 475;
  const j = joints(sample(CLIPS[first.name],CLIPS[first.name].hit));
  const contact = contactFor(first.name, j);
  return 270 + clamp(contact.x+9, 55, 108)*1.45;
}
function draw() {
  const w = canvas.clientWidth, h = canvas.clientHeight, ratio = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w*ratio) || canvas.height !== Math.round(h*ratio)) { canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio); }
  ctx.setTransform(ratio*w/720,0,0,ratio*h/350,0,0);
  const c=ctx, floor=271;
  const bg=c.createLinearGradient(0,0,0,350);bg.addColorStop(0,'#27343a');bg.addColorStop(.8,'#202b30');bg.addColorStop(1,'#192227');c.fillStyle=bg;c.fillRect(0,0,720,350);
  c.fillStyle='#34434a';c.fillRect(57,64,110,142);c.fillRect(545,49,120,157);
  c.fillStyle='#26343b';for(let i=0;i<7;i++){c.fillRect(61,72+i*19,102,13);c.fillRect(550,57+i*21,110,15);}
  c.strokeStyle='#425159';c.lineWidth=1;c.beginPath();c.moveTo(0,206);c.lineTo(720,206);c.stroke();
  c.fillStyle='#1c282e';c.fillRect(0,208,720,63);
  c.strokeStyle='#a08b6b';c.lineWidth=2;c.beginPath();c.moveTo(28,floor+2);c.lineTo(692,floor+2);c.stroke();
  for(let i=0;i<12;i++){c.strokeStyle='#2c393f';c.lineWidth=1;c.beginPath();c.moveTo(i*68,276);c.lineTo(i*68-35,350);c.stroke();}
  // Work in a fixed stage; resize with uniform character scale instead of stretching their bones.
  const aspect=(w/h)/(720/350);
  c.save();c.translate(360,floor);c.scale(aspect>1?1/aspect:1,aspect<1?aspect:1);c.translate(-360,-floor);
  if(mirror){c.translate(720,0);c.scale(-1,1);}
  const shadow=(x,width,alpha=.38)=>{c.fillStyle=`rgba(8,16,20,${alpha})`;c.beginPath();c.ellipse(x,floor+2,width,7,0,0,Math.PI*2);c.fill();};
  const pose=poseAt(time), active=current(), hits=impacts().filter(p=>time>=p.t), impact=hits.at(-1);
  let reaction={...REST}, tx=targetX(), ty=floor, flash=false;
  if(impact){
    const d=time-impact.t, heavy=impact.name==='uppercut'||impact.name==='kick'||impact.name==='tornado';
    if(d<.23) {reaction=sample(CLIPS.hurt,Math.min(d,CLIPS.hurt.duration));flash=d<.055;}
    if(heavy){
      // Start from the actual contact pose, then travel through the authored fall.
      // Keep the opponent down until the next demonstration instead of snapping upright.
      reaction=sample(CLIPS.knockdown,Math.min(d,CLIPS.knockdown.duration));
      const u=clamp(d/.8,0,1);tx+=Math.sin(u*Math.PI/2)*45;ty-=Math.sin(u*Math.PI)*40;
    } else if(d<.45) tx+=Math.sin(d/.45*Math.PI)*14;
  }
  shadow(tx,30, .3);drawPerson(c,reaction,tx,ty,-1,1.45,TARGET,{flash});
  shadow(270+pose.x*1.45,29);
  // A brief ghost follows the active limb without softening the current silhouette.
  if(playing && active.clip.hit!==undefined && active.local>=active.clip.hit && active.local<active.clip.hit+.09){drawPerson(c,poseAt(Math.max(0,time-.026)),264,floor,1,1.45,HERO,{alpha:.12});}
  drawPerson(c,pose,270,floor,1,1.45,HERO);
  if(impact){
    const d=time-impact.t;
    if(d<.15 && impact.name!=='tornado'){
      const j=joints(sample(CLIPS[impact.name],CLIPS[impact.name].hit)), contact=contactFor(impact.name,j);
      const x=270+contact.x*1.45,y=floor+contact.y*1.45;
      c.strokeStyle='#ffdc9e';c.lineWidth=3*(1-d/.16);for(let i=0;i<7;i++){const a=i*Math.PI*2/7,inner=6+d*40,outer=20+d*80;c.beginPath();c.moveTo(x+Math.cos(a)*inner,y+Math.sin(a)*inner);c.lineTo(x+Math.cos(a)*outer,y+Math.sin(a)*outer);c.stroke();}
    }
  }
  const emission=plan().find(p=>p.name==='tornado'&&time>=p.at+CLIPS.tornado.hit);
  if(emission){
    const d=time-emission.at-CLIPS.tornado.hit;
    if(d<.85){const x=335+d*225,alpha=Math.min(1,(.85-d)/.2);c.globalAlpha=alpha;
      for(let i=0;i<5;i++){const phase=d*28+i,ringWidth=13+i*6;c.strokeStyle=i%2?'#e5f6d8':'#9bc8bd';c.lineWidth=3;c.beginPath();c.ellipse(x+Math.sin(phase)*4,floor-8-i*16,ringWidth,6,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;}
  }
  c.restore();
  $('clock').textContent=`${time.toFixed(2)}s`;$('timeline').value=Math.round(time*1000);
  $('hit-label').textContent=hits.length?`${hits.length} HIT${hits.length>1?'S':''}`:'';
  $('phase').textContent=freeze>0?'命中停顿':active.local>active.clip.duration?'收势 / 下一轮':active.clip.hit===undefined?(active.clip.loop?'动作循环':'动作演示'):active.local<active.clip.hit?'蓄力':active.local<active.clip.hit+.07?'接触':'收招';
  const n=Math.floor(time*12);if(n!==displayed){displayed=n;document.querySelectorAll('#pose-strip button').forEach(b=>b.classList.toggle('current',Math.abs(Number(b.dataset.time)-time)<.045));}
}
function buildStrip(){
  $('pose-strip').replaceChildren();
  const entries=key==='combo'?combo.flatMap(p=>[{t:p.at,pose:sample(CLIPS[p.name],0)},{t:p.at+CLIPS[p.name].hit,pose:sample(CLIPS[p.name],CLIPS[p.name].hit)}]):CLIPS[key].frames.map(f=>({t:f.t,pose:{...REST,...f.pose}}));
  for(const entry of entries){const b=document.createElement('button'),thumb=document.createElement('canvas'),label=document.createElement('small');thumb.width=164;thumb.height=154;
    const c=thumb.getContext('2d');c.scale(2,2);drawPerson(c,entry.pose,35,70,1,.44,HERO,{thumbnail:true});label.textContent=`${entry.t.toFixed(2)}s`;b.dataset.time=entry.t;b.setAttribute('aria-label',`查看 ${entry.t.toFixed(2)} 秒关键姿势`);b.append(thumb,label);
    b.addEventListener('click',()=>{time=entry.t;freeze=0;playing=false;syncPlay();draw();});$('pose-strip').append(b);}
}
function syncPlay(){$('play').textContent=playing?'暂停':'播放';}
function select(next){key=next;time=0;freeze=0;playing=true;syncPlay();$('clip-name').textContent=key==='combo'?'三连击':CLIPS[key].name;$('description').textContent=key==='combo'?'刺拳接直拳，上勾拳收尾击飞。':CLIPS[key].description;
  $('timeline').max=Math.round(length()*1000);$('end').textContent=`${length().toFixed(2)}s`;document.querySelectorAll('#clips button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clip===key)));buildStrip();draw();}
const names=[['combo','三连击'],['jab','刺拳'],['cross','直拳'],['uppercut','上勾拳'],['kick','前踢'],['tornado','龙卷风'],['dodge','闪避'],['walk','走路'],['run','奔跑'],['hurt','受击'],['knockdown','倒地'],['idle','待机']];
for(const [id,name] of names){const b=document.createElement('button');b.textContent=name;b.dataset.clip=id;b.addEventListener('click',()=>select(id));$('clips').append(b);}
$('play').addEventListener('click',()=>{playing=!playing;syncPlay();});
$('step').addEventListener('click',()=>{playing=false;freeze=0;time=Math.min(length(),time+1/60);syncPlay();draw();});
$('speed').addEventListener('change',e=>{speed=Number(e.target.value);});
$('mirror').addEventListener('click',()=>{mirror=!mirror;$('mirror').setAttribute('aria-pressed',String(mirror));draw();});
$('bones').addEventListener('click',()=>{bones=!bones;$('bones').setAttribute('aria-pressed',String(bones));draw();});
$('timeline').addEventListener('input',e=>{playing=false;freeze=0;time=Number(e.target.value)/1000;syncPlay();draw();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;syncPlay();}last=performance.now();});
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;
  if(playing){backgroundTime+=dt*speed;
    if(freeze>0)freeze=Math.max(0,freeze-dt*speed);
    else{const before=time;time+=dt*speed;const hit=impacts().find(i=>i.t>before+1e-8&&i.t<=time);if(hit){time=hit.t;freeze=hit.name==='uppercut'?.08:.045;}if(time>=length())time=0;}
  }
  draw();requestAnimationFrame(tick);
}
window.addEventListener('error',()=>{$('error').hidden=false;});
select('combo');requestAnimationFrame(tick);
