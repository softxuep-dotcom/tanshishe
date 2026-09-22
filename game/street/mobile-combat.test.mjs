import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { AttackHold, DoublePushRun, readDpad } from './touch-input.ts';
const advance = (g, seconds) => { for (let t=0;t<seconds;t+=1/120) g.update(1/120); };
const game = () => { const g=new StreetGame();g.startTraining('chen','tank',1);g.freezeEnemies=true;g.enemies[0].x=g.hero.x+28;g.enemies[0].y=g.hero.y;return g; };

test('run attack launches immediately on contact, including bosses, and misses do not launch',()=>{
 for (const kind of ['tank','boss']) {
  const g=game();const enemy=g.enemies[0];enemy.kind=kind;enemy.hp=1000;
  g.mx=1;g.sprint=true;g.requestAction('attack');assert.notEqual(enemy.pose,'launched');
  advance(g,.08);assert.equal(enemy.pose,'launched');assert.ok(enemy.vx>300);
  assert.equal(enemy.motion,'launched');assert.equal(enemy.hp,kind === 'boss' ? 993 : 972);assert.ok(g.hitstop>0);
  advance(g,1.3);assert.equal(enemy.pose,'idle');assert.equal(enemy.stun,0);assert.equal(enemy.height,0);
 }
 const miss=game();miss.enemies[0].y+=40;miss.mx=1;miss.sprint=true;miss.requestAction('attack');advance(miss,.1);
 assert.equal(miss.enemies[0].hp,miss.enemies[0].max);assert.notEqual(miss.enemies[0].pose,'launched');
});
test('buffer preserves jump plus attack in either arrival order and repeated attacks cannot overwrite jump',()=>{
 for(const inputs of [['jump','attack'],['attack','jump'],['jump','attack','attack']]) {
  const g=game();g.hero.timer=.1;for(const input of inputs)g.requestAction(input);
  advance(g,.16);assert.equal(g.hero.motion,'airborne');assert.equal(g.hero.pose,'kick');
  assert.equal(g.events.filter(e=>e==='jump').length,1);
 }
});
test('deliberate actions beat attacks: dodge wins a conflicting jump and attack waits for recovery',()=>{
 const g=game();g.hero.timer=.05;g.requestAction('jump');g.requestAction('attack');g.requestAction('dodge');
 advance(g,.07);assert.equal(g.hero.pose,'dodge');assert.equal(g.hero.height,0);
 assert.equal(g.events.includes('swing'),false);
});
test('sliding off cancels queued repeat but preserves jump and the punch already in flight',()=>{
 const g=game();g.requestAction('attack');g.held=true;g.requestAction('attack');g.stopHeldAttack();
 advance(g,.6);assert.equal(g.combo,1);assert.equal(g.held,false);
 const jump=game();jump.hero.timer=.1;jump.requestAction('jump');jump.requestAction('attack');jump.stopHeldAttack();
 advance(jump,.16);assert.equal(jump.hero.pose,'jump');assert.equal(jump.events.includes('swing'),false);
});
test('captured attack pointer stops outside circle, ignores other fingers, never resumes on re-entry',()=>{
 const hold=new AttackHold(),bounds={left:100,top:100,width:80,height:80};
 assert.equal(hold.begin(1),true);assert.equal(hold.begin(2),false);
 assert.equal(hold.move(2,0,0,bounds),false);assert.equal(hold.end(2),false);
 assert.equal(hold.move(1,140,140,bounds),false);
 assert.equal(hold.move(1,101,101,bounds),true); // Outside circle but inside bounding rectangle.
 assert.equal(hold.move(1,140,140,bounds),false);assert.equal(hold.end(1),false);
 assert.equal(hold.begin(3),true);assert.equal(hold.end(3),true);
 assert.equal(hold.begin(4),true);hold.reset();assert.equal(hold.end(4),false);
});

