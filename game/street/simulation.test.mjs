import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
const advance = (g, secs) => { for(let t=0;t<secs;t+=1/120) g.update(1/120); };
const start = (role='chen') => { const g=new StreetGame();g.start(role);g.proceed();return g; };
const clearEncounter = g => {
 g.hero.inv=100;g.mx=0;
 for(let frame=0;frame<120*12 && !g.encounterClear;frame++) {
  for(const e of g.enemies)g.hit(e,9999,0);
  g.update(1/120);
 }
 assert.equal(g.encounterClear,true,'all queued reinforcements must also be defeated');
};

const meleeArena = () => {
 const g=new StreetGame();g.startTraining('chen','punk',4);g.hero.x=220;g.hero.y=199;
 g.enemies.forEach((e,i)=>{e.x=260+i*35;e.y=180+i*12;e.timer=0;});return g;
};
test('melee enemies reserve unique attack/waiting slots, no more than two start attacks',()=>{
 const g=meleeArena();const seen=new Set();
 for(let i=0;i<120*12;i++) {
  g.update(1/120);
  const occupied=g.enemySlots.filter(s=>s.occupant!==null);
  assert.equal(new Set(occupied.map(s=>s.occupant)).size,occupied.length);
  assert.equal(occupied.length,4);
  assert.ok(occupied.filter(s=>s.attack).length<=2);
  assert.ok(g.enemies.filter(e=>e.wind>0||e.charge>0).length<=2);
  g.enemies.filter(e=>e.wind>0).forEach(e=>seen.add(e.id));
 }
 assert.equal(seen.size,4,'waiting enemies must eventually take their turn');
});
test('at the four arena corners, valid slots stay distinct and enemies can still attack',()=>{
 for(const x of [22,435])for(const y of [157,243]) {
  const g=meleeArena();g.hero.x=x;g.hero.y=y;let attacked=false;
  for(let i=0;i<120*15;i++) {g.update(1/120);attacked ||=g.enemies.some(e=>e.wind>0);}
  assert.ok(attacked,`no attack at ${x},${y}`);
  assert.equal(g.enemySlots.filter(s=>s.occupant!==null).length,4);
  assert.equal(new Set(g.enemySlots.map(s=>`${s.x},${s.y}`)).size,g.enemySlots.length);
  for(const s of g.enemySlots){assert.ok(s.x>=15&&s.x<=440);assert.ok(s.y>=156&&s.y<=242);}
 }
});
test('damage releases a reservation and waiting enemies fill it, restart discards reservations',()=>{
 const g=meleeArena();g.update(.01);const slot=g.enemySlots.find(s=>s.attack&&s.occupant!==null);
 const victim=g.enemies.find(e=>e.id===slot.occupant);g.hit(victim,999,0);
 assert.equal(g.enemySlots.some(s=>s.occupant===victim.id),false);
 g.hitstop=0;g.update(.01);
 assert.ok(g.enemySlots.find(s=>s.id===slot.id).occupant!==null);
 g.setTrainingOpponents('tank',2);assert.equal(g.enemySlots.length,0);
 g.update(.01);const ids=new Set(g.enemies.map(e=>e.id));
 assert.ok(g.enemySlots.every(s=>s.occupant===null||ids.has(s.occupant)));
 g.start('chen');assert.equal(g.enemySlots.length,0);
});
test('crossing the crowd reassigns slots, and enemies route around the player',()=>{
 const g=meleeArena();g.enemies=g.enemies.slice(0,1);g.enemies[0].x=190;g.enemies[0].y=199;
 g.update(.01);g.enemies[0].wind=0;g.enemies[0].timer=0;
 g.hero.x=130;g.update(.01);
 assert.ok(g.enemySlots.find(s=>s.occupant===g.enemies[0].id).x>g.hero.x);
 const crowd=meleeArena();let checked=false;
 for(let i=0;i<120*8;i++) {
  crowd.update(1/120);
  for(const e of crowd.enemies)if(Math.abs(e.x-crowd.hero.x)<18){assert.ok(Math.abs(e.y-crowd.hero.y)>=25);checked=true;}
 }
 assert.ok(checked,'one enemy should pass around the player to the far slot');
});
test('ranged enemies and bosses do not reserve melee slots; frozen opponents do not move',()=>{
 const g=meleeArena();g.enemies[0].kind='slinger';g.enemies[1].kind='boss';g.enemies[2].kind='longleg';
 g.freezeEnemies=true;const positions=g.enemies.map(e=>[e.x,e.y]);advance(g,1);
 assert.deepEqual(g.enemies.map(e=>[e.x,e.y]),positions);
 assert.ok(g.enemySlots.every(s=>s.occupant===null||s.occupant===g.enemies[3].id));
});

