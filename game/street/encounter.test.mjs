import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame } from './simulation.ts';
import { BOSS_RULES, ENCOUNTERS, REINFORCEMENTS } from './encounter-data.ts';

const advance = (g, seconds, step = 1 / 120, ignoreHitstop = false) => {
  for (let remaining = seconds; remaining > 1e-9;) {
    if (ignoreHitstop) g.hitstop = 0;
    const dt = Math.min(step, remaining); g.update(dt); remaining -= dt;
  }
};
const story = (chapter = 0, wave = 0) => {
  const g = new StreetGame(); g.start('chen', chapter); g.proceed();
  if (wave) { g.wave = wave; g.enemies = []; g.hero.x = wave * 410 + 85; g.spawn(); }
  g.hero.inv = 100; return g;
};
const bossArena = kind => {
  const g = new StreetGame(); g.startTraining('chen', kind); g.hero.x = 180; g.hero.y = 200;
  const e = g.enemies[0]; e.x = 260; e.y = 200; e.timer = 0;
  return g;
};
const expose = (g, step = 1 / 120) => {
  const e = g.enemies[0];
  for (let t = 0; t < 3 && !g.isBossVulnerable(e); t += step) {
    g.update(step); if (e.wind > 0) g.hero.y = 240;
  }
  assert.equal(g.isBossVulnerable(e), true); return e;
};

test('chapter totals stay at ten and eleven; each wave respects its cap and FIFO composition', () => {
  assert.deepEqual(ENCOUNTERS.map(chapter => chapter.reduce((sum, wave) => sum + wave.enemies.length, 0)), [10, 11]);
  for (const chapter of [0, 1]) for (const wave of [0, 1, 2]) {
    const g = story(chapter, wave), definition = ENCOUNTERS[chapter][wave];
    assert.equal(g.enemies.length, definition.simultaneous);
    assert.equal(g.remainingEnemies, definition.enemies.length);
    for (let frame = 0; frame < 120 * 8 && !g.encounterClear; frame++) {
      assert.ok(g.enemies.filter(e => e.hp > 0).length <= definition.simultaneous);
      for (const e of g.enemies) if (e.entryTime <= 0) g.hit(e, 9999, 0);
      g.update(1 / 120);
    }
    assert.equal(g.encounterClear, true); assert.equal(g.pendingEnemies, 0);
    assert.deepEqual(g.enemies.map(e => e.kind), definition.enemies);
    assert.equal(new Set(g.enemies.map(e => e.id)).size, definition.enemies.length);
    assert.equal(g.kills, definition.enemies.length);
  }
});

test('reinforcements wait for a vacancy and a readable delay before filling it', () => {
  const g = story(); advance(g, 1); assert.equal(g.enemies.length, 2); assert.equal(g.pendingEnemies, 1);
  g.hit(g.enemies[0], 9999, 0); g.hitstop = 0;
  advance(g, REINFORCEMENTS.delay - .01); assert.equal(g.enemies.length, 2);
  advance(g, .02); assert.equal(g.enemies.length, 3); assert.equal(g.pendingEnemies, 0);
  assert.equal(g.enemies.filter(e => e.hp > 0).length, 2);
});

test('an empty field with queued enemies does not unlock the next encounter', () => {
  const g = story(); for (const e of g.enemies) g.hit(e, 9999, 0);
  g.hero.x = 435; g.hitstop = 0; advance(g, .2);
  assert.equal(g.encounterClear, false); assert.equal(g.remainingEnemies, 1); assert.equal(g.wave, 0);
  advance(g, 1); assert.equal(g.wave, 0); assert.equal(g.phase, 'playing'); assert.equal(g.remainingEnemies, 1);
});

test('entry is at a distant edge and temporarily blocks damage, grabs, attacks and slots', () => {
  const g = story(); g.hero.x = 430; g.hit(g.enemies[0], 9999, 0); g.hitstop = 0;
  advance(g, .61); const e = g.enemies.at(-1);
  assert.ok(Math.hypot(e.x - g.hero.x, e.y - g.hero.y) >= 90); assert.ok(e.entryTime > 0);
  assert.equal(g.hit(e, 100, 0), false); assert.equal(e.hp, e.max);
  e.x = g.hero.x - 20; e.y = g.hero.y; e.timer = 0;
  assert.notEqual(g.grabTarget, e); advance(g, .1);
  assert.equal(e.wind, 0); assert.equal(g.enemySlots.some(s => s.occupant === e.id), false);
  advance(g, .4); assert.equal(e.entryTime, 0); assert.equal(g.hit(e, 1, 0), true);
});

