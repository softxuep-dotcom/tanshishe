import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { ATTACKS, KNOCKBACK } from './combat-data.ts';

const arena = (count = 1) => {
  const g = new StreetGame(); g.startTraining('chen', 'tank', count); g.freezeEnemies = true;
  g.hero.x = 70; g.enemies.forEach((e, i) => { e.x = 100 + i * 75; e.y = g.hero.y; e.hp = e.max = 1000; });
  return g;
};
const advance = (g, seconds, step = 1 / 120, ignoreHitstop = false) => {
  for (let remaining = seconds; remaining > 1e-9;) {
    if (ignoreHitstop) g.hitstop = 0;
    const dt = Math.min(remaining, step); g.update(dt); remaining -= dt;
  }
};
const launch = (g, e = g.enemies[0], vx = 350, speed = 200, collateral = true) => {
  g.hit(e, 1, vx, { amount: KNOCKBACK.threshold, launchSpeed: speed, collateral }); g.hitstop = 0;
};

// Walk into the nearest grabbable enemy for one frame, then throw toward `dir` (0 = forward).
const grabThrow = (g, dir = 0) => { const t = g.grabTarget; g.mx = Math.sign(t.x - g.hero.x); g.update(1 / 120); g.mx = dir; g.requestAction('attack'); };
test('light impact accumulates on each enemy and the threshold launches and clears the meter', () => {
  const g = arena(2), [a, b] = g.enemies;
  for (let i = 1; i < 10; i++) {
    g.hit(a, 1, 38); assert.equal(a.knockbackAmount, i * 60); assert.equal(a.motion, 'grounded');
  }
  assert.equal(b.knockbackAmount, 0); g.hit(a, 1, 38);
  assert.equal(a.motion, 'launched'); assert.equal(a.knockbackAmount, 0);
  assert.equal(a.vx, KNOCKBACK.minimumSpeed); assert.equal(a.heightVelocity, KNOCKBACK.lift);
  assert.equal(g.hitstop, .075); assert.ok(g.events.includes('heavy'));
  assert.equal(g.enemySlots.some(s => s.occupant === a.id), false);
});

test('impact recovery has a grace period, decays, and another hit refreshes the delay', () => {
  const g = arena(), e = g.enemies[0]; g.hit(e, 1, 0); g.hitstop = 0;
  advance(g, 1.9); assert.equal(e.knockbackAmount, 60);
  g.hit(e, 1, 0); g.hitstop = 0; advance(g, 2); assert.ok(Math.abs(e.knockbackAmount - 120) < 1e-6);
  advance(g, .5); assert.ok(Math.abs(e.knockbackAmount - 30) < 1e-6);
  advance(g, .3); assert.equal(e.knockbackAmount, 0);
});

test('ordinary attacks and air kicks use their own impact values; misses add nothing', () => {
  const g = arena(), e = g.enemies[0]; g.requestAction('attack'); advance(g, .08);
  assert.equal(e.knockbackAmount, ATTACKS.chen.jab.impact); assert.equal(e.motion, 'grounded');
  const miss = arena(); miss.enemies[0].y += 40; miss.requestAction('attack'); advance(miss, .3);
  assert.equal(miss.enemies[0].knockbackAmount, 0);
  const air = arena(); air.requestAction('jump'); advance(air, .2); air.requestAction('attack'); advance(air, .08);
  assert.equal(air.enemies[0].knockbackAmount, ATTACKS.chen.air.impact);
});

test('the earned uppercut launches and can knock a second enemy down along its path', () => {
  const g = arena(2), [a, b] = g.enemies; b.y += 40;
  for (let i = 0; i < 2; i++) { a.x = g.hero.x + 28; a.vx = 0; g.requestAction('attack'); advance(g, .36); }
  a.x = g.hero.x + 28; a.vx = 0; b.x = a.x + 70; b.y = a.y;
  g.requestAction('attack'); assert.equal(g.attackStep, 2); advance(g, .09);
  assert.equal(a.motion, 'launched'); assert.equal(a.knockbackAmount, 0); assert.equal(b.hp, 1000);
  advance(g, .6); assert.equal(b.hp, 975); assert.notEqual(b.motion, 'grounded');
});