const comboArena = (role='chen', count=1) => {
 const g=new StreetGame();g.startTraining(role,'tank',count);g.freezeEnemies=true;
 g.enemies.forEach(e=>{e.hp=e.max=1000;e.x=g.hero.x+25;e.y=g.hero.y;});return g;
};
const swing = (g, hits=true) => {
 g.enemies.forEach(e=>{e.x=g.hero.x+25;e.y=g.hero.y+(hits?0:40);e.vx=0;});
 g.requestAction('attack');const step=g.attackStep;advance(g,.50);return step;
};
test('all roles earn the finisher only through consecutive hits; misses cannot bank it',()=>{
 for(const role of ['chen','tuo','man']) {
  const g=comboArena(role);
  assert.deepEqual([swing(g,false),swing(g,false),swing(g,false)],[0,0,0]);
  assert.deepEqual([swing(g),swing(g),swing(g)],[0,1,2]);
  advance(g,.9); // The finisher now launches: wait for landing and get-up before a new chain.
  assert.equal(swing(g),0);assert.equal(swing(g,false),1);assert.equal(swing(g),0);
 }
});
test('one punch hitting several enemies advances the chain once, not once per victim',()=>{
 const g=comboArena('chen',3);assert.equal(swing(g),0);assert.equal(g.combo,3);
 assert.equal(swing(g),1);assert.equal(g.combo,6);assert.equal(swing(g),2);
});
test('timeout, injury and non-ground attacks cannot supply a grounded combo step',()=>{
 const g=comboArena();swing(g);advance(g,.8);assert.equal(swing(g),0);
 g.godMode=false;g.hurt(1,-1);advance(g,.4);assert.equal(swing(g),0);
 const air=comboArena();air.action('jump');swing(air);advance(air,.35);assert.equal(swing(air),0);
 const dash=comboArena();dash.mx=1;dash.sprint=true;dash.requestAction('attack');advance(dash,.6);
 dash.clearInput();assert.equal(swing(dash),0);
});
test('punch only hits enemies in range and lane; pause blocks combat',()=>{
 const g=start(); const [a,b]=g.enemies; a.x=g.hero.x+28;a.y=g.hero.y;b.x=g.hero.x+25;b.y=g.hero.y+45;
 g.action('attack');assert.equal(a.hp,a.max);advance(g,.07);assert.ok(a.hp<a.max);assert.equal(b.hp,b.max);
 const hp=a.hp;g.paused=true;advance(g,2);g.action('special');assert.equal(a.hp,hp);assert.equal(g.rage,55);
});
test('throw damages the target and enemies behind it, not distant enemies',()=>{
 const g=new StreetGame();g.startTraining('tuo','punk',3);g.freezeEnemies=true;const [a,b,c]=g.enemies;a.x=g.hero.x+22;a.y=g.hero.y;b.x=a.x+60;b.y=a.y;c.x=a.x+200;c.y=a.y;
 g.action('throw');assert.equal(a.hp,a.max-42);assert.equal(b.hp,b.max);assert.equal(a.pose,'thrown');
 advance(g,.35);assert.equal(b.hp,b.max-25);assert.equal(c.hp,c.max);assert.equal(b.motion,'launched');
});
test('special requires rage and jump avoids ground hits',()=>{
 const g=start();g.rage=49;g.action('special');assert.equal(g.rage,49);g.action('jump');advance(g,.22);g.hurt(20,1);assert.equal(g.hero.hp,g.hero.max);
 advance(g,.6);g.hurt(20,1);assert.equal(g.hero.hp,g.hero.max-20);g.hurt(20,1);assert.equal(g.hero.hp,g.hero.max-20);
});
test('all three streets lead to the boss and a real victory',()=>{
 const g=start();
 for(let wave=0;wave<3;wave++) {
   clearEncounter(g);g.mx=1;advance(g,7);g.mx=0;
 }
 assert.equal(g.phase,'bossIntro');g.proceed();assert.equal(g.enemies[0].kind,'boss');advance(g,.05);
 assert.ok(g.hero.x<1200,'boss arena must not clamp the player into the boss');
 g.hit(g.enemies[0],9999,0);advance(g,1);assert.equal(g.phase,'won');
});
test('boss telegraphs, charges, then leaves a punish window',()=>{
 const g=start();g.wave=3;g.hero.x=1100;g.hero.y=200;g.enemies=[g.fighter('boss',1200,200,330)];g.enemies[0].timer=0;
 advance(g,.1);assert.ok(g.enemies[0].wind>0);const hp=g.hero.hp;assert.equal(g.hero.hp,hp);
 g.hero.y=240;advance(g,1.6);assert.equal(g.hero.hp,hp);assert.ok(g.enemies[0].stun>0);
});
test('death stops play and restart clears held movement and resets health',()=>{
 const g=start();g.mx=1;g.held=true;g.hurt(999,1);assert.equal(g.phase,'lost');assert.equal(g.mx,0);g.start('man');assert.equal(g.hero.hp,g.hero.max);assert.equal(g.held,false);assert.equal(g.phase,'intro');
});

