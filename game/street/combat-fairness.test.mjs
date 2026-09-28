import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { MOB_AI } from './encounter-data.ts';

const arena = (kind = 'punk', count = 1) => {
  const g = new StreetGame();
  g.startTraining('chen', kind, count);
  g.godMode = false;
  g.hero.x = 220;
  g.hero.y = 199;
  return g;
};
const advance = (g, seconds) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 120) g.update(1 / 120);
};

test('a committed mob punch cannot hit someone who crossed behind it', () => {
  for (const kind of ['punk', 'runner', 'tank', 'blocker']) for (const face of [-1, 1]) {
    const g = arena(kind), e = g.enemies[0];
    e.x = 220; e.y = 199; e.face = face; e.wind = .06; e.timer = 1;
    g.hero.x = e.x + face * 30;
    g.update(1 / 120);
    // The player crossed the committed attack's origin before impact.
    g.hero.x = e.x - face * 24;
    for (let frame = 0; frame < 12 && e.wind > 0; frame++) g.update(1 / 120);
    assert.ok(e.wind <= 0, 'the attack reached its impact frame');
    assert.equal(e.face, face, `${kind} keeps its telegraphed direction`);
    assert.equal(g.hero.hp, g.hero.max, `${kind} must not punch backwards`);
  }
});

test('a committed mob punch still hits a player who stays in front', () => {
  for (const kind of ['punk', 'runner', 'tank', 'blocker']) for (const face of [-1, 1]) {
    const g = arena(kind), e = g.enemies[0];
    e.x = 220; e.y = 199; e.face = face; e.wind = .02; e.timer = 1;
    g.hero.x = e.x + face * 30;
    advance(g, .04);
    assert.equal(g.hero.hp, g.hero.max - MOB_AI[kind].damage);
  }
});

test('simultaneous wake-up counters share the two-attacker budget and show a warning', () => {
  const g = arena('punk', 4);
  for (const [index, e] of g.enemies.entries()) {
    e.x = g.hero.x + (index % 2 ? 30 : -30); e.y = g.hero.y;
    e.motion = 'rising'; e.motionTime = .001; e.timer = 0;
  }
  g.update(1 / 120);
  assert.equal(g.enemies.filter(e => e.wind > 0).length, 2);
  assert.equal(g.sparks.filter(s => s.text === '起身反击').length, 2);
  for (const e of g.enemies.filter(e => e.wind <= 0)) {
    assert.equal(e.motion, 'grounded');
    assert.ok(e.timer > .3, 'extra waking enemies wait instead of immediately starting another attack');
  }
});

test('wake-up attacks respect existing telegraphs and charge attacks', () => {
  const g = arena('punk', 3), [windup, charge, waking] = g.enemies;
  windup.x = 400; windup.y = 199; windup.wind = .5; windup.timer = 1;
  charge.kind = 'grabber'; charge.x = 40; charge.y = 199; charge.charge = .25; charge.face = -1;
  waking.x = g.hero.x + 30; waking.y = g.hero.y; waking.motion = 'rising'; waking.motionTime = .001; waking.timer = 0;
  g.update(1 / 120);
  assert.equal(waking.wind, 0);
  assert.ok(waking.timer > .3);
  assert.equal(g.sparks.some(s => s.text === '起身反击'), false);
});

test('a lone waking mob visibly counters if the player keeps standing in front', () => {
  const g = arena(), e = g.enemies[0];
  e.x = g.hero.x + 30; e.y = g.hero.y; e.motion = 'rising'; e.motionTime = .001; e.timer = 0;
  g.update(1 / 120);
  assert.ok(e.wind > 0);
  assert.ok(g.sparks.some(s => s.text === '起身反击'));
  assert.equal(g.hero.hp, g.hero.max, 'the warning precedes damage');
  advance(g, MOB_AI.punk.riseWind + .04);
  assert.equal(g.hero.hp, g.hero.max - MOB_AI.punk.damage);
});