test('fresh dash launches both bosses immediately and shares delayed collateral hits', () => {
  for (const kind of ['boss', 'longleg']) {
    const g = arena(2), [a, b] = g.enemies; a.kind = kind; b.x = a.x + 90;
    g.mx = 1; g.sprint = true; g.requestAction('attack'); advance(g, .07); g.clearInput();
    assert.equal(a.motion, 'launched'); assert.equal(a.hp, 993); assert.equal(b.hp, 1000);
    advance(g, .5); assert.equal(b.hp, 975);
  }
});

test('throw no longer deals instant row damage and can strike multiple targets on its actual path', () => {
  const g = arena(4), [a, b, c, d] = g.enemies;
  b.x = a.x + 65; c.x = a.x + 110; d.x = a.x + 230;
  grabThrow(g); assert.equal(a.pose, 'thrown'); assert.equal(a.hp, 971);
  assert.deepEqual([b.hp, c.hp, d.hp], [1000, 1000, 1000]); advance(g, .7);
  assert.deepEqual([b.hp, c.hp, d.hp], [975, 975, 1000]);
});

test('leftward throws collide on the left, not with enemies behind the launch', () => {
  const g = arena(3), [a, b, c] = g.enemies;
  g.hero.x = 260; a.x = 238; b.x = 160; c.x = 300;
  grabThrow(g, -1); g.clearInput(); assert.ok(a.vx < 0); advance(g, .65);
  assert.equal(b.hp, 975); assert.equal(c.hp, 1000);
});

test('victory waits for all lethal flights to land and finish fading', () => {
  const g = arena(2); g.training = false; g.wave = 3;
  g.hero.x = 1100; g.enemies[0].x = 1150; g.enemies[1].x = 1220;
  g.enemies[0].hp = 1; g.enemies[1].hp = 20; launch(g);
  advance(g, .4, 1 / 120, true); assert.equal(g.kills, 2); assert.equal(g.phase, 'playing');
  advance(g, .4, 1 / 120, true); assert.equal(g.phase, 'playing');
  advance(g, 1, 1 / 120, true); assert.equal(g.phase, 'won');
});

test('swept collision catches a fast body at 30, 60 and 120 Hz without double hits', () => {
  for (const step of [1 / 30, 1 / 60, 1 / 120]) {
    const g = arena(2), [a, b] = g.enemies; b.x = 170; launch(g, a, 6000);
    advance(g, .04, step, true); assert.equal(b.hp, 975);
    advance(g, .8, step, true); assert.equal(b.hp, 975);
  }
});

test('collateral respects ground lanes, height, direction and stationary/downed targets', () => {
  const lane = arena(2); lane.enemies[1].y += 30; launch(lane); advance(lane, .8); assert.equal(lane.enemies[1].hp, 1000);
  const high = arena(2); high.enemies[0].height = 100; launch(high); advance(high, .45); assert.equal(high.enemies[1].hp, 1000);
  const behind = arena(2); behind.enemies[1].x = 55; launch(behind); advance(behind, .8); assert.equal(behind.enemies[1].hp, 1000);
  const down = arena(2); down.enemies[1].motion = 'downed'; down.enemies[1].motionTime = 1;
  launch(down); advance(down, .8); assert.equal(down.enemies[1].hp, 1000);
  const slow = arena(2); slow.enemies[1].x = 125; launch(slow); slow.enemies[0].vx = 0;
  advance(slow, .8); assert.equal(slow.enemies[1].hp, 1000);
});

test('a secondary knocked-down body cannot propagate an unbounded domino chain', () => {
  const g = arena(3), [a, b, c] = g.enemies;
  // A can hit B, B crosses C's lane, but A and C are in different lanes.
  a.y = 180; b.y = 201; c.y = 222; b.x = 145; c.x = 170;
  launch(g); advance(g, 1.4, 1 / 120, true);
  assert.equal(b.hp, 975); assert.equal(c.hp, 1000);
});

