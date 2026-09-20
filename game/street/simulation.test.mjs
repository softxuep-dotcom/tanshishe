import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
const advance = (g, secs) => { for(let t=0;t<secs;t+=1/120) g.update(1/120); };
const start = (role='chen') => { const g=new StreetGame();g.start(role);g.proceed();return g; };
test('punch only hits enemies in range and lane; pause blocks combat',()=>{
 const g=start(); const [a,b]=g.enemies; a.x=g.hero.x+28;a.y=g.hero.y;b.x=g.hero.x+25;b.y=g.hero.y+45;
 g.action('attack');assert.ok(a.hp<a.max);assert.equal(b.hp,b.max);
 const hp=a.hp;g.paused=true;advance(g,2);g.action('special');assert.equal(a.hp,hp);assert.equal(g.rage,55);
});
test('throw damages the target and enemies behind it, not distant enemies',()=>{
 const g=start('tuo');const [a,b,c]=g.enemies;a.x=g.hero.x+22;a.y=g.hero.y;b.x=a.x+60;b.y=a.y;c.x=a.x+200;c.y=a.y;
 g.action('throw');assert.equal(a.hp,a.max-42);assert.equal(b.hp,b.max-25);assert.equal(c.hp,c.max);assert.equal(a.pose,'thrown');
});
test('special requires rage and jump avoids ground hits',()=>{
 const g=start();g.rage=49;g.action('special');assert.equal(g.rage,49);g.action('jump');g.hurt(20,1);assert.equal(g.hero.hp,g.hero.max);
 g.hero.jump=0;g.hurt(20,1);assert.equal(g.hero.hp,g.hero.max-20);g.hurt(20,1);assert.equal(g.hero.hp,g.hero.max-20);
});
test('all three streets lead to the boss and a real victory',()=>{
 const g=start();
 for(let wave=0;wave<3;wave++) {
   for(const e of g.enemies) g.hit(e,999,0);
   advance(g,1);g.mx=1;advance(g,7);g.mx=0;
 }
 assert.equal(g.phase,'bossIntro');g.proceed();assert.equal(g.enemies[0].kind,'boss');advance(g,.05);
 assert.ok(g.hero.x<1200,'boss arena must not clamp the player into the boss');
 g.hit(g.enemies[0],999,0);advance(g,1);assert.equal(g.phase,'won');
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
 for(const e of g.enemies)g.hit(e,999,0);g.mx=1;advance(g,9);assert.equal(g.phase,'playing');assert.equal(g.wave,0);
 g.freezeEnemies=true;g.showRanges=true;g.resetTraining();assert.equal(g.enemies.length,2);assert.equal(g.hero.hp,g.hero.max);assert.equal(g.freezeEnemies,true);assert.equal(g.showRanges,true);
 g.godMode=false;g.hurt(999,1);assert.equal(g.phase,'lost');g.resetTraining();assert.equal(g.phase,'playing');assert.equal(g.godMode,false);
 g.start('chen');assert.equal(g.training,false);assert.equal(g.showRanges,false);assert.equal(g.godMode,false);
});
test('training freeze stops enemy decisions but enemies can still be hit',()=>{
 const g=new StreetGame();g.startTraining('chen','punk',1);g.freezeEnemies=true;const e=g.enemies[0];const x=e.x;advance(g,2);assert.equal(e.x,x);assert.equal(e.wind,0);
 e.x=g.hero.x+25;e.y=g.hero.y;g.action('attack');assert.ok(e.hp<e.max);
});

test('night market completion leads to cargo chapter with same hero and clean state',()=>{
 const g=start('man');g.phase='won';g.hero.hp=20;g.nextChapter();assert.equal(g.chapter,1);assert.equal(g.role,'man');assert.equal(g.phase,'intro');assert.equal(g.hero.hp,g.hero.max);g.proceed();assert.ok(g.enemies.some(e=>e.kind==='slinger'));assert.equal(g.crates.length,2);
 g.start(g.role,g.chapter);assert.equal(g.chapter,1);assert.equal(g.shots.length,0);assert.equal(g.carried,null);
});
test('cargo chapter completes all encounters and longleg boss',()=>{
 const g=new StreetGame();g.start('chen',1);g.proceed();
 for(let wave=0;wave<3;wave++){ for(const e of g.enemies)g.hit(e,999,0);advance(g,1);g.mx=1;advance(g,7);g.mx=0; }
 assert.equal(g.phase,'bossIntro');g.proceed();assert.equal(g.enemies[0].kind,'longleg');assert.equal(g.crates.length,2);g.hit(g.enemies[0],999,0);advance(g,1);assert.equal(g.phase,'won');g.nextChapter();assert.equal(g.chapter,1);assert.equal(g.phase,'won');
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
test('cans respect crate cover and jump immunity',()=>{
 const g=new StreetGame();g.startTraining('chen');g.freezeEnemies=true;g.godMode=false;g.hero.x=100;g.hero.y=211;
 g.shots.push({x:190,y:211,vx:-170,life:2,crate:false,snack:false});advance(g,.7);assert.equal(g.hero.hp,g.hero.max);assert.equal(g.shots.length,0);
 g.crates=[];g.shots.push({x:125,y:211,vx:-170,life:2,crate:false,snack:false});g.action('jump');advance(g,.12);assert.equal(g.hero.hp,g.hero.max);
 g.hero.jump=0;g.shots.push({x:125,y:211,vx:-170,life:2,crate:false,snack:false});advance(g,.2);assert.equal(g.hero.hp,g.hero.max-12);
});
test('slinger telegraphs before throwing and longleg leaves recovery after a dodge',()=>{
 const g=new StreetGame();g.startTraining('chen','slinger');g.hero.x=85;g.hero.y=200;g.enemies[0].y=200;g.enemies[0].timer=0;advance(g,.1);assert.ok(g.enemies[0].wind>0);assert.equal(g.shots.length,0);advance(g,1);assert.ok(g.shots.length>0);
 g.setTrainingOpponents('longleg',1);g.hero.x=190;g.hero.y=200;const e=g.enemies[0];e.x=270;e.y=200;e.timer=0;g.godMode=false;advance(g,.1);assert.ok(e.wind>0);g.hero.y=241;advance(g,.8);assert.ok(e.stun>0);assert.equal(g.hero.hp,g.hero.max);
});