test('new entry cannot be hit by a crate or flying body', () => {
  const g = story(); g.hit(g.enemies[0], 9999, 0); g.hitstop = 0; advance(g, .61);
  const incoming = g.enemies.at(-1), source = g.enemies[1];
  incoming.x = 220; incoming.y = 199; source.x = 180; source.y = 199;
  g.hit(source, 1, 350, { amount: 600, launchSpeed: 200 }); g.hitstop = 0;
  g.shots.push({ x: 210, y: 199, vx: 250, life: 1, crate: true, snack: false });
  advance(g, .12); assert.equal(incoming.hp, incoming.max);
});

test('pause, hitstop and death stop reinforcement timers', () => {
  const g = story(); g.hit(g.enemies[0], 9999, 0); g.hitstop = 0; advance(g, .2);
  g.paused = true; advance(g, 2); assert.equal(g.enemies.length, 2); g.paused = false;
  g.hitstop = .5; advance(g, .3); assert.equal(g.enemies.length, 2); g.hitstop = 0;
  advance(g, .3); assert.equal(g.enemies.length, 2); advance(g, .11); assert.equal(g.enemies.length, 3);
  const lost = story(); lost.hit(lost.enemies[0], 9999, 0); lost.hero.inv = 0; lost.hurt(9999, 1);
  advance(lost, 2); assert.equal(lost.phase, 'lost'); assert.equal(lost.enemies.length, 2);
});

test('restart, chapter change and practice discard pending story reinforcements', () => {
  const g = story(); assert.equal(g.pendingEnemies, 1); g.startTraining('chen', 'punk', 4);
  assert.equal(g.pendingEnemies, 0); assert.equal(g.enemies.length, 4);
  for (const e of g.enemies) g.hit(e, 9999, 0); advance(g, 2);
  assert.equal(g.remainingEnemies, 0); assert.equal(g.enemies.length, 4);
  g.start('chen', 1); assert.equal(g.pendingEnemies, 0); assert.equal(g.enemies.length, 0);
  g.proceed(); assert.deepEqual(g.enemies.map(e => e.kind), ['punk', 'slinger']); assert.equal(g.pendingEnemies, 1);
  g.phase = 'won'; g.start('chen'); g.phase = 'won'; g.nextChapter(); assert.equal(g.pendingEnemies, 0);
});

test('only completed boss attacks open windows, with the configured duration at common frame rates', () => {
  for (const kind of ['boss', 'longleg']) for (const step of [1 / 30, 1 / 60, 1 / 120]) {
    const g = bossArena(kind), e = g.enemies[0]; g.update(step);
    assert.ok(e.wind > 0); assert.equal(e.vulnerable, 0); g.hero.y = 240;
    expose(g, step); assert.equal(e.vulnerable, BOSS_RULES[kind].recovery);
    assert.equal(e.charge, 0); assert.equal(e.bossAttack, 0); assert.equal(e.wind, 0);
    advance(g, e.vulnerable + .01, step); assert.equal(e.vulnerable, 0); assert.equal(g.isBossVulnerable(e), false);
  }
});

test('longleg has an active kick interval before its punish window', () => {
  const g = bossArena('longleg'), e = g.enemies[0];
  for (let i = 0; i < 120 && !e.bossAttack; i++) g.update(1 / 120);
  assert.ok(e.bossAttack > 0); assert.equal(e.vulnerable, 0);
  advance(g, .1); assert.equal(e.vulnerable, 0); advance(g, .1); assert.ok(e.vulnerable > 0);
});

test('boss damage is quartered when guarded and full in recovery, but regular enemies are unchanged', () => {
  for (const kind of ['boss', 'longleg']) {
    const guarded = bossArena(kind), a = guarded.enemies[0]; guarded.hit(a, 20, 0, { amount: 0 });
    assert.equal(a.hp, a.max - 5); assert.ok(guarded.sparks.some(s => s.text === '减伤 5'));
    const open = bossArena(kind), b = expose(open); open.hit(b, 20, 0, { amount: 0 });
    assert.equal(b.hp, b.max - 20); assert.ok(open.sparks.some(s => s.text === '20'));
  }
  const g = story(), e = g.enemies[0]; g.hit(e, 20, 0); assert.equal(e.hp, e.max - 20);
});

