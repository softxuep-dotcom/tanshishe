import * as Phaser from 'phaser';
import { HEROES, StreetGame, type Fighter } from './simulation';

export function createStreetGame(parent: HTMLElement, sim: StreetGame, publish: () => void, sound: (name: string) => void) {
  class StreetScene extends Phaser.Scene {
    ink!: Phaser.GameObjects.Graphics;
    labels: Phaser.GameObjects.Text[] = [];
    lastPublish = 0;
    constructor() { super('south-bridge'); }
    create() { this.ink = this.add.graphics(); this.game.canvas.setAttribute('aria-label', '南桥夜市横版格斗场地'); }
    update(t: number, delta: number) {
      sim.update(delta / 1000); sim.events.splice(0).forEach(sound);
      this.draw(); if (t - this.lastPublish > 80) { publish(); this.lastPublish = t; }
    }
    label(x: number, y: number, value: string, size = 10, color = '#e8c79a') {
      const text = this.add.text(Math.round(x), Math.round(y), value, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#172030', strokeThickness: 2 }); this.labels.push(text); return text;
    }
    draw() {
      this.labels.forEach(t => t.destroy()); this.labels = []; const g = this.ink; g.clear();
      const r = (x: number, y: number, w: number, h: number, c: number, a = 1) => { g.fillStyle(c, a); g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
      const offset = sim.shake > 0 ? Math.sin(sim.time * 137) * sim.shake * 11 : 0;
      const camera = sim.phase === 'select' ? 0 : sim.camera;
      r(0, 0, 480, 270, 0x172331); r(0, 34, 480, 70, 0x24384a);
      r(377 - camera * .07, 26, 22, 22, 0xebc68c); r(373 - camera * .07, 22, 19, 20, 0x172331);
      for (let i = 0; i < 15; i++) {
        const x = i * 47 - camera * .17 % 47; const h = 37 + (i * 17 % 44);
        r(x, 111 - h, 39, h, 0x1b2b3e); for (let j = 0; j < 3; j++) r(x + 8 + j * 10, 120 - h, 3, 5, 0x9a865d, .55);
      }
      r(0, 150, 480, 120, 0x343946); r(0, 154, 480, 5, 0x7a6460); r(0, 160, 480, 3, 0x242a35);
      for (let i = 0; i < 36; i++) { const x = i * 45 - camera % 45; r(x, 196, 25, 1, 0x52515b); r(x + 15, 235, 29, 1, 0x52515b); }
      r(0, 255, 480, 15, 0x242733); for (let i = 0; i < 12; i++) r(i * 50 - camera % 50, 257, 29, 2, 0x7b6753);
      const signs = ['满记饭馆', '南桥修车', '街机游戏厅', '桥下拳馆', '黑桥赛事'];
      for (let i = 0; i < 8; i++) {
        const x = i * 182 - camera + offset; if (x < -190 || x > 480) continue;
        const color = [0x675057, 0x45515a, 0x4f5552][i % 3]; r(x, 51, 178, 103, color); r(x, 50, 178, 5, 0x9b7a68);
        for (let k = 0; k < 5; k++) { r(x, 75 + k * 16, 178, 1, 0x242c39, .3); r(x + k * 35, 51, 1, 103, 0x242c39, .2); }
        r(x + 10, 66, 154, 30, 0x252b38); r(x + 12, 68, 150, 2, i % 2 ? 0x71c6b2 : 0xeaa86c);
        this.label(x + 35, 73, signs[i % 5], 15, i % 2 ? '#8adcc5' : '#ffd18d');
        r(x + 17, 104, 58, 46, 0x222b36); r(x + 21, 108, 50, 38, 0x897260); r(x + 43, 106, 3, 44, 0x302e35);
        r(x + 90, 101, 65, 49, 0x283440); for (let z = 0; z < 8; z++) r(x + 92, 104 + z * 6, 61, 2, 0x586268);
        if (i % 2 === 0) { for (let j = 0; j < 8; j++) r(x + 4 + j * 21, 98, 21, 8, j % 2 ? 0xb36b58 : 0xd5bc8b); }
        r(x + 170, 48, 3, 109, 0x252d38); r(x + 157, 47, 27, 4, 0x28313e);
        r(x + 169, 52, 14, 18, 0xb9544b); r(x + 174, 52, 4, 18, 0xf0a461); r(x + 175, 70, 2, 6, 0xe2a364);
      }
      // Foreground street props remain outside the combat lane.
      for (let i = 0; i < 7; i++) { const x = i * 215 + 136 - camera; r(x, 142, 25, 14, 0x92704d); r(x + 2, 143, 21, 2, 0xc09c65); r(x + 11, 142, 2, 14, 0x5e4c40); }
      if (sim.food) { const x = 768 - camera; g.fillStyle(0xf8d394); g.fillEllipse(x, 204 + Math.sin(sim.time * 4) * 2, 15, 11); this.label(x - 18, 217, '+45 HP', 8, '#b9e7ad'); }
      const people = sim.phase === 'select' ? [sim.hero] : [...sim.enemies, sim.hero];
      people.filter(f => f.hp > 0 || f.dead > 0).sort((a, b) => a.y - b.y).forEach(f => this.person(f, f.x - camera + offset, f.y));
      for (const s of sim.sparks) {
        const x = s.x - camera, y = s.y - (1 - s.life) * 13; this.label(x - 6, y, s.text, 12, '#ffedb1');
        if (/^\d/.test(s.text)) { g.lineStyle(2, 0xffebac, s.life * 2); for (let a = 0; a < 6; a++) { const angle = a * Math.PI / 3; g.lineBetween(x + Math.cos(angle) * 6, y + 18 + Math.sin(angle) * 6, x + Math.cos(angle) * 14, y + 18 + Math.sin(angle) * 14); } }
      }
      const live = sim.enemies.filter(e => e.hp > 0);
      if (sim.phase === 'playing' && !live.length) this.label(290, 120, sim.training ? '已清场 · 可重置陪练' : '前进 →', 15, '#ffe093');
      if (sim.training && sim.showRanges) {
        const p = sim.hero, x = p.x - camera + offset;
        const reach = p.jump > 0 ? 63 : 48;
        g.lineStyle(1, 0xffc66f, .9);
        g.strokeRect(x + (p.face > 0 ? -9 : -reach), p.y - 23, reach + 9, 46);
        for (const f of [p, ...live]) {
          const fx = f.x - camera + offset;
          g.lineStyle(1, f === p ? 0x8adbc1 : 0xec8c93);
          g.lineBetween(fx - 5, f.y, fx + 5, f.y); g.lineBetween(fx, f.y - 5, fx, f.y + 5);
          g.strokeRect(fx - 10, f.y - 55, 20, 55);
        }
        this.label(8, 110, '黄框：普攻检测范围 / 十字：脚底判定点', 8);
        this.label(8, 121, '竖框仅示意身体，不参与命中计算', 8);
      }
      if (sim.phase === 'playing' && sim.time < 7) this.label(115, 250, '连打清兵 · 靠近抓投 · 跳跃躲攻击', 9);
      const boss = live.find(e => e.kind === 'boss');
      if (boss) { r(144, 42, 192, 4, 0x261f2a); r(144, 42, 192 * boss.hp / boss.max, 4, 0xd4635a); this.label(215, 48, '铁 头', 9, '#eaa086'); }
    }
    person(f: Fighter, x: number, ground: number) {
      const g = this.ink; const isHero = f === sim.hero; const big = f.kind === 'boss' || f.kind === 'tank' || f.kind === 'tuo';
      const jump = f.jump > 0 ? Math.sin(f.jump / .7 * Math.PI) * 33 : 0;
      const moving = isHero ? Math.hypot(sim.mx, sim.my) > .1 : f.timer < .9 && f.stun <= 0;
      const stride = moving && f.pose === 'idle' ? Math.sin(sim.time * 13 + f.id) * 5 : 0;
      const y = ground - jump; const w = big ? 24 : 17; const face = f.face;
      let shirt = isHero ? HEROES[sim.role].color : f.kind === 'boss' ? 0xb54f48 : f.kind === 'runner' ? 0x9981b0 : f.kind === 'tank' ? 0x6f8a73 : 0x74849b;
      if (f.pose === 'hurt') shirt = 0xf5e4bd;
      const alpha = f.hp <= 0 ? f.dead / .65 : isHero && f.inv > 0 && Math.floor(sim.time * 18) % 2 ? .45 : 1;
      g.fillStyle(0x0c1523, .4); g.fillEllipse(x, ground + 1, big ? 38 : 28, 9);
      const r = (a: number, b: number, c: number, d: number, color: number) => { g.fillStyle(color, alpha); g.fillRect(Math.round(x + (face === 1 ? a : -a - c)), Math.round(y + b), c, d); };
      if (f.hp <= 0 || f.pose === 'thrown') { r(-20, -12, 32, 12, shirt); r(12, -13, 11, 12, 0xdfa77d); r(-27, -10, 9, 8, 0x1b2635); return; }
      if (f.wind > 0) { g.lineStyle(2, 0xfaa36e, .9); g.strokeEllipse(x, ground + 1, 43, 13); this.label(x - 3, y - 68, '!', 17, '#ffbe76'); if (f.kind === 'boss') { g.fillStyle(0xee6356, .17); g.fillRect(face > 0 ? x : x - 155, ground - 12, 155, 25); } }
      if (f.pose === 'special') { g.lineStyle(5, HEROES[sim.role].color, .7); g.strokeEllipse(x, y - 25, 110 + Math.sin(sim.time * 40) * 10, 55); }
      r(-w / 2 - 1, -36, w + 2, 23, 0x172332); r(-w / 2, -37, w, 22, shirt);
      r(-w / 2, -37, 5, 19, 0x283a49); r(-7, -15, 7, 13 + stride, 0x263749); r(2, -15, 7, 13 - stride, 0x344b5b);
      r(-8, -3 + stride, 10, 4, 0x171f2a); r(2, -3 - stride, 12, 4, 0x171f2a);
      r(-7, -54, 16, 17, 0xe0ab80); r(-8, -55, 17, 5, 0x282832); r(-8, -51, 4, 8, 0x282832); r(5, -48, 3, 3, 0x252434); r(6, -40, 5, 2, 0xa66a54);
      if (f.kind === 'man' || f.kind === 'runner') r(-8, -52, 18, 3, 0xe0b375);
      if (big) { r(-7, -41, 15, 3, 0x3e3031); r(-11, -33, 7, 17, 0xdba077); }
      const attack = ['punch', 'kick', 'uppercut', 'throw', 'charge'].includes(f.pose);
      r(-w / 2 - 4, -32, 6, 14, shirt); r(-w / 2 - 4, -20, 6, 7, 0xe0ab80);
      if (attack) {
        if (f.pose === 'kick') { r(7, -20, 24, 8, 0x344b5b); r(28, -21, 9, 10, 0xe4c58e); }
        else if (f.pose === 'uppercut') { r(10, -41, 7, 14, shirt); r(11, -51, 9, 11, 0xe0ab80); }
        else { r(8, -33, 21, 7, shirt); r(27, -35, 9, 10, 0xe0ab80); }
        g.lineStyle(2, 0xfbe6b1, .6); g.lineBetween(x + face * 20, y - 23, x + face * 39, y - 27);
      } else { r(w / 2 - 2, -32, 7, 13, shirt); r(w / 2, -22, 7, 7, 0xe0ab80); }
      if (!isHero && f.hp < f.max) { g.fillStyle(0x172331); g.fillRect(x - 13, y - 62, 26, 3); g.fillStyle(0xe89d77); g.fillRect(x - 13, y - 62, 26 * f.hp / f.max, 3); }
      if (isHero) { g.fillStyle(HEROES[sim.role].color); g.fillTriangle(x - 4, y - 67, x + 4, y - 67, x, y - 63); }
    }
  }
  return new Phaser.Game({ type: Phaser.AUTO, width: 480, height: 270, parent, backgroundColor: '#172331', pixelArt: true, antialias: false, audio: { noAudio: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: StreetScene, banner: false });
}