test('neutral dodge retreats, keeps facing, costs no rage and does not attack',()=>{
 for (const face of [-1,1]) {
  const g=game();g.hero.x=220;g.hero.face=face;const hp=g.enemies[0].hp;
  g.requestAction('dodge');assert.equal(g.hero.pose,'dodge');advance(g,.2);
  assert.ok(Math.abs(g.hero.x-(220-face*43.2))<.01);
  assert.equal(g.hero.face,face);assert.equal(g.rage,50);assert.equal(g.enemies[0].hp,hp);
 }
});
test('directional dodge commits to its initial direction and respects arena bounds',()=>{
 const g=game();g.mx=1;g.my=1;g.requestAction('dodge');g.mx=-1;g.my=-1;
 advance(g,.2);assert.ok(g.hero.x>110);assert.ok(g.hero.y>215);
 const edge=game();edge.hero.x=22;edge.hero.y=157;edge.mx=-1;edge.my=-1;
 edge.requestAction('dodge');advance(edge,.2);assert.equal(edge.hero.x,22);assert.equal(edge.hero.y,157);
});
test('dodge avoids damage briefly but recovery is vulnerable and cannot be spammed',()=>{
 const g=game();g.godMode=false;g.requestAction('dodge');g.hurt(10,1);
 assert.equal(g.hero.hp,g.hero.max);advance(g,.2);g.hurt(10,1);
 assert.equal(g.hero.hp,g.hero.max-10);
 const h=game();h.requestAction('dodge');advance(h,.36);h.requestAction('dodge');
 assert.equal(h.hero.pose,'idle');advance(h,.21);h.requestAction('dodge');assert.equal(h.hero.pose,'dodge');
});
test('dodge rejects air, carrying, stun and pause, and restart clears cooldown',()=>{
 for(const setup of [g=>{g.hero.motion='airborne';g.hero.height=25;},g=>g.carried={id:99,x:0,y:0,snack:false},g=>g.hero.stun=.4,g=>g.paused=true]) {
  const g=game();setup(g);g.requestAction('dodge');assert.notEqual(g.hero.pose,'dodge');assert.equal(g.dodgeCooldown,0);
 }
 const g=game();g.requestAction('dodge');g.startTraining('chen');assert.equal(g.dodgeCooldown,0);
 advance(g,.1);assert.equal(g.hero.x,85);
});
test('dodge buffers after attacks, allows follow-up attack and pauses with the simulation',()=>{
 const g=game();g.hero.timer=.1;g.requestAction('dodge');advance(g,.12);assert.equal(g.hero.pose,'dodge');
 const x=g.hero.x,cooldown=g.dodgeCooldown;g.paused=true;advance(g,1);
 assert.equal(g.hero.x,x);assert.equal(g.dodgeCooldown,cooldown);g.paused=false;
 advance(g,.19);g.requestAction('attack');advance(g,.16);assert.equal(g.hero.pose,'punch');
});

