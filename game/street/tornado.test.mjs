import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { ATTACKS, SUPER, TORNADO, attackDuration } from './combat-data.ts';

const STEPS = [1 / 30, 1 / 60, 1 / 120];
const advance = (g, seconds, step = 1 / 120) => {
  for (let remaining = seconds; remaining > 1e-9;) {
    const dt = Math.min(remaining, step); g.update(dt); remaining -= dt;
  }
};
const arena = (count = 1, kind = 'tank') => {
  const g = new StreetGame();
  g.startTraining('chen', kind, Math.max(1, count));
  g.freezeEnemies = true; g.crates = []; g.hero.x = 85; g.hero.y = 199;
  if (!count) g.enemies = [];
  g.enemies.forEach((e, i) => { e.x = 350 + i * 20; e.y = 199; e.hp = e.max = 1000; });
  return g;
};
const cast = (g, direction = 1) => { g.mx = direction; g.requestAction('special'); g.mx = 0; };

test('forward special spends 50 rage, has a real windup and launches a travelling strike in either direction', () => {
  for (const step of STEPS) for (const face of [-1, 1]) {
    const g = arena(), e = g.enemies[0]; g.hero.x = 220; e.x = g.hero.x + face * 80;
    cast(g, face);
    assert.equal(g.rage, 0); assert.equal(g.superActive, false); assert.equal(g.hero.pose, 'tornado');
    assert.equal(g.tornadoes.length, 0); assert.equal(e.hp, 1000);
    advance(g, TORNADO.windup - .002, step);
    assert.equal(g.tornadoes.length, 0); assert.equal(e.hp, 1000);
    advance(g, .01, step);
    assert.equal(g.tornadoes.length, 1); assert.equal(g.tornadoes[0].face, face);
    assert.equal(e.hp, 1000, 'distant targets are not hit at cast time');
    advance(g, .3, step);
    assert.equal(e.hp, 1000 - TORNADO.damage); assert.equal(e.motion, 'launched');
  }
});

test('directional skill wins at full rage while neutral and vertical input preserve existing skills', () => {
  for (const face of [-1, 1]) {
    const g = arena(0); g.rage = 100; cast(g, face);
    assert.equal(g.rage, 100 - TORNADO.cost); assert.equal(g.superActive, false);
    assert.equal(g.hero.pose, 'tornado');
  }
  for (const y of [-1, 0, 1]) for (const rage of [50, 100]) {
    const g = arena(0); g.rage = rage; g.mx = 0; g.my = y; g.requestAction('special');
    assert.equal(g.rage, 0); assert.equal(g.hero.pose, rage === 100 ? 'super' : 'special');
    assert.equal(g.superActive, rage === SUPER.cost); assert.equal(g.tornadoWindingUp, false);
  }
  const low = arena(0); low.rage = 49; cast(low);
  assert.equal(low.rage, 49); assert.equal(low.tornadoWindingUp, false);
  assert.ok(low.sparks.some(s => s.text === '怒气不足'));
});

test('buffered special retains its original command when the stick returns to neutral or reverses', () => {
  for (const step of STEPS) for (const direction of [-1, 1]) for (const after of [0, -direction]) {
    const g = arena(0); g.hero.x = 220; g.hero.timer = .08; g.rage = 100;
    g.mx = direction; g.requestAction('special'); g.mx = after;
    advance(g, .25, step);
    assert.equal(g.superActive, false); assert.equal(g.rage, 50);
    assert.equal(g.tornadoes.length, 1); assert.equal(g.tornadoes[0].face, direction);
  }
  const neutral = arena(0); neutral.hero.timer = .08; neutral.rage = 100;
  neutral.requestAction('special'); neutral.mx = 1; advance(neutral, .12);
  assert.equal(neutral.superActive, true, 'moving after a neutral press must not rewrite the queued skill');
  assert.equal(neutral.tornadoes.length, 0);
});

test('one tornado pierces a row of enemies only once each and leaves other lanes untouched', () => {
  for (const step of STEPS) {
    const g = arena(4); g.hero.x = 60;
    g.enemies.forEach((e, i) => { e.x = 140 + i * 60; e.y = 199; });
    g.enemies[3].y = 199 + TORNADO.lane + 1;
    cast(g); advance(g, 2.5, step);
    for (const e of g.enemies.slice(0, 3)) assert.equal(e.hp, 1000 - TORNADO.damage);
    assert.equal(g.enemies[3].hp, 1000); assert.equal(g.combo, 3);
    assert.equal(g.tornadoes.length, 0);
  }
});