test('ordinary hitstun and interrupted telegraphs do not count as boss vulnerability', () => {
  for (const kind of ['boss', 'longleg']) {
    const g = bossArena(kind), e = g.enemies[0]; g.update(.01); assert.ok(e.wind > 0);
    g.hit(e, 20, 0); assert.equal(e.wind, 0); assert.ok(e.stun > 0); assert.equal(e.vulnerable, 0);
    assert.equal(g.isBossVulnerable(e), false); g.hit(e, 20, 0); assert.equal(e.hp, e.max - 10);
  }
});

test('hits do not refresh a boss window or shorten its remaining recovery lock', () => {
  const g = bossArena('boss'), e = expose(g); advance(g, .3);
  const remaining = e.vulnerable; g.hit(e, 20, 0, { amount: 0 });
  assert.equal(e.vulnerable, remaining); assert.ok(e.stun >= remaining); g.hitstop = 0;
  advance(g, remaining + .01); assert.equal(e.vulnerable, 0);
  const hp = e.hp; g.hit(e, 20, 0, { amount: 0 }); assert.equal(e.hp, hp - 5);
});

test('bosses remain launchable while guarded, and knocked-down recovery cannot fabricate a window', () => {
  for (const kind of ['boss', 'longleg']) {
    const g = bossArena(kind), e = g.enemies[0]; g.freezeEnemies = true;
    g.hit(e, 28, 350, { amount: 1200, launchSpeed: 200 }); assert.equal(e.motion, 'launched'); assert.equal(e.hp, e.max - 7);
    advance(g, 1.5); assert.equal(e.motion, 'grounded'); assert.equal(e.vulnerable, 0);
    assert.equal(g.isBossVulnerable(e), false);
  }
});

test('launching within a window does not pause or extend it through the get-up cycle', () => {
  const g = bossArena('longleg'), e = expose(g); g.freezeEnemies = true;
  g.hit(e, 28, 350, { amount: 1200, launchSpeed: 200 }); assert.equal(e.hp, e.max - 28);
  assert.equal(g.isBossVulnerable(e), false); advance(g, 1.5);
  assert.equal(e.vulnerable, 0); assert.equal(g.isBossVulnerable(e), false);
});

test('specials, crates and flying-body collateral use the same boss damage rule', () => {
  for (const vulnerable of [false, true]) {
    const factor = vulnerable ? 1 : .25;
    const special = bossArena('boss'), a = special.enemies[0]; special.freezeEnemies = true; a.vulnerable = vulnerable ? 1 : 0;
    special.requestAction('special'); assert.equal(a.hp, a.max - 40 * factor);
    const crate = bossArena('boss'), b = crate.enemies[0]; crate.freezeEnemies = true; b.vulnerable = vulnerable ? 1 : 0;
    crate.shots.push({ x: b.x - 15, y: b.y, vx: 250, life: 1, crate: true, snack: false }); advance(crate, .02);
    assert.equal(b.hp, b.max - 36 * factor);
    const body = bossArena('boss'), c = body.enemies[0]; body.freezeEnemies = true; c.vulnerable = vulnerable ? 1 : 0;
    const source = body.fighter('punk', c.x - 45, c.y, 100); body.enemies.push(source);
    body.hit(source, 1, 350, { amount: 1200, launchSpeed: 200 }); body.hitstop = 0; advance(body, .1);
    assert.equal(c.hp, c.max - 25 * factor);
  }
});

test('pause and hitstop freeze vulnerability, and training reset clears every boss timer', () => {
  const g = bossArena('boss'), e = expose(g), window = e.vulnerable;
  g.paused = true; advance(g, 2); assert.equal(e.vulnerable, window); g.paused = false;
  g.hitstop = .5; advance(g, .3); assert.equal(e.vulnerable, window);
  g.resetTraining(); const next = g.enemies[0]; assert.equal(next.vulnerable, 0); assert.equal(next.bossAttack, 0); assert.equal(next.charge, 0);
});

test('both bosses can be defeated entirely by punishing successive natural windows', () => {
  for (const kind of ['boss', 'longleg']) {
    const g = bossArena(kind), e = g.enemies[0]; let windows = 0;
    while (e.hp > 0 && windows < 5) {
      g.hero.x = e.x - 70; g.hero.y = e.y; e.timer = 0;
      expose(g); g.hit(e, 100, 0, { amount: 0 }); windows++;
      g.hero.y = 240; advance(g, 1.4);
    }
    assert.equal(e.hp, 0); assert.equal(g.kills, 1); assert.equal(windows, 4);
  }
});
