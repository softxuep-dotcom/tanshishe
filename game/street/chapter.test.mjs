import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGame, enemyHealth } from './simulation.ts';
import { CHAPTERS, CHAPTER_COUNT, bossDisplayName, waveBounds } from './chapter-data.ts';
import { BOSS_MOVES, BOSS_RULES } from './encounter-data.ts';
import { HERO_TOKEN, STORY, speaker } from './story-data.ts';

const advance = (g, seconds, step = 1 / 120) => { for (let t = 0; t < seconds; t += step) g.update(step); };
const clearEncounter = g => {
  g.hero.inv = 100; g.mx = 0;
  for (let frame = 0; frame < 120 * 12 && !g.encounterClear; frame++) {
    for (const e of g.enemies) g.hit(e, 9999, 0);
    g.update(1 / 120);
  }
  assert.equal(g.encounterClear, true);
};
const reachBoss = (g, chapter) => {
  g.start('chen', chapter); g.proceed();
  for (let wave = 0; wave < 3; wave++) { clearEncounter(g); g.mx = 1; advance(g, 7); g.mx = 0; }
  assert.equal(g.phase, 'bossIntro'); g.proceed(); return g.enemies[0];
};
// Keep the player glued in front of the boss so every move actually commits.
const duel = kind => {
  const g = new StreetGame(); g.startTraining('chen', kind); g.godMode = true;
  const e = g.enemies[0]; e.x = 300; e.y = 200; e.timer = 0; g.hero.x = 266; g.hero.y = 200;
  return { g, e };
};
const runPhases = ({ g, e }, seconds, step = 1 / 120) => {
  const phases = []; let last = '';
  for (let t = 0; t < seconds; t += step) {
    g.hero.x = e.x - 34; g.hero.y = e.y;
    g.update(step);
    const now = e.guard > 0 ? 'guard' : e.wind > 0 ? `wind:${g.bossPendingMove(e)}` : e.charge > 0 ? 'charge'
      : e.bossAttack > 0 ? 'strike' : e.vulnerable > 0 ? 'open' : 'idle';
    if (now !== last) { phases.push(now); last = now; }
  }
  return phases;
};

test('every chapter declares a distinct boss, and the roster data lines up with it', () => {
  assert.equal(CHAPTER_COUNT, 4);
  assert.deepEqual(CHAPTERS.map(c => c.boss), ['boss', 'longleg', 'luchuan', 'hanxiao']);
  assert.equal(new Set(CHAPTERS.map(c => c.name)).size, CHAPTER_COUNT);
  assert.equal(new Set(CHAPTERS.map(c => c.theme)).size, CHAPTER_COUNT);
  assert.deepEqual(CHAPTERS.map(c => enemyHealth(c.boss)), [320, 320, 360, 420]);
  for (let chapter = 0; chapter < CHAPTER_COUNT; chapter++) {
    const g = new StreetGame(); g.start('chen', chapter);
    assert.equal(g.chapterName, CHAPTERS[chapter].name);
    assert.equal(g.bossName, CHAPTERS[chapter].bossName);
    assert.equal(g.bossKind, CHAPTERS[chapter].boss);
    assert.equal(g.hasNextChapter, chapter < CHAPTER_COUNT - 1);
  }
});

test('victory chains forward one chapter at a time and stops after the last one', () => {
  const g = new StreetGame(); g.start('man');
  for (let chapter = 0; chapter < CHAPTER_COUNT - 1; chapter++) {
    assert.equal(g.chapter, chapter);
    g.phase = 'won'; g.hero.hp = 12; g.nextChapter();
    assert.equal(g.chapter, chapter + 1);
    assert.equal(g.phase, 'intro');
    assert.equal(g.role, 'man');
    assert.equal(g.hero.hp, g.hero.max);
  }
  g.phase = 'won'; g.nextChapter();
  assert.equal(g.chapter, CHAPTER_COUNT - 1, 'the last chapter has nowhere to advance to');
  assert.equal(g.phase, 'won');
});

