import test from 'node:test';
import assert from 'node:assert/strict';
import { HookGame } from './simulation.ts';
function advance(g, seconds, dt = 1 / 120) {
  for (let t = 0; t < seconds - 1e-8; t += dt) g.update(Math.min(dt, seconds - t));
}
function pull(g, id, seconds = 3) {
  const target = g.bodies.find(b => b.id === id);
  assert.equal(g.beginPull(target.x, target.y), true, `could not hook ${id}: ${g.notice}`);
  advance(g, seconds); g.endPull(); advance(g, .7);
}

export const routes = [
 { name:'A', level:0, steps:[['box']] },
 { name:'B', level:1, steps:[['a5'],['heavy'],['a2'],['box'],['a4'],['box']] },
 { name:'C-plate', level:2, steps:[['a2'],['heavy'],['a7'],['box'],['a5'],['box'],['heavy']] },
 { name:'C-bypass', level:2, steps:[['a3'],['a1'],['box'],['a3'],['box'],['a6'],['box'],['a5'],['box']] },
];
const state = g => ({bodies:structuredClone(g.bodies), moves:g.moves,time:g.time,gateOpen:g.gateOpen,plateActive:g.plateActive});
const body = (g,id) => g.bodies.find(b=>b.id===id);
function start(g,id) { const b=body(g,id); assert.equal(g.beginPull(b.x,b.y),true, `could not hook ${id}: ${g.notice}`); }
function replay(route,dt=1/120) {
 const g=new HookGame();g.loadLevel(route.level);
 for(const [id,secs=3] of route.steps) {start(g,id);advance(g,secs,dt);g.endPull();advance(g,.7,dt);}
 return g;
}
function wallGap(b,w) {
 const x=Math.max(w.x,Math.min(b.x,w.x+w.w)), y=Math.max(w.y,Math.min(b.y,w.y+w.h));
 return Math.hypot(b.x-x,b.y-y)-b.r;
}
function noPenetration(g) {
 for(const b of g.bodies.filter(b=>b.kind!=='anchor')) {
  assert.ok([b.x,b.y,b.vx,b.vy].every(Number.isFinite), `${b.id} finite state`);
  for(const wall of g.solids) assert.ok(wallGap(b,wall)>-1e-7, `${b.id} wall penetration ${wallGap(b,wall)}`);
 }
}

for(const route of routes) test(`${route.name} solves using real target clicks`,()=>{
 const g=replay(route); assert.equal(g.snapshot().canShip,true); assert.equal(g.ship(),true);assert.equal(g.phase,'won');
});

test('pause releases the held hook, freezes time and positions, resume requires a new press',()=>{
 const g=new HookGame();start(g,'box');advance(g,.2);g.pause();
 assert.equal(g.targetId,null);assert.equal(g.phase,'paused');const paused=state(g);
 advance(g,5);assert.deepEqual(state(g),paused);assert.equal(g.beginPull(65,90),false);
 g.resume();assert.equal(g.targetId,null);assert.equal(g.phase,'playing');advance(g,1);
 assert.equal(g.targetId,null);assert.ok(Math.hypot(g.robot.vx,g.robot.vy)<.1);
});

test('undo restores every body, velocity, move count, gate state and simulation time; state stays frozen until new input',()=>{
 const g=new HookGame();g.loadLevel(2);pull(g,'a2');const before=state(g);
 pull(g,'heavy');assert.equal(g.gateOpen,true);assert.notDeepEqual(state(g),before);
 assert.equal(g.undo(),true);assert.deepEqual(state(g),before);assert.equal(g.targetId,null);
 advance(g,3);assert.deepEqual(state(g),before);start(g,'heavy');advance(g,3);assert.equal(g.gateOpen,true);
});

test('occluded hook is rejected; 10 FPS route replay cannot pass through solids',()=>{
 const blocked=new HookGame();blocked.loadLevel(1);const before=state(blocked);
 assert.equal(blocked.beginPull(95,175),false);assert.deepEqual(state(blocked),before);
 for(const route of routes) {
  const g=new HookGame();g.loadLevel(route.level);
  for(const [id,secs=3] of route.steps) {
   start(g,id);
   for(let t=0;t<secs-1e-8;t+=.1) {g.update(Math.min(.1,secs-t));noPenetration(g);}
   g.endPull();for(let i=0;i<7;i++){g.update(.1);noPenetration(g);}
  }
  assert.equal(g.snapshot().canShip,true, route.name);
 }
});

test('gate remains open while a parcel occupies it after the weight leaves the plate, then closes once clear',()=>{
 const g=new HookGame();g.loadLevel(2);
 for(const [id,secs] of [['a2',3],['heavy',3],['a3',.35],['box',.6]])pull(g,id,secs);
 assert.ok(wallGap(body(g,'box'),g.level.gate)<0);pull(g,'heavy');
 assert.equal(g.plateActive,false);assert.equal(g.gateOpen,true);noPenetration(g);
 pull(g,'box');assert.equal(g.gateOpen,false);noPenetration(g);
});

test('gate does not close on the robot when the robot pulls the weight off the plate',()=>{
 const g=new HookGame();g.loadLevel(2);
 for(const [id,secs] of [['a2',3],['heavy',3],['a3',.35],['a0',.5]])pull(g,id,secs);
 start(g,'heavy');let guarded=0;
 for(let i=0;i<360;i++) {
  g.update(1/120);noPenetration(g);
  if(!g.plateActive && wallGap(g.robot,g.level.gate)<0){guarded++;assert.equal(g.gateOpen,true);}
 }
 assert.ok(guarded>0,'must actually observe unweighted gate with robot inside');
 assert.equal(g.gateOpen,false);
});

test('a delivered heavy parcel can be taken out, used on a plate, returned, and shipped',()=>{
 const route=routes[2],g=new HookGame();g.loadLevel(2);
 assert.deepEqual(g.delivered().map(b=>b.id),['heavy']);
 pull(g,'a2');pull(g,'heavy');assert.equal(g.delivered().length,0);assert.equal(g.gateOpen,true);
 for(const [id,seconds=3] of route.steps.slice(2))pull(g,id,seconds);
 assert.equal(g.delivered().length,2);assert.equal(g.ship(),true);
});

test('fixed-step simulation yields the same routes at 120, 60, 20 and 10 FPS',()=>{
 for(const route of routes) {
  const fast=replay(route);
  for(const dt of [1/60,1/20,1/10]) {
   const slow=replay(route,dt);assert.equal(slow.snapshot().canShip,true, `${route.name} at ${1/dt}`);
   for(let i=0;i<fast.bodies.length;i++) {
    assert.ok(Math.hypot(fast.bodies[i].x-slow.bodies[i].x,fast.bodies[i].y-slow.bodies[i].y)<.2, `${route.name} at ${1/dt}: ${fast.bodies[i].id}`);
   }
  }
 }
});