test('training stays in arena after all enemies die and resets without story',()=>{
 const g=new StreetGame();g.startTraining('tuo','boss',2);assert.equal(g.phase,'playing');assert.equal(g.enemies.length,2);
 const hp=g.hero.hp;g.hurt(999,1);assert.equal(g.hero.hp,hp);
 for(const e of g.enemies)g.hit(e,9999,0);g.mx=1;advance(g,9);assert.equal(g.phase,'playing');assert.equal(g.wave,0);
 g.freezeEnemies=true;g.showRanges=true;g.resetTraining();assert.equal(g.enemies.length,2);assert.equal(g.hero.hp,g.hero.max);assert.equal(g.freezeEnemies,true);assert.equal(g.showRanges,true);
 g.godMode=false;g.hurt(999,1);assert.equal(g.phase,'lost');g.resetTraining();assert.equal(g.phase,'playing');assert.equal(g.godMode,false);
 g.start('chen');assert.equal(g.training,false);assert.equal(g.showRanges,false);assert.equal(g.godMode,false);
});
test('training freeze stops enemy decisions but enemies can still be hit',()=>{
 const g=new StreetGame();g.startTraining('chen','punk',1);g.freezeEnemies=true;const e=g.enemies[0];const x=e.x;advance(g,2);assert.equal(e.x,x);assert.equal(e.wind,0);
 e.x=g.hero.x+25;e.y=g.hero.y;g.action('attack');advance(g,.07);assert.ok(e.hp<e.max);
});