test('the mall and arena chapters play through all three streets into their own boss', () => {
  for (const [chapter, kind] of [[2, 'luchuan'], [3, 'hanxiao']]) {
    const g = new StreetGame();
    const boss = reachBoss(g, chapter);
    assert.equal(boss.kind, kind);
    assert.equal(boss.max, enemyHealth(kind));
    assert.equal(g.crates.length, CHAPTERS[chapter].crates ? 2 : 0);
    g.hit(boss, 99999, 0); advance(g, 1);
    assert.equal(g.phase, 'won');
    assert.equal(g.chapter, chapter, 'a finished chapter must not fall back to the night market');
  }
});

test('losing or retrying a later chapter stays on that chapter', () => {
  const g = new StreetGame(); g.start('tuo', 2); g.proceed();
  g.hero.inv = 0; g.hurt(9999, 1);
  assert.equal(g.phase, 'lost'); assert.equal(g.chapter, 2);
  g.start(g.role, g.chapter);
  assert.equal(g.chapter, 2); assert.equal(g.role, 'tuo'); assert.equal(g.phase, 'intro');
});

test('chapter 3 and 4 bosses telegraph every string and always end in a punish window', () => {
  for (const kind of ['luchuan', 'hanxiao']) {
    const state = duel(kind);
    const phases = runPhases(state, 14);
    assert.ok(phases.length > 6, `${kind} should commit to several moves`);
    const names = new Set(phases.filter(p => p.startsWith('wind:')).map(p => p.slice(5)));
    for (const move of BOSS_MOVES[kind]) if (move !== 'counter') assert.ok(names.has(move), `${kind} never used ${move}`);
    // No committed move may reach the next decision without opening a window first.
    for (let i = 0; i < phases.length - 1; i++) {
      if (phases[i] === 'strike' || phases[i] === 'charge') {
        assert.ok(['strike', 'charge', 'open'].includes(phases[i + 1]),
          `${kind}: ${phases[i]} then ${phases[i + 1]} skipped the punish window`);
      }
    }
    assert.ok(phases.includes('open'));
  }
});

test('the configured recovery length holds at common frame rates', () => {
  for (const kind of ['luchuan', 'hanxiao']) for (const step of [1 / 30, 1 / 60, 1 / 120]) {
    const state = duel(kind), { g, e } = state;
    for (let t = 0; t < 6 && !g.isBossVulnerable(e); t += step) { g.hero.x = e.x - 34; g.hero.y = e.y; g.update(step); }
    assert.equal(g.isBossVulnerable(e), true);
    assert.equal(e.vulnerable, BOSS_RULES[kind].recovery);
    assert.equal(e.guard, 0); assert.equal(e.charge, 0); assert.equal(e.bossAttack, 0); assert.equal(e.bossStep, 0);
  }
});

test('luchuan answers his sidestep with a lunge, and a whiffed lunge still opens the window', () => {
  const { g, e } = duel('luchuan');
  let sawGuard = false, startY = 0;
  for (let t = 0; t < 14 && !sawGuard; t += 1 / 120) {
    g.hero.x = e.x - 34; g.hero.y = e.y; g.update(1 / 120);
    if (e.guard > 0) { sawGuard = true; startY = e.y; }
  }
  assert.equal(sawGuard, true);
  // He slips out of the lane he was sharing with the player instead of standing still.
  g.hero.x = e.x - 34; g.hero.y = e.y; advance(g, BOSS_RULES.luchuan.guard * .6);
  assert.notEqual(Math.round(e.y), Math.round(startY));
  // Walk away so the counter cannot connect; it must still end in a punish window.
  g.hero.x = e.x - 260;
  for (let t = 0; t < 2 && !g.isBossVulnerable(e); t += 1 / 120) g.update(1 / 120);
  assert.equal(g.isBossVulnerable(e), true);
  assert.equal(g.hero.hp, g.hero.max);
});

