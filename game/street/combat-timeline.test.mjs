import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { AIR_PHYSICS, ATTACKS, JUMP_SPEED, attackDuration } from './combat-data.ts';

const advance = (g, seconds, step = 1 / 120) => {
  for (let remaining = seconds; remaining > 1e-9;) {
    const dt = Math.min(remaining, step); g.update(dt); remaining -= dt;
  }
};
const arena = (role = 'chen') => {
  const g = new StreetGame(); g.startTraining(role, 'tank', 1); g.freezeEnemies = true;
  const e = g.enemies[0]; e.x = g.hero.x + 28; e.y = g.hero.y; e.hp = e.max = 1000;
  return g;
};
const swings = g => g.events.filter(event => event === 'swing').length;

test('every role has complete attack phases, movement intervals and valid combo windows', () => {
  for (const role of Object.values(ATTACKS)) for (const a of Object.values(role)) {
    assert.ok(a.windup > 0 && a.active > 0 && a.recover > 0);
    assert.ok(a.advance.start >= 0 && a.advance.end >= a.advance.start && a.advance.end <= attackDuration(a));
    assert.ok(a.height.high > a.height.low);
    if (a.comboWindow) {
      assert.ok(a.comboWindow.open >= a.windup + a.active);
      assert.ok(a.comboWindow.close > a.comboWindow.open && a.comboWindow.close < attackDuration(a));
    }
  }
});

test('role-specific windup does no damage; active hits once; recovery cannot hit', () => {
  for (const role of ['chen', 'tuo', 'man']) {
    const g = arena(role), e = g.enemies[0], a = ATTACKS[role].jab;
    g.requestAction('attack'); advance(g, a.windup - .002);
    assert.equal(g.attackPhase, 'windup'); assert.equal(e.hp, 1000);
    advance(g, .003); assert.equal(g.attackPhase, 'active'); assert.ok(e.hp < 1000);
    const hp = e.hp; g.hitstop = 0; advance(g, a.active + .01);
    assert.equal(g.attackPhase, 'recover'); assert.equal(e.hp, hp);
    e.id += 100; e.x = g.hero.x + 25; // A new target entering only during recovery.
    advance(g, a.recover); assert.equal(e.hp, hp); assert.equal(g.currentAttack, null);
  }
});

test('a target entering late in the active window is hit, but repeated overlap is not', () => {
  const g = arena(), e = g.enemies[0]; e.y += 40;
  g.requestAction('attack'); advance(g, .075); assert.equal(g.combo, 0);
  e.y = g.hero.y; advance(g, .008); assert.equal(g.combo, 1);
  g.hitstop = 0; e.vx = 0; advance(g, .2); assert.equal(g.combo, 1);
});

test('attack advance is restricted to its configured interval at 30, 60 and 120 Hz', () => {
  for (const step of [1 / 30, 1 / 60, 1 / 120]) {
    const g = arena(), a = ATTACKS.chen.jab; g.enemies[0].y += 40;
    const x = g.hero.x; g.requestAction('attack'); advance(g, .4, step);
    assert.ok(Math.abs(g.hero.x - x - (a.advance.end - a.advance.start) * a.advance.speed) < 1e-6);
  }
});

test('combo input waits until the move window closes, then consumes exactly one follow-up', () => {
  const g = arena(); g.requestAction('attack'); advance(g, .051); g.hitstop = 0;
  advance(g, .07); assert.equal(g.attackPhase, 'recover');
  g.requestAction('attack'); assert.equal(swings(g), 1);
  advance(g, .10); assert.equal(swings(g), 1);
  advance(g, .02); assert.equal(swings(g), 2); assert.equal(g.attackStep, 1);
  advance(g, .6); assert.equal(swings(g), 2);
});

test('misses do not get a recovery cancel, and sliding out removes a pending combo', () => {
  const miss = arena(); miss.enemies[0].y += 40; miss.requestAction('attack'); advance(miss, .12);
  miss.requestAction('attack'); advance(miss, .13); assert.equal(swings(miss), 1);
  advance(miss, .04); assert.equal(swings(miss), 2); assert.equal(miss.attackStep, 0);
  const g = arena(); g.requestAction('attack'); advance(g, .15); g.requestAction('attack'); g.stopHeldAttack();
  advance(g, .5); assert.equal(swings(g), 1);
});

