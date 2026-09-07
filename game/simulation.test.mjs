import test from 'node:test';
import assert from 'node:assert/strict';
import { CargoRun, SHELVES, circleRect } from './simulation.ts';
const straight = {left:false,right:false,brake:false};
function advance(run, seconds, input=straight, fps=60) { for(let i=0;i<seconds*fps;i++) run.update(1/fps,input); }
test('first lane collects cargo without losing any; reset restores all cargo',()=>{
  const run=new CargoRun(); run.start(); advance(run,4.6);
  assert.equal(run.cargo.length,5); assert.equal(run.cargo.length+run.loose.length,18);
  assert.ok(run.head.y>=58); run.start(); assert.equal(run.cargo.length,0);assert.equal(run.loose.length,18);assert.equal(run.remaining,120);
});
test('pause freezes time and movement; time expiry ends a run',()=>{
  const run=new CargoRun();run.start();advance(run,1);run.pause();const state=JSON.stringify(run.snapshot());const y=run.head.y;
  advance(run,10);assert.equal(JSON.stringify(run.snapshot()),state);assert.equal(run.head.y,y);
  run.pause();run.remaining=.1;advance(run,.2);assert.equal(run.phase,'lost');
});
test('30 Hz and 120 Hz produce equivalent movement',()=>{
  const a=new CargoRun(),b=new CargoRun();a.start();b.start();
  advance(a,2,straight,30);advance(b,2,straight,120);
  assert.ok(Math.abs(a.head.y-b.head.y)<.01);assert.equal(a.cargo.length,b.cargo.length);
});
test('collision drops the tail and leaves recoverable cargo outside shelves',()=>{
  const run=new CargoRun();run.start();run.head={x:123,y:220,angle:0};
  const cart=run.loose.shift();Object.assign(cart,{x:147,y:220,angle:0});run.cargo.push(cart);
  advance(run,.5);assert.equal(run.cargo.length,0);assert.equal(run.loose.length,18);
  assert.ok(SHELVES.every(r=>!circleRect(cart.x,cart.y,12,r)));
  run.head={x:cart.x,y:cart.y,angle:Math.PI};cart.cooldown=0;run.update(1/120,straight);
  assert.equal(run.cargo.length,1);
});
test('gate blocks underloaded trucks and waits for tail delivery',()=>{
  const run=new CargoRun();run.start();run.head={x:220,y:65,angle:-Math.PI/2};run.loose=[];
  advance(run,.5);assert.equal(run.phase,'playing');assert.ok(run.head.y>=58);
  run.cargo=Array.from({length:6},(_,id)=>({id,x:220,y:run.head.y+(id+1)*26,angle:-Math.PI/2,gold:false,cooldown:0,stress:0}));
  advance(run,.3);assert.equal(run.phase,'exiting');assert.equal(run.delivered,0);
  advance(run,3);assert.equal(run.phase,'won');assert.equal(run.delivered,6);assert.equal(run.snapshot().score,84);
});
test('a real steering route collects enough cargo and reaches the exit',()=>{
  const run=new CargoRun();run.start();
  const waypoints=[[78,144],[115,101],[178,98],[220,73],[220,-10]];
  let goal=0;
  for(let frame=0;frame<60*75 && run.phase!=='won' && run.phase!=='lost';frame++) {
    const [x,y]=waypoints[goal];const dx=x-run.head.x,dy=y-run.head.y;
    if(Math.hypot(dx,dy)<19 && goal<waypoints.length-1)goal++;
    const diff=Math.atan2(Math.sin(Math.atan2(dy,dx)-run.head.angle),Math.cos(Math.atan2(dy,dx)-run.head.angle));
    run.update(1/60,{left:diff<-.07,right:diff>.07,brake:true});
  }
  assert.equal(run.phase,'won',JSON.stringify({head:run.head,count:run.cargo.length,goal,phase:run.phase}));
  assert.ok(run.cargo.length>=6);
});