test('tornadoes skip downed, rising, entering and high-airborne targets', () => {
  for (const state of ['downed', 'rising', 'entry', 'high']) {
    const g = arena(), e = g.enemies[0]; e.x = g.hero.x + 45;
    if (state === 'entry') e.entryTime = 5;
    else if (state === 'high') {
      g.hit(e, 1, 0, { amount: 600, launchSpeed: 180 });
      e.height = 200; e.heightVelocity = 0; e.vx = 0; e.hp = 1000; g.hitstop = 0;
    } else { e.motion = state; e.motionTime = 5; }
    g.rage = 50; cast(g); advance(g, .4);
    assert.equal(e.hp, 1000, `${state} target is protected`);
  }
});

test('a tornado can juggle a low airborne enemy once without enabling unlimited air hits', () => {
  const g = arena(), e = g.enemies[0]; e.x = g.hero.x + 45;
  g.hit(e, 1, 0, { amount: 600, launchSpeed: 180 });
  e.height = 40; e.heightVelocity = 100; e.vx = 0; e.hp = 1000; g.hitstop = 0; g.rage = 50;
  cast(g); advance(g, .2);
  assert.equal(e.hp, 1000 - TORNADO.damage); assert.equal(e.motion, 'launched');
  assert.equal(g.hit(e, 20, 180, { amount: 600, juggle: true, launchSpeed: 180 }), false);
  assert.equal(e.hp, 1000 - TORNADO.damage);
});

test('armored bosses take tornado damage without having their committed move interrupted', () => {
  for (const kind of ['boss', 'longleg', 'luchuan', 'hanxiao']) {
    const g = arena(1, kind), e = g.enemies[0]; e.x = g.hero.x + 45;
    e.wind = 1; e.pose = 'wind'; e.poseTime = 1;
    cast(g); advance(g, .3);
    assert.equal(e.hp, 1000 - TORNADO.damage); assert.equal(e.motion, 'grounded');
    assert.equal(e.wind, 1); assert.equal(e.stun, 0); assert.equal(g.isBossVulnerable(e), false);
  }
});

test('flight distance is finite and frame-rate independent in both directions', () => {
  for (const step of STEPS) for (const face of [-1, 1]) {
    const g = arena(0); g.hero.x = face > 0 ? 60 : 390; const origin = g.hero.x + face * 20;
    cast(g, face); advance(g, TORNADO.windup + .05, step);
    const wave = g.tornadoes[0]; assert.ok(wave);
    assert.ok(Math.abs(wave.travelled - TORNADO.speed * .05) < 1e-6);
    advance(g, 2, step);
    assert.equal(g.tornadoes.length, 0);
    assert.ok(Math.abs(wave.travelled - TORNADO.distance) < 1e-6);
    assert.ok(Math.abs(wave.x - (origin + face * TORNADO.distance)) < 1e-6);
  }
});

test('walls stop tornado travel rather than letting it pass into the next street', () => {
  for (const step of STEPS) for (const face of [-1, 1]) {
    const g = arena(0); g.hero.x = face > 0 ? 380 : 75;
    const edge = face > 0 ? g.bounds.right - 10 : g.bounds.left + 10;
    cast(g, face); advance(g, TORNADO.windup + .01, step);
    const wave = g.tornadoes[0]; assert.ok(wave);
    advance(g, 1, step);
    assert.equal(g.tornadoes.length, 0); assert.equal(wave.x, edge);
    assert.ok(wave.travelled < TORNADO.distance);
  }
});

test('pause and hitstop freeze both windup and released tornado travel', () => {
  const g = arena(0); cast(g); advance(g, .05);
  const windupTimer = g.hero.timer; g.paused = true; advance(g, .5);
  assert.equal(g.hero.timer, windupTimer); assert.equal(g.tornadoes.length, 0);
  g.paused = false; g.hitstop = .2; advance(g, .1);
  assert.equal(g.hero.timer, windupTimer); assert.equal(g.tornadoes.length, 0);
  g.hitstop = 0; advance(g, .1);
  const wave = g.tornadoes[0], x = wave.x, age = wave.age;
  g.paused = true; advance(g, .5); assert.equal(wave.x, x); assert.equal(wave.age, age);
  g.paused = false; g.hitstop = .2; advance(g, .1);
  assert.equal(wave.x, x); assert.equal(wave.age, age);
  g.hitstop = 0; advance(g, .02); assert.ok(wave.x > x);
});

