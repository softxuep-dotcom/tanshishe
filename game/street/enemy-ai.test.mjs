import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { MOB_AI } from './encounter-data.ts';

const advance = (g, seconds, step = 1 / 60) => { for (let t = 0; t < seconds; t += step) g.update(step); };
const crowd = (kind, count) => { const g = new StreetGame(); g.startTraining('chen', kind, count); return g; };

test('a mob that gets up with the player standing over it swings back almost at once', () => {
  const g = crowd('punk', 1), e = g.enemies[0];
  e.x = g.hero.x + 30; e.y = g.hero.y; e.motion = 'rising'; e.motionTime = .01; e.timer = 0;
  g.update(1 / 60);
  assert.ok(e.wind > 0 && e.wind <= MOB_AI.punk.riseWind, 'short wake-up windup instead of the normal .62s');
  const far = crowd('punk', 1), f = far.enemies[0];
  f.x = far.hero.x + 120; f.y = far.hero.y; f.motion = 'rising'; f.motionTime = .01; f.timer = 0;
  far.update(1 / 60);
  assert.equal(f.wind, 0, 'nobody to punish, no wake-up swing');
});

test('mobs roll varied plans, and the same fight replays identically', () => {
  const log = () => {
    const g = crowd('punk', 4), seen = [];
    for (let t = 0; t < 12; t += 1 / 60) { g.update(1 / 60); seen.push(g.enemies.map(e => g.planOf(e)).join()); }
    return seen;
  };
  const a = log(), b = log();
  assert.deepEqual(a, b, 'seeded, so tests and replays stay deterministic');
  const plans = new Set(a.join().split(',').filter(Boolean));
  assert.deepEqual([...plans].sort(), ['flank', 'hold', 'press']);
});

test('flankers prefer the attack slot behind the player', () => {
  const g = crowd('runner', 4); let back = 0, front = 0;
  for (let t = 0; t < 15; t += 1 / 60) {
    g.update(1 / 60);
    for (const slot of g.enemySlots) {
      const e = g.enemies.find(o => o.id === slot.occupant);
      if (!slot.attack || !e || g.planOf(e) !== 'flank') continue;
      if ((slot.x - g.hero.x) * g.hero.face < 0) back++; else front++;
    }
  }
  assert.ok(back > front, `flankers took the back slot ${back} frames vs front ${front}`);
});

test('a chase that never gets a swing gives up and holds back', () => {
  const g = crowd('punk', 1), e = g.enemies[0];
  g.hero.x = 40; e.x = 430; e.y = g.hero.y;
  const plans = [];
  for (let t = 0; t < 9; t += 1 / 60) { g.update(1 / 60); plans.push(g.planOf(e)); assert.equal(e.wind > 0 && Math.abs(e.x - g.hero.x) > 60, false); }
  const chase = plans.findIndex(p => p === 'press' || p === 'flank');
  assert.ok(chase >= 0 && plans.indexOf('hold', chase) > chase, 'press/flank is replaced by hold before it ever reaches the player');
});

test('slingers aim at the lane the player is walking into and back away from them', () => {
  const g = crowd('slinger', 1), e = g.enemies[0];
  g.hero.x = 150; g.hero.y = 180; e.x = 320; e.y = 180;
  g.my = 1; advance(g, .2);
  assert.ok(g.aimLane(e) > g.hero.y + 20, 'leads a player walking down the screen');
  g.my = 0; advance(g, .1);
  assert.ok(Math.abs(g.aimLane(e) - g.hero.y) < 1, 'no lead once the player stops');
  const k = crowd('slinger', 1), s = k.enemies[0];
  k.hero.x = 250; s.x = 300; s.y = k.hero.y; advance(k, 1);
  assert.ok(s.x > 310, 'retreats toward its own edge instead of standing in the melee');
});

test('a blocker stops frontal punches but not hits from behind, slides, or grabs', () => {
  const g = crowd('blocker', 1), e = g.enemies[0]; g.freezeEnemies = true;
  e.x = g.hero.x + 30; e.y = g.hero.y; e.face = -1;
  g.requestAction('attack'); advance(g, .2);
  assert.equal(e.hp, e.max, 'frontal jab blocked'); assert.ok(g.sparks.some(s => s.text === '格挡'));
  const b = crowd('blocker', 1), f = b.enemies[0]; b.freezeEnemies = true;
  f.x = b.hero.x + 30; f.y = b.hero.y; f.face = 1;
  b.requestAction('attack'); advance(b, .2); assert.ok(f.hp < f.max, 'a hit from behind lands');
  const s = crowd('blocker', 1), h = s.enemies[0]; s.freezeEnemies = true;
  h.x = s.hero.x + 60; h.y = s.hero.y; h.face = -1; s.mx = 1; s.sprint = true; s.requestAction('jump'); advance(s, .3);
  assert.ok(h.hp < h.max, 'the slide goes under the guard'); assert.equal(h.motion, 'launched');
  const t = crowd('blocker', 1), k = t.enemies[0]; t.freezeEnemies = true;
  k.x = t.hero.x + 24; k.y = t.hero.y; k.face = -1; t.mx = 1; t.update(1 / 60);
  assert.equal(t.grabbed, k, 'walking in still grabs a blocker');
});

test('a blocker turns slowly, so crossing over opens its back for a moment', () => {
  const g = crowd('blocker', 1), e = g.enemies[0];
  e.x = g.hero.x + 60; e.y = g.hero.y; e.face = -1; e.timer = 5;
  g.hero.x = e.x + 25; g.update(1 / 60);
  assert.equal(e.face, -1, 'has not turned yet');
  advance(g, .5); assert.equal(e.face, 1, 'turns after the delay');
});

const grabbed = () => {
  const g = crowd('grabber', 1), e = g.enemies[0]; g.godMode = false;
  e.x = g.hero.x + 70; e.y = g.hero.y; e.timer = 0;
  for (let t = 0; t < 2 && !g.heldBy; t += 1 / 60) g.update(1 / 60);
  assert.equal(g.heldBy, e, 'the lunge grabs a grounded player'); return { g, e };
};

test('a grabber holds and squeezes; mashing breaks free and leaves it open', () => {
  const { g, e } = grabbed();
  const hp = g.hero.hp; advance(g, .45); assert.ok(g.hero.hp < hp, 'squeezes');
  g.mx = 1; const x = g.hero.x; advance(g, .1); assert.ok(Math.abs(g.hero.x - x) < 1, 'cannot walk away'); g.mx = 0;
  for (let i = 0; i < 10 && g.heldBy; i++) { g.requestAction('attack'); g.update(1 / 60); }
  assert.equal(g.heldBy, null); assert.ok(e.stun > 0, 'breaking free leaves it open');
});

test('without struggling you get slammed; a dodge makes the lunge whiff', () => {
  const { g } = grabbed();
  advance(g, 1.6); assert.equal(g.heldBy, null); assert.ok(g.hero.inv > 0, 'the slam knocks you away');
  const d = crowd('grabber', 1), f = d.enemies[0];
  f.x = d.hero.x + 70; f.y = d.hero.y; f.timer = 0;
  for (let t = 0; t < 2 && f.charge <= 0; t += 1 / 60) d.update(1 / 60);
  d.requestAction('dodge'); advance(d, .4);
  assert.equal(d.heldBy, null); assert.ok(f.stun > 0, 'a whiffed lunge is punishable');
});
