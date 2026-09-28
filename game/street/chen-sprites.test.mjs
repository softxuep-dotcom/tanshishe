import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHEN_FRAMES, CHEN_SHEET, chenAnimFor, chenAttackFrame, chenFrame, chenLoopFrame } from './chen-sprites.ts';
import { ATTACKS } from './combat-data.ts';

const base = { role: 'chen', hp: 100, pose: 'idle', motion: 'grounded', height: 0, carrying: false, attack: null, moving: false, running: false };

test('the sheet on disk holds every frame the animations reference', () => {
  const png = readFileSync(new URL('./sprites/chen.png', import.meta.url));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(width % CHEN_SHEET.frameWidth, 0); assert.equal(height % CHEN_SHEET.frameHeight, 0);
  const cells = (width / CHEN_SHEET.frameWidth) * (height / CHEN_SHEET.frameHeight);
  for (const frames of Object.values(CHEN_FRAMES)) for (const n of frames) assert.ok(n < cells, `frame ${n} outside ${cells} cells`);
});

test('the impact frame is on screen exactly while each punch can land', () => {
  for (const id of ['jab', 'cross', 'uppercut']) {
    const a = ATTACKS.chen[id], [windup, star, half, last] = CHEN_FRAMES[id];
    const at = t => chenAttackFrame(id, t, a.windup, a.active, a.recover);
    assert.equal(at(0), windup, id);
    assert.equal(at(a.windup - 1e-6), windup, id);
    assert.equal(at(a.windup), star, id);
    assert.equal(at(a.windup + a.active - 1e-6), star, id);
    assert.equal(at(a.windup + a.active), half, id);
    assert.equal(at(a.windup + a.active + a.recover - 1e-6), last, id);
  }
});

test('loops advance at the documented frame length and wrap', () => {
  assert.equal(chenLoopFrame('walk', 0), CHEN_FRAMES.walk[0]);
  assert.equal(chenLoopFrame('walk', .1), CHEN_FRAMES.walk[1]);
  assert.equal(chenLoopFrame('walk', .6), CHEN_FRAMES.walk[0]);
  assert.equal(chenLoopFrame('run', .07 * 7), CHEN_FRAMES.run[1]);
  assert.equal(chenLoopFrame('idle', .16 * 3), CHEN_FRAMES.idle[3]);
  assert.equal(chenFrame('jab', 5, null), CHEN_FRAMES.jab[0]);
});

test('only drawn states use the sheet; everything else keeps the programmatic figure', () => {
  assert.equal(chenAnimFor(base), 'idle');
  assert.equal(chenAnimFor({ ...base, moving: true }), 'walk');
  assert.equal(chenAnimFor({ ...base, moving: true, running: true }), 'run');
  assert.equal(chenAnimFor({ ...base, pose: 'punch', attack: 'jab' }), 'jab');
  assert.equal(chenAnimFor({ ...base, pose: 'punch', attack: 'cross', moving: true }), 'cross');
  assert.equal(chenAnimFor({ ...base, pose: 'uppercut', attack: 'uppercut' }), 'uppercut');
  assert.equal(chenAnimFor({ ...base, pose: 'punch' }), 'idle', 'a punch pose outliving its strike shows the guard');
  for (const other of [
    { role: 'tuo' }, { hp: 0 }, { motion: 'airborne', height: 20 }, { motion: 'landing' }, { carrying: true },
    { pose: 'dash', attack: 'dash' }, { pose: 'slide', attack: 'slide' }, { pose: 'hurt' }, { pose: 'grab' },
    { pose: 'dodge' }, { pose: 'held' }, { pose: 'tornado' }, { pose: 'special' }, { pose: 'super' },
  ]) assert.equal(chenAnimFor({ ...base, ...other }), null, JSON.stringify(other));
});