test('jump priority prevents a combo cancel and preserves the paired air attack', () => {
  const g = arena(); g.requestAction('attack'); advance(g, .2);
  g.requestAction('attack'); g.requestAction('jump'); advance(g, .2);
  assert.equal(g.hero.motion, 'airborne'); assert.equal(g.hero.pose, 'kick');
  assert.equal(g.events.filter(e => e === 'jump').length, 1); assert.equal(swings(g), 2);
});

test('a jump/attack pair survives takeoff at 30, 60 and 120 Hz in both input orders', () => {
  for (const step of [1 / 30, 1 / 60, 1 / 120]) for (const inputs of [['jump', 'attack'], ['attack', 'jump']]) {
    const g = arena(); g.hero.timer = .1;
    inputs.forEach(action => g.requestAction(action)); advance(g, .23, step);
    assert.equal(g.hero.motion, 'airborne'); assert.equal(swings(g), 1); assert.equal(g.hero.pose, 'kick');
  }
});

test('the slower role retains combo input for its full per-move window', () => {
  const g = arena('tuo'); g.requestAction('attack'); advance(g, .061); g.hitstop = 0;
  advance(g, .061); g.requestAction('attack'); advance(g, .18);
  assert.equal(swings(g), 1); advance(g, .008);
  assert.equal(swings(g), 2); assert.equal(g.attackStep, 1);
});

test('jump has takeoff, analytic height and landing recovery without changing the ground lane', () => {
  for (const role of ['chen', 'tuo', 'man']) for (const step of [1 / 30, 1 / 60, 1 / 120]) {
    const g = arena(role), p = g.hero, y = p.y, v = JUMP_SPEED[role];
    g.requestAction('jump'); assert.equal(p.motion, 'takeoff'); assert.equal(p.height, 0);
    advance(g, AIR_PHYSICS.takeoff + .2, step);
    assert.equal(p.motion, 'airborne'); assert.equal(p.y, y);
    assert.ok(Math.abs(p.height - (v * .2 - .5 * AIR_PHYSICS.gravity * .2 ** 2)) < 1e-6);
    advance(g, 2 * v / AIR_PHYSICS.gravity - .2 + .005, step);
    assert.equal(p.motion, 'landing'); assert.equal(p.height, 0); assert.equal(p.heightVelocity, 0);
    advance(g, AIR_PHYSICS.landing, step); assert.equal(p.motion, 'grounded'); assert.equal(p.y, y);
  }
});

test('takeoff is vulnerable; a sufficiently high jump evades low attacks, not high attacks', () => {
  const low = arena(); low.godMode = false; low.requestAction('jump'); low.hurt(10, 1);
  assert.equal(low.hero.hp, low.hero.max - 10); assert.equal(low.hero.motion, 'grounded');
  const g = arena(); g.godMode = false; g.requestAction('jump'); advance(g, .22);
  const height = g.hero.height; assert.ok(height > 22); g.hurt(10, 1); assert.equal(g.hero.hp, g.hero.max);
  g.hurt(10, 1, 45); assert.equal(g.hero.hp, g.hero.max - 10);
  assert.equal(g.hero.height, height); assert.equal(g.hero.motion, 'launched'); assert.ok(g.hero.heightVelocity <= 0);
  advance(g, .04); assert.ok(g.hero.height < height); advance(g, 1); assert.equal(g.hero.motion, 'grounded');
});

test('air injury cancels a pending kick and landing cancels an unfinished air attack', () => {
  const g = arena(); g.godMode = false; g.requestAction('jump'); advance(g, .12); g.requestAction('attack');
  g.hurt(10, 1, 50); advance(g, .12); assert.equal(g.combo, 0); assert.equal(g.currentAttack, null);
  const land = arena(); land.requestAction('jump'); advance(land, .69); land.requestAction('attack');
  advance(land, .03); assert.equal(land.hero.motion, 'landing'); assert.equal(land.currentAttack, null); assert.equal(land.combo, 0);
});