test('d-pad ignores its centre, snaps to eight directions and always walks at full speed',()=>{
 assert.deepEqual(readDpad(3,2,50),{x:0,y:0,dir:''});
 assert.deepEqual(readDpad(0,0,50),{x:0,y:0,dir:''});
 assert.deepEqual(readDpad(15,0,50),readDpad(55,0,50));
 assert.deepEqual(readDpad(30,5,50),{x:1,y:0,dir:'r'});
 assert.deepEqual(readDpad(5,-30,50),{x:0,y:-1,dir:'u'});
 assert.deepEqual(readDpad(-30,30,50),{x:-.707,y:.707,dir:'dl'});
});
test('same-direction double push starts running and holding preserves it',()=>{
 for(const direction of [-1,1]) {
  const input=new DoublePushRun();
  assert.equal(input.update(direction,0,0),false);
  assert.equal(input.update(direction,0,70),false);
  assert.equal(input.update(0,0,100),false);
  assert.equal(input.update(direction,0,180),true);
  assert.equal(input.update(direction,.3,1500),true);
  assert.equal(input.update(0,0,1600),false);
 }
});
test('slow pushes, opposite directions, vertical movement and edge jitter do not trigger a run',()=>{
 const input=new DoublePushRun();
 input.update(1,0,0);input.update(0,0,100);assert.equal(input.update(1,0,400),false);
 assert.equal(input.update(.4,0,420),false);assert.equal(input.update(1,0,450),false);
 input.update(0,0,470);assert.equal(input.update(-1,0,500),false);
 input.update(0,1,520);assert.equal(input.update(-1,0,550),false);
});
test('cancel/reset forgets the first push; reversal immediately stops running',()=>{
 const input=new DoublePushRun();input.update(1,0,0);input.update(0,0,40);input.reset();
 assert.equal(input.update(1,0,90),false);input.update(0,0,110);
 assert.equal(input.update(1,0,150),true);
 assert.equal(input.update(-.3,0,170),false);
 assert.equal(input.update(1,0,180),false);
 input.reset();assert.equal(input.update(1,0,210),false);
});
test('a tap near recovery end queues one attack and does not repeat',()=>{
 const g=game();g.hero.timer=.1;g.requestAction('attack');advance(g,.2);
 assert.equal(g.combo,1);advance(g,.8);assert.equal(g.combo,1);
});
test('expired inputs and inputs cleared by pause are not replayed',()=>{
 const g=game();g.hero.timer=.4;g.requestAction('attack');advance(g,.7);assert.equal(g.combo,0);
 g.hero.timer=.1;g.requestAction('attack');g.clearInput();advance(g,.3);assert.equal(g.combo,0);
});
test('buffered jump followed by attack becomes an air kick',()=>{
 const g=game();g.hero.timer=.08;g.requestAction('jump');advance(g,.1);assert.equal(g.hero.motion,'takeoff');
 g.requestAction('attack');advance(g,.04);assert.equal(g.hero.pose,'kick');advance(g,.08);assert.equal(g.combo,1);
});
test('fresh running attack dashes but held repeat does not repeatedly dash',()=>{
 const g=game();g.mx=1;g.sprint=true;g.requestAction('attack');g.held=true;
 assert.equal(g.hero.pose,'dash');advance(g,.55);assert.notEqual(g.hero.pose,'dash');
 g.clearInput();assert.equal(g.running,false);assert.equal(g.sprint,false);
});
test('running is faster, but carrying and airborne movement cannot sprint',()=>{
 const walk=game(),run=game();walk.mx=1;run.mx=1;run.sprint=true;advance(walk,.2);advance(run,.2);
 assert.ok(run.hero.x>walk.hero.x+8);
 run.carried={id:999,x:0,y:0,snack:false};assert.equal(run.running,false);
 run.carried=null;run.hero.motion='airborne';run.hero.height=25;assert.equal(run.running,false);
});
test('directional attacks ignore enemies behind and hurt cancels pending impact',()=>{
 const g=game();g.mx=1;g.enemies[0].x=g.hero.x-25;g.requestAction('attack');advance(g,.08);
 assert.equal(g.hero.face,1);assert.equal(g.combo,0);
 const h=game();h.godMode=false;h.requestAction('attack');h.hurt(10,1);advance(h,.12);assert.equal(h.combo,0);
});
test('contact is checked at impact and attack does not hit twice',()=>{
 const g=game();g.requestAction('attack');g.enemies[0].y+=40;advance(g,.08);assert.equal(g.combo,0);
 const h=game();h.requestAction('attack');advance(h,.5);assert.equal(h.combo,1);
});
test('grab hint excludes bosses and air grabs, missed grab does not lock movement',()=>{
 const g=game();assert.equal(g.grabTarget,g.enemies[0]);g.hero.motion='airborne';g.hero.height=25;assert.equal(g.grabTarget,undefined);
 g.action('throw');assert.equal(g.enemies[0].hp,g.enemies[0].max);g.hero.motion='grounded';g.hero.height=0;
 g.enemies[0].kind='boss';assert.equal(g.grabTarget,undefined);g.crates=[];g.action('throw');assert.equal(g.hero.timer,0);
});
test('third punch has stronger impact than the opener',()=>{
 const g=game();g.enemies[0].hp=1000;g.enemies[0].max=1000;
 g.requestAction('attack');advance(g,.06);const light=g.hitstop;
 advance(g,.25);g.enemies[0].x=g.hero.x+28;g.requestAction('attack');advance(g,.32);
 g.enemies[0].x=g.hero.x+28;g.requestAction('attack');advance(g,.09);
 assert.equal(g.hero.pose,'uppercut');assert.ok(g.hitstop>light);assert.ok(g.enemies[0].vx>100);
});