test('both new bosses take a quarter damage outside the window and full damage inside it', () => {
  for (const kind of ['luchuan', 'hanxiao']) {
    const { g, e } = duel(kind);
    e.hp = e.max; g.hit(e, 100, 0);
    assert.equal(e.hp, e.max - 25);
    e.hp = e.max; e.vulnerable = .5; e.motion = 'grounded';
    g.hit(e, 100, 0);
    assert.equal(e.hp, e.max - 100);
  }
});

test('past half health the strings get longer without changing the punish rules', () => {
  for (const kind of ['luchuan', 'hanxiao']) {
    const rules = BOSS_RULES[kind];
    const count = fresh => {
      const { g, e } = duel(kind);
      if (!fresh) e.hp = Math.floor(e.max * .4);
      let hits = 0, seen = false;
      for (let t = 0; t < 6; t += 1 / 120) {
        g.hero.x = e.x - 34; g.hero.y = e.y;
        const before = e.bossStep; g.update(1 / 120);
        if (g.bossPendingMove(e) !== 'combo') continue;
        if (e.bossAttack > 0 && e.bossStep < before) { hits++; seen = true; }
        if (seen && e.vulnerable > 0) break;
      }
      return hits;
    };
    assert.equal(count(true), rules.combo - 1, `${kind} phase 1 string length`);
    assert.equal(count(false), rules.comboPhase2 - 1, `${kind} phase 2 string length`);
  }
});

test('the practice arena names the boss on screen, not the chapter it started from', () => {
  for (const chapter of CHAPTERS) assert.equal(bossDisplayName(chapter.boss), chapter.bossName);
  assert.equal(bossDisplayName('punk'), '');
  for (const kind of ['boss', 'longleg', 'luchuan', 'hanxiao']) {
    const g = new StreetGame(); g.startTraining('chen', kind);
    assert.equal(g.chapter, 0, 'practice always starts from the night market state');
    assert.equal(bossDisplayName(g.enemies[0].kind), CHAPTERS.find(c => c.boss === kind).bossName);
  }
});

test('the boss street keeps the same bounds for every chapter', () => {
  assert.deepEqual(waveBounds(0), { left: 0, right: 455 });
  assert.deepEqual(waveBounds(3), waveBounds(2));
});

test('every chapter has a script for all three heroes, and only the last one ends the prototype', () => {
  assert.equal(STORY.length, CHAPTER_COUNT);
  STORY.forEach((script, chapter) => {
    assert.ok(script.tip && script.intro.lines.length && script.intro.button);
    for (const role of ['chen', 'tuo', 'man']) {
      const scene = script.boss[role];
      assert.ok(scene && scene.lines.length >= 2, `chapter ${chapter} / ${role} needs a boss scene`);
      assert.ok(scene.tutorial.length, `chapter ${chapter} / ${role} needs a how-to-fight note`);
      assert.ok(scene.kicker.includes(CHAPTERS[chapter].bossName));
      for (const line of scene.lines) assert.notEqual(speaker(line.who, role), HERO_TOKEN);
    }
    const last = chapter === CHAPTER_COUNT - 1;
    assert.equal(script.won.nextLabel === null, last);
    assert.equal(typeof script.won.note === 'string', last, 'only the final chapter announces the end of the prototype');
    if (!last) assert.ok(script.won.nextLabel.includes(CHAPTERS[chapter + 1].name));
  });
});

test('the chosen hero replaces the script placeholder everywhere it appears', () => {
  const names = { chen: '陈野', tuo: '阿拓', man: '小满' };
  for (const role of ['chen', 'tuo', 'man']) {
    assert.equal(speaker(HERO_TOKEN, role), names[role]);
    assert.equal(speaker('陆川', role), '陆川');
    for (const script of STORY) {
      const rendered = [script.won.title, ...script.won.lines].join('\n').split(HERO_TOKEN).join(names[role]);
      assert.equal(rendered.includes(HERO_TOKEN), false);
    }
  }
});