test('height participates in hit detection independently of the ground lane', () => {
  const g = arena(); g.hero.motion = 'airborne'; g.hero.height = 100; g.hero.heightVelocity = 0;
  g.requestAction('attack'); advance(g, .14); assert.equal(g.combo, 0);
  const normal = arena(); normal.requestAction('jump'); advance(normal, .24); normal.requestAction('attack');
  advance(normal, .07); assert.equal(normal.combo, 1);
});

test('launched enemies finish flight, down and rise before reclaiming slots or taking damage', () => {
  const g = arena(), e = g.enemies[0]; g.update(.01); assert.ok(g.enemySlots.some(s => s.occupant === e.id));
  g.mx = 1; g.sprint = true; g.requestAction('attack'); advance(g, .07); g.clearInput(); g.hitstop = 0;
  assert.equal(e.motion, 'launched'); assert.equal(g.enemySlots.some(s => s.occupant === e.id), false);
  advance(g, .67); assert.equal(e.motion, 'downed'); assert.equal(e.height, 0);
  const hp = e.hp; assert.equal(g.hit(e, 50, 100), false); assert.equal(e.hp, hp);
  g.hero.x = e.x - 20; assert.equal(g.grabTarget, undefined);
  advance(g, .30); assert.equal(e.motion, 'rising'); assert.equal(g.enemySlots.some(s => s.occupant === e.id), false);
  advance(g, .19); assert.equal(e.motion, 'grounded'); assert.ok(g.enemySlots.some(s => s.occupant === e.id));
});

test('throw shares physical flight and cannot regrab an airborne target', () => {
  const g = arena(), e = g.enemies[0]; g.requestAction('throw'); assert.equal(e.pose, 'thrown');
  assert.equal(e.heightVelocity, AIR_PHYSICS.throwSpeed); g.hitstop = 0; advance(g, .4);
  assert.ok(e.height > 0); g.hero.x = e.x - 20; assert.equal(g.grabTarget, undefined);
  advance(g, .8); assert.equal(e.motion, 'grounded'); assert.equal(e.height, 0);
});

test('lethal launch retains its corpse until landing and never stands up', () => {
  const g = arena(), e = g.enemies[0]; e.hp = 1; g.mx = 1; g.sprint = true;
  g.requestAction('attack'); advance(g, .07); g.clearInput(); g.hitstop = 0;
  advance(g, .5); assert.equal(e.motion, 'launched'); assert.equal(e.dead, .65);
  advance(g, .2); assert.equal(e.motion, 'downed'); assert.ok(e.dead > 0);
  advance(g, 1); assert.equal(e.motion, 'downed'); assert.equal(e.dead, 0); assert.equal(g.kills, 1);
});

test('pause and hitstop freeze heights and attack clocks; restart clears both', () => {
  const g = arena(); g.requestAction('jump'); advance(g, .2); g.requestAction('attack');
  const height = g.hero.height, timer = g.hero.timer; g.paused = true; advance(g, 1);
  assert.equal(g.hero.height, height); assert.equal(g.hero.timer, timer);
  g.paused = false; g.hitstop = .1; advance(g, .05);
  assert.equal(g.hero.height, height); assert.equal(g.hero.timer, timer); assert.equal(g.attackPhase, 'windup');
  g.resetTraining(); assert.equal(g.hero.motion, 'grounded'); assert.equal(g.hero.height, 0); assert.equal(g.currentAttack, null);
});

test('landing buffers a fresh jump/attack pair and prevents movement until recovery ends', () => {
  const g = arena(); g.requestAction('jump'); advance(g, .72); assert.equal(g.hero.motion, 'landing');
  const x = g.hero.x; g.mx = 1; g.requestAction('attack'); g.requestAction('jump'); advance(g, .03);
  assert.equal(g.hero.x, x); advance(g, .1); assert.equal(g.hero.motion, 'airborne'); assert.equal(g.hero.pose, 'kick');
});

test('airborne characters do not collect ground supplies', () => {
  const g = arena(); g.hero.hp = 50; g.snacks = [{ x: g.hero.x, y: g.hero.y }]; g.requestAction('jump');
  advance(g, .5); assert.equal(g.snacks.length, 1); assert.equal(g.hero.hp, 50);
  advance(g, .3); assert.equal(g.snacks.length, 0); assert.equal(g.hero.hp, 80);
});