test('wall impact reverses half the speed once, retains height and adds no damage or airtime', () => {
  for (const face of [-1, 1]) {
    const g = arena(), e = g.enemies[0]; e.x = face > 0 ? 435 : 20; launch(g, e, face * 350);
    const hp = e.hp; advance(g, .02);
    assert.equal(Math.sign(e.vx), -face);
    assert.ok(Math.abs(Math.abs(e.vx) - 175 * Math.exp(-KNOCKBACK.flightDrag * .02)) < 1e-6);
    assert.ok(e.height > 0); assert.equal(e.hp, hp); assert.ok(e.x >= 15 && e.x <= 440);
    assert.equal(g.sparks.filter(s => s.text === '撞墙').length, 1);
    advance(g, .66); assert.equal(e.motion, 'downed'); assert.equal(e.height, 0);
  }
});

test('wall bounce does not hit a recovered target twice within the same flight', () => {
  const g = arena(2), [a, b] = g.enemies; a.x = 365; b.x = 405;
  launch(g); advance(g, .18, 1 / 120, true); assert.equal(b.hp, 975);
  // Make the victim vulnerable again to test the flight ledger, not its invulnerability.
  b.motion = 'grounded'; b.height = 0; b.vx = 0; b.x = 415;
  advance(g, .4, 1 / 120, true); assert.equal(b.hp, 975);
});

test('even extreme launch speed cannot bounce forever or leave arena bounds', () => {
  const g = arena(), e = g.enemies[0]; launch(g, e, 100000);
  advance(g, .035); assert.ok(e.x >= 15 && e.x <= 440); assert.equal(e.vx, 0);
  assert.equal(g.events.filter(e => e === 'heavy').length, 1);
  advance(g, 1.3); assert.equal(e.motion, 'grounded');
});

test('flight distance and bounce agree across 30, 60 and 120 Hz', () => {
  for (const startX of [100, 430]) {
    const results = [1 / 30, 1 / 60, 1 / 120].map(step => {
      const g = arena(), e = g.enemies[0]; e.x = startX; launch(g); advance(g, .4, step); return [e.x, e.vx, e.height];
    });
    for (const result of results) result.forEach((n, i) => assert.ok(Math.abs(n - results[0][i]) < 1e-6));
  }
});

test('enemy ordering does not advance secondary flights early', () => {
  const normal = arena(2), reversed = arena(2); reversed.enemies.reverse();
  launch(normal, normal.enemies[0]); launch(reversed, reversed.enemies[1]);
  advance(normal, .3, 1 / 30, true); advance(reversed, .3, 1 / 30, true);
  const state = g => [...g.enemies].sort((a, b) => a.id - b.id).map(e => [e.hp, e.x, e.height, e.motion]);
  assert.deepEqual(state(normal), state(reversed));
});

test('a lethal flying body can collide, counts each death once and lands before fading', () => {
  const g = arena(2), [a, b] = g.enemies; a.hp = 1; b.hp = 20; launch(g);
  advance(g, .4, 1 / 120, true); assert.equal(g.kills, 2); assert.equal(b.hp, 0); assert.equal(a.dead, .65);
  advance(g, 2, 1 / 120, true); assert.equal(g.kills, 2); assert.equal(a.dead, 0); assert.equal(b.dead, 0);
});

test('pause and hitstop freeze impact recovery and flight collisions; resets discard old flights', () => {
  const g = arena(2), [a, b] = g.enemies; g.hit(b, 1, 0); launch(g, a);
  const amount = b.knockbackAmount, x = a.x; g.paused = true; advance(g, 1);
  assert.equal(a.x, x); assert.equal(b.knockbackAmount, amount); g.paused = false;
  g.hitstop = .2; advance(g, .1); assert.equal(a.x, x); assert.equal(b.hp, 999);
  g.setTrainingOpponents('tank', 2); advance(g, 1); assert.ok(g.enemies.every(e => e.hp === e.max && e.knockbackAmount === 0));
  g.resetTraining(); assert.ok(g.enemies.every(e => e.motion === 'grounded'));
});

test('no collateral contact advances the grounded three-hit combo', () => {
  const g = arena(2); launch(g); advance(g, 1.4, 1 / 120, true);
  const e = g.enemies[1]; e.x = g.hero.x + 28; e.y = g.hero.y; e.vx = 0;
  g.requestAction('attack'); assert.equal(g.attackStep, 0);
});
