import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { readStick } from './touch-input.ts';
const advance = (g, seconds) => { for (let t=0;t<seconds;t+=1/120) g.update(1/120); };
const game = () => { const g=new StreetGame();g.startTraining('chen','tank',1);g.freezeEnemies=true;g.enemies[0].x=g.hero.x+28;g.enemies[0].y=g.hero.y;return g; };

test('stick deadzone, walking, horizontal sprint hysteresis and vertical lane changes',()=>{
 assert.equal(readStick(3,2,50,false).x,0);
 const walk=readStick(35,0,50,false);assert.ok(walk.x>0);assert.equal(walk.sprint,false);
 assert.equal(readStick(55,0,50,false).sprint,true);
 assert.equal(readStick(45,0,50,true).sprint,true);
 assert.equal(readStick(35,0,50,true).sprint,false);
 assert.equal(readStick(0,60,50,false).sprint,false);
 assert.deepEqual(readStick(0,0,50,true),{x:0,y:0,knobX:0,knobY:0,sprint:false});
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
 const g=game();g.hero.timer=.08;g.requestAction('jump');advance(g,.1);assert.ok(g.hero.jump>0);
 g.requestAction('attack');assert.equal(g.hero.pose,'kick');advance(g,.08);assert.equal(g.combo,1);
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
 run.carried=null;run.hero.jump=.3;assert.equal(run.running,false);
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
 const g=game();assert.equal(g.grabTarget,g.enemies[0]);g.hero.jump=.4;assert.equal(g.grabTarget,undefined);
 g.action('throw');assert.equal(g.enemies[0].hp,g.enemies[0].max);g.hero.jump=0;
 g.enemies[0].kind='boss';assert.equal(g.grabTarget,undefined);g.crates=[];g.action('throw');assert.equal(g.hero.timer,0);
});
test('third punch has stronger impact than the opener',()=>{
 const g=game();g.enemies[0].hp=1000;g.enemies[0].max=1000;
 g.requestAction('attack');advance(g,.06);const light=g.hitstop;
 advance(g,.25);g.enemies[0].x=g.hero.x+28;g.requestAction('attack');advance(g,.32);
 g.enemies[0].x=g.hero.x+28;g.requestAction('attack');advance(g,.06);
 assert.equal(g.hero.pose,'uppercut');assert.ok(g.hitstop>light);assert.ok(g.enemies[0].vx>100);
});