test('restart, chapter change, practice reset and opponent changes clear windup and active waves', () => {
  const resets = [
    g => g.start('chen'),
    g => g.start('chen', 1),
    g => g.resetTraining(),
    g => g.setTrainingOpponents('runner', 2),
    g => g.startTraining('chen', 'boss', 1),
    g => { g.training = false; g.phase = 'won'; g.nextChapter(); },
  ];
  for (const reset of resets) for (const elapsed of [.05, .2]) {
    const g = arena(0); cast(g); advance(g, elapsed);
    assert.ok(g.tornadoWindingUp || g.tornadoes.length > 0);
    reset(g);
    assert.equal(g.tornadoWindingUp, false); assert.equal(g.tornadoes.length, 0);
    advance(g, .3); assert.equal(g.tornadoes.length, 0, 'old windup must not leak into the next encounter');
  }
});

test('damage cancels an unreleased cast but does not erase a wave already in flight', () => {
  const early = arena(0); early.godMode = false; cast(early); advance(early, .05);
  early.hero.inv = 0; early.hurt(10, -1); advance(early, .5);
  assert.equal(early.hero.hp, early.hero.max - 10); assert.equal(early.tornadoes.length, 0);
  assert.equal(early.events.includes('tornado'), false);
  const late = arena(0); late.godMode = false; cast(late); advance(late, .2);
  const wave = late.tornadoes[0], x = wave.x; assert.ok(wave);
  late.hero.inv = 0; late.hurt(10, -1); advance(late, .05);
  assert.equal(late.hero.hp, late.hero.max - 10); assert.ok(late.tornadoes.includes(wave)); assert.ok(wave.x > x);
});

test('dodge buffered in windup cancels at recovery rather than waiting for the whole move', () => {
  for (const step of STEPS) {
    const g = arena(0), attack = ATTACKS.chen.jab;
    g.requestAction('attack'); advance(g, .02, step); g.requestAction('dodge');
    assert.equal(g.hero.pose, 'punch');
    let waited = 0;
    for (; waited < .4 && g.hero.pose !== 'dodge'; waited += step) g.update(step);
    assert.equal(g.hero.pose, 'dodge'); assert.equal(g.currentAttack, null);
    assert.ok(waited + .02 < attackDuration(attack) - .08, `cancel should happen well before full recovery at ${1 / step} Hz`);
    assert.equal(g.events.filter(e => e === 'dodge').length, 1);
  }
});

test('dodge buffered during hitstop survives the freeze and fires when recovery opens', () => {
  for (const step of STEPS) {
    const g = arena(), e = g.enemies[0]; e.x = g.hero.x + 28;
    g.requestAction('attack');
    for (let frame = 0; frame < 30 && g.hitstop <= 0; frame++) g.update(step);
    assert.ok(g.hitstop > 0); g.requestAction('dodge');
    let waited = 0;
    for (; waited < .4 && g.hero.pose !== 'dodge'; waited += step) g.update(step);
    assert.equal(g.hero.pose, 'dodge'); assert.equal(g.currentAttack, null);
    assert.ok(waited < .18, `buffered dodge should not wait for all remaining attack recovery at ${1 / step} Hz`);
    assert.equal(g.events.filter(event => event === 'dodge').length, 1);
  }
});

test('after a buffered recovery dodge the player can lunge and continue the normal combo', () => {
  const g = arena(), e = g.enemies[0]; e.x = g.hero.x + 28;
  g.requestAction('attack'); advance(g, .02); g.requestAction('dodge');
  for (let frame = 0; frame < 90 && g.hero.pose !== 'dodge'; frame++) g.update(1 / 120);
  assert.equal(g.hero.pose, 'dodge'); advance(g, .35);
  e.x = g.hero.x + 40; e.y = g.hero.y;
  g.requestAction('attack'); assert.equal(g.hero.pose, 'dash');
  advance(g, .45); e.x = g.hero.x + 28; e.y = g.hero.y;
  const hp = e.hp; g.requestAction('attack');
  assert.equal(g.attackStep, 1, 'a successful dodge follow-up opens the second punch');
  advance(g, .1); assert.ok(e.hp < hp);
});