test('night market completion leads to cargo chapter with same hero and clean state',()=>{
 const g=start('man');g.phase='won';g.hero.hp=20;g.nextChapter();assert.equal(g.chapter,1);assert.equal(g.role,'man');assert.equal(g.phase,'intro');assert.equal(g.hero.hp,g.hero.max);g.proceed();assert.ok(g.enemies.some(e=>e.kind==='slinger'));assert.equal(g.crates.length,2);
 g.start(g.role,g.chapter);assert.equal(g.chapter,1);assert.equal(g.shots.length,0);assert.equal(g.carried,null);
});
test('cargo chapter completes all encounters and longleg boss',()=>{
 const g=new StreetGame();g.start('chen',1);g.proceed();
 for(let wave=0;wave<3;wave++){ clearEncounter(g);g.mx=1;advance(g,7);g.mx=0; }
 assert.equal(g.phase,'bossIntro');g.proceed();assert.equal(g.enemies[0].kind,'longleg');assert.equal(g.crates.length,2);g.hit(g.enemies[0],9999,0);advance(g,1);assert.equal(g.phase,'won');g.nextChapter();assert.equal(g.chapter,2);assert.equal(g.phase,'intro');
});
test('crate can be lifted, put down, and thrown with lane-specific splash and supply',()=>{
 const g=new StreetGame();g.startTraining('chen','tank',3);g.freezeEnemies=true;g.hero.x=143;g.hero.y=211;g.hero.face=1;
 g.action('throw');assert.ok(g.carried);assert.equal(g.crates.length,1);advance(g,.5);g.action('throw');assert.equal(g.carried,null);assert.equal(g.crates.length,2);
 advance(g,.3);g.action('throw');assert.ok(g.carried);advance(g,.5);
 const [a,b,c]=g.enemies;a.x=245;a.y=211;b.x=270;b.y=212;c.x=260;c.y=166;g.hero.hp=80;
 g.action('attack');assert.equal(g.carried,null);assert.equal(g.shots.length,1);advance(g,.6);assert.equal(a.hp,50);assert.equal(b.hp,50);assert.equal(c.hp,86);assert.equal(g.snacks.length,1);
 g.hero.x=g.snacks[0].x;g.hero.y=g.snacks[0].y;advance(g,.05);assert.equal(g.hero.hp,110);assert.equal(g.snacks.length,0);
});
test('close enemy takes priority over crate; bosses cannot be grabbed',()=>{
 const g=new StreetGame();g.startTraining('chen','punk',1);g.hero.x=143;g.hero.y=211;g.enemies[0].x=166;g.enemies[0].y=211;g.action('throw');assert.equal(g.carried,null);assert.equal(g.enemies[0].pose,'thrown');
 g.setTrainingOpponents('longleg',1);g.hero.timer=0;g.enemies[0].x=166;g.enemies[0].y=211;g.action('throw');assert.ok(g.carried);assert.equal(g.enemies[0].hp,330);
});
test('damage drops carried crate and training reset clears projectiles',()=>{
 const g=new StreetGame();g.startTraining('chen');g.hero.x=143;g.hero.y=211;g.action('throw');g.godMode=false;g.hurt(10,1);assert.equal(g.carried,null);assert.equal(g.crates.length,2);g.shots.push({x:200,y:211,vx:100,life:1,crate:false,snack:false});g.resetTraining();assert.equal(g.shots.length,0);assert.equal(g.crates.length,2);
});
test('cans respect crate cover and actual jump height',()=>{
 const g=new StreetGame();g.startTraining('chen');g.freezeEnemies=true;g.godMode=false;g.hero.x=100;g.hero.y=211;
 g.shots.push({x:190,y:211,vx:-170,life:2,crate:false,snack:false});advance(g,.7);assert.equal(g.hero.hp,g.hero.max);assert.equal(g.shots.length,0);
 g.crates=[];g.action('jump');advance(g,.22);g.shots.push({x:125,y:211,vx:-170,life:2,crate:false,snack:false});advance(g,.12);assert.equal(g.hero.hp,g.hero.max);
 advance(g,.5);g.shots.push({x:125,y:211,vx:-170,life:2,crate:false,snack:false});advance(g,.2);assert.equal(g.hero.hp,g.hero.max-12);
});
test('slinger telegraphs before throwing and longleg leaves recovery after a dodge',()=>{
 const g=new StreetGame();g.startTraining('chen','slinger');g.hero.x=85;g.hero.y=200;g.enemies[0].y=200;g.enemies[0].timer=0;advance(g,.1);assert.ok(g.enemies[0].wind>0);assert.equal(g.shots.length,0);advance(g,1);assert.ok(g.shots.length>0);
 g.setTrainingOpponents('longleg',1);g.hero.x=190;g.hero.y=200;const e=g.enemies[0];e.x=270;e.y=200;e.timer=0;g.godMode=false;advance(g,.1);assert.ok(e.wind>0);g.hero.y=241;advance(g,1);assert.ok(e.vulnerable>0);assert.equal(g.hero.hp,g.hero.max);
});
