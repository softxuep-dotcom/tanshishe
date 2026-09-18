/// <reference types="vite/client" />
import * as Phaser from 'phaser';
import { BOARD, HookGame, type Body, type HookSnapshot, type Rect } from './simulation';

const C = { ink: 0x243e3b, floor: 0xe9e5d9, tile: 0xd5d3c6, teal: 0x247975, blue: 0x4399b1, gold: 0xf1b852, orange: 0xec8550, dark: 0x1e3737, mint: 0xb9d7b7 };
const font = 'Arial, "Microsoft YaHei", sans-serif';

export function createHookGame(parent: HTMLElement, sim: HookGame, publish: (state: HookSnapshot) => void, ready: () => void, onEvent: (name: string) => void): Phaser.Game {
  let disposeInput = () => {};
  class HookScene extends Phaser.Scene {
    private floor!: Phaser.GameObjects.Graphics;
    private dynamic!: Phaser.GameObjects.Graphics;
    private rope!: Phaser.GameObjects.Graphics;
    private labels: Phaser.GameObjects.Text[] = [];
    private entities = new Map<string, Phaser.GameObjects.Container>();
    private cargoLabels = new Map<string, Phaser.GameObjects.Text>();
    private currentBodies?: Body[];
    private level = -1;
    private activePointer: number | null = null;
    private lastPublish = -100;
    private lastPhase = '';
    private hover?: { x: number; y: number };
    constructor() { super('hook-workshop'); }
    create() {
      this.cameras.main.setBackgroundColor('#e9e5d9');
      this.floor = this.add.graphics().setDepth(0);
      this.dynamic = this.add.graphics().setDepth(2);
      this.rope = this.add.graphics().setDepth(8);
      const canvas = this.game.canvas;
      canvas.setAttribute('aria-label', '钩索搬运场地：按住货物或蓝色固定点牵引，松手脱钩');
      canvas.style.touchAction = 'none';
      const point = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * BOARD.width, y: (e.clientY - r.top) / r.height * BOARD.height }; };
      const release = () => { sim.endPull(); this.activePointer = null; };
      const down = (e: PointerEvent) => {
        if (e.button !== 0 || this.activePointer !== null || sim.phase !== 'playing') return;
        e.preventDefault(); const p = point(e); this.hover = p;
        this.activePointer = e.pointerId;
        try { canvas.setPointerCapture(e.pointerId); } catch {}
        sim.beginPull(p.x, p.y); publish(sim.snapshot());
      };
      const up = (e: PointerEvent) => { if (this.activePointer !== e.pointerId) return; release(); publish(sim.snapshot()); };
      const move = (e: PointerEvent) => { if (e.pointerType === 'mouse') this.hover = point(e); };
      const leave = () => { this.hover = undefined; };
      const context = (e: Event) => e.preventDefault();
      const key = (e: KeyboardEvent) => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
        const k = e.key.toLowerCase();
        if (!['escape', 'z', 'r'].includes(k)) return;
        e.preventDefault(); release();
        if (k === 'escape') { if (sim.phase === 'paused') sim.resume(); else sim.pause(); }
        if (k === 'z') sim.undo();
        if (k === 'r') sim.restart();
        publish(sim.snapshot());
      };
      const blur = () => { release(); sim.pause(); publish(sim.snapshot()); };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('contextmenu', context);
      window.addEventListener('keydown', key); window.addEventListener('pointerup', up); window.addEventListener('blur', blur);
      if (import.meta.env.DEV) {
        const debugHost = window as unknown as { __HOOK_READ__?: () => unknown };
        debugHost.__HOOK_READ__ = () => ({ ...sim.snapshot(), bodies: sim.bodies.map(b => ({ ...b })), targetId: sim.targetId, plateActive: sim.plateActive });
        this.events.once('shutdown', () => { delete debugHost.__HOOK_READ__; });
      }
      const resize = () => { release(); };
      window.addEventListener('resize', resize);
      // The DOM HUD can change the available height after the window resize event.
      const observer = new ResizeObserver(() => { this.scale.getParentBounds(); this.scale.refresh(); });
      observer.observe(parent);
      this.events.once('shutdown', () => { observer.disconnect(); window.removeEventListener('resize', resize); });
      disposeInput = () => { release(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('contextmenu', context); window.removeEventListener('keydown', key); window.removeEventListener('pointerup', up); window.removeEventListener('blur', blur); };
      this.events.once('shutdown', disposeInput);
      this.rebuild(); publish(sim.snapshot()); ready();
    }
    private text(x: number, y: number, text: string, size = 12, color = '#63786b') {
      const label = this.add.text(x, y, text, { fontFamily: font, fontSize: `${size}px`, color, fontStyle: 'bold', align: 'center' }).setOrigin(.5).setDepth(3); this.labels.push(label); return label;
    }
    private wall(g: Phaser.GameObjects.Graphics, r: Rect) {
      g.fillStyle(C.ink, .15).fillRoundedRect(r.x + 3, r.y + 6, r.w, r.h, 5);
      g.fillStyle(0x516562).fillRoundedRect(r.x, r.y, r.w, r.h, 4);
      g.fillStyle(0x84968a).fillRoundedRect(r.x, r.y, r.w, Math.min(9, r.h), 3);
      g.lineStyle(2, 0x344e48).strokeRoundedRect(r.x, r.y, r.w, r.h, 4);
      for (let y = r.y + 17; y < r.y + r.h - 8; y += 26) { g.lineStyle(1, 0x9eafa0, .3).lineBetween(r.x + 7, y, r.x + r.w - 7, y); }
      if (r.h > 80) {
        g.fillStyle(0xb8c2ae).fillRoundedRect(r.x + 12, r.y + 22, r.w - 24, 31, 3);
        g.fillStyle(0x778776).fillRect(r.x + r.w / 2 - 2, r.y + 22, 4, 31);
        g.fillStyle(0xc6b797).fillRoundedRect(r.x + 9, r.y + 68, r.w - 18, 38, 3);
        g.fillStyle(0xa8997e).fillRect(r.x + r.w / 2 - 3, r.y + 68, 6, 38);
      }
    }
    private rebuild() {
      this.labels.forEach(t => t.destroy()); this.labels = [];
      this.entities.forEach(e => e.destroy()); this.entities.clear();
      this.cargoLabels.clear();
      this.currentBodies = sim.bodies; this.level = sim.levelIndex;
      const g = this.floor; g.clear();
      g.fillStyle(C.floor).fillRect(0, 0, 440, 580);
      g.fillStyle(0xf3efe3).fillRoundedRect(18, 18, 404, 544, 10);
      g.lineStyle(1, C.tile, .6);
      for (let x = 34; x < 425; x += 38) g.lineBetween(x, 20, x, 560);
      for (let y = 30; y < 562; y += 38) g.lineBetween(19, y, 421, y);
      g.fillStyle(0x607a70).fillRoundedRect(3, 4, 434, 13, 5);
      g.fillStyle(0x607a70).fillRoundedRect(3, 564, 434, 13, 5);
      g.fillStyle(0x819385).fillRect(4, 17, 12, 549); g.fillRect(424, 17, 12, 549);
      for (let y = 36; y < 556; y += 54) { g.fillStyle(0xc7ceb9).fillCircle(10, y, 2); g.fillCircle(430, y, 2); }
      const d = sim.level.dock;
      g.fillStyle(0xc6ddbf).fillRoundedRect(d.x, d.y, d.w, d.h, 13);
      g.lineStyle(2, 0x88ae90).strokeRoundedRect(d.x, d.y, d.w, d.h, 13);
      for (let x = d.x + 13; x < d.x + d.w - 10; x += 19) { g.lineStyle(4, 0x9abda0, .65).lineBetween(x, d.y + d.h - 12, x + 6, d.y + d.h - 18); }
      this.text(d.x + d.w / 2, d.y + 16, '装 货 区', 12, '#4d795f');
      this.text(220, 43, ['01  /  初次上工', '02  /  拐个弯', '03  /  聪明地搬'][sim.levelIndex], 12, '#819184');
      sim.level.walls.forEach(r => this.wall(g, r));
      if (sim.level.plate && sim.level.gate) {
        const p = sim.level.plate, gate = sim.level.gate;
        g.lineStyle(5, 0xdac77e, .85).lineBetween(p.x, p.y, p.x, 300); g.lineBetween(p.x, 300, gate.x + gate.w / 2, 300); g.lineBetween(gate.x + gate.w / 2, 300, gate.x + gate.w / 2, gate.y + gate.h);
        this.text(p.x - 58, p.y - 12, '重物\n压住', 12, '#877138');
        this.text(365, 242, '绕行 ↓', 12, '#7d8a7b');
      }
      for (const body of sim.bodies) this.entities.set(body.id, this.entity(body));
    }
    private entity(b: Body) {
      const g = this.add.graphics(), parts: Phaser.GameObjects.GameObject[] = [g];
      if (b.kind === 'anchor') {
        g.fillStyle(0x234b55, .12).fillEllipse(1, 5, 36, 25);
        g.fillStyle(0xd2e8e6).fillCircle(0, 0, 19); g.lineStyle(2, 0x92bfc1).strokeCircle(0, 0, 19);
        g.fillStyle(C.blue).fillCircle(0, 0, 12); g.lineStyle(3, 0xf8ffff).strokeCircle(0, 0, 6);
        g.fillStyle(0xf8ffff).fillCircle(0, 0, 2);
      } else if (b.kind === 'robot') {
        g.fillStyle(C.ink, .18).fillEllipse(1, 8, 43, 32);
        g.fillStyle(C.dark).fillRoundedRect(-21, -12, 9, 26, 4); g.fillRoundedRect(12, -12, 9, 26, 4);
        g.fillStyle(0xc97440).fillRoundedRect(-17, -16, 34, 36, 11);
        g.fillStyle(C.orange).fillRoundedRect(-17, -19, 34, 34, 11);
        g.fillStyle(0xffb976).fillRoundedRect(-12, -17, 24, 7, 3);
        g.fillStyle(C.dark).fillRoundedRect(-12, -7, 24, 14, 5);
        g.fillStyle(0xf5f6cf).fillCircle(-5, -1, 2.5); g.fillCircle(5, -1, 2.5);
        g.lineStyle(3, C.dark).lineBetween(0, -18, 0, -24); g.fillStyle(0xf5cd73).fillCircle(0, -25, 3);
        g.fillStyle(0xffd5a2).fillRoundedRect(-6, 10, 12, 4, 2);
      } else {
        const heavy = b.kind === 'heavy', r = b.r;
        g.fillStyle(C.ink, .18).fillRoundedRect(-r, -r + 7, r * 2 + 3, r * 2, 7);
        g.fillStyle(heavy ? 0x334c59 : 0xbd8540).fillRoundedRect(-r, -r + 4, r * 2, r * 2 - 1, 5);
        g.fillStyle(heavy ? 0x668390 : C.gold).fillRoundedRect(-r, -r, r * 2, r * 2 - 3, 5);
        g.fillStyle(heavy ? 0x90a8ad : 0xffd681).fillRoundedRect(-r + 3, -r + 2, r * 2 - 6, 6, 2);
        g.fillStyle(heavy ? 0x394f59 : 0xc89042).fillRect(-4, -r + 1, 8, r * 2 - 5);
        if (heavy) {
          for (const x of [-17, 17]) for (const y of [-14, 14]) g.fillStyle(0xcee1de).fillCircle(x, y, 2);
          g.fillStyle(0xe4e9d7).fillRoundedRect(-10, -9, 20, 19, 3);
          const label = this.add.text(0, 0, '重', { fontFamily: font, fontSize: '12px', fontStyle: 'bold', color: '#355563' }).setOrigin(.5); parts.push(label);
        } else {
          g.fillStyle(0xfff1cd).fillRoundedRect(3, 1, 12, 11, 2); g.lineStyle(1, 0xb58e50).lineBetween(7, 4, 12, 4); g.lineBetween(7, 7, 10, 7);
        }
      }
      if (b.required) {
        const label = this.add.text(0, -b.r - 14, '', { fontFamily: font, fontSize: '13px', fontStyle: 'bold', color: '#775626', backgroundColor: '#fff8e8', padding: { x: 4, y: 3 } }).setOrigin(.5);
        this.cargoLabels.set(b.id, label); parts.push(label);
      }
      return this.add.container(b.x, b.y, parts).setDepth(b.kind === 'anchor' ? 4 : b.kind === 'robot' ? 9 : 6);
    }
    update(time: number, delta: number) {
      sim.update(delta / 1000);
      if (sim.levelIndex !== this.level || this.currentBodies !== sim.bodies) { this.activePointer = null; this.rebuild(); }
      if (sim.phase !== 'playing') this.activePointer = null;
      for (const b of sim.bodies) {
        const entity = this.entities.get(b.id); entity?.setPosition(b.x, b.y);
        if (b.kind === 'robot' && sim.target) entity?.setRotation(Math.atan2(sim.target.y - b.y, sim.target.x - b.x) + Math.PI / 2);
      }
      this.dynamic.clear(); const g = this.dynamic;
      if (sim.level.plate && sim.level.gate) {
        const p = sim.level.plate, gate = sim.level.gate;
        g.fillStyle(sim.plateActive ? 0x7aaf8a : 0xd9be6b).fillCircle(p.x, p.y, p.r);
        g.lineStyle(3, sim.plateActive ? 0x408268 : 0xb39649).strokeCircle(p.x, p.y, p.r);
        g.lineStyle(2, 0xf4edd0, .6).strokeCircle(p.x, p.y, p.r - 7);
        if (sim.gateOpen) { g.lineStyle(2, 0x438365, .5).strokeRect(gate.x, gate.y, gate.w, gate.h); g.fillStyle(0x76ac7c).fillRect(gate.x, gate.y, 6, gate.h); g.fillRect(gate.x + gate.w - 6, gate.y, 6, gate.h); }
        else {
          g.fillStyle(C.ink, .2).fillRect(gate.x, gate.y + 5, gate.w, gate.h);
          g.fillStyle(0xc5a954).fillRoundedRect(gate.x, gate.y, gate.w, gate.h, 3);
          for (let x = gate.x + 7; x < gate.x + gate.w - 5; x += 16) { g.lineStyle(6, 0x536665).lineBetween(x, gate.y + 3, x + 9, gate.y + gate.h - 3); }
        }
      }
      const delivered = new Set(sim.delivered().map(b => b.id));
      for (const b of sim.bodies) if (b.required) {
        const ready = delivered.has(b.id), name = b.kind === 'heavy' ? '重箱' : '轻箱';
        this.cargoLabels.get(b.id)?.setText(`${name} · ${ready ? '就位' : '待送'}`).setColor(ready ? '#39603d' : '#775626').setBackgroundColor(ready ? '#e4eedb' : '#fff8e8');
      }
      for (const b of sim.bodies) if (delivered.has(b.id)) { g.lineStyle(3, 0x62a078, .7).strokeRoundedRect(b.x - b.r - 5, b.y - b.r - 5, b.r * 2 + 10, b.r * 2 + 10, 10); }
      this.rope.clear(); const rope = this.rope, p = sim.robot, t = sim.target;
      if (t) {
        rope.lineStyle(6, C.dark, .8).lineBetween(p.x, p.y, t.x, t.y); rope.lineStyle(3, 0xffd67a).lineBetween(p.x, p.y, t.x, t.y);
        const distance = Math.hypot(t.x - p.x, t.y - p.y);
        for (let d = (time * .07) % 17; d < distance; d += 17) { const u = d / distance; rope.fillStyle(0xfff1b9).fillCircle(p.x + (t.x - p.x) * u, p.y + (t.y - p.y) * u, 1.5); }
        rope.lineStyle(2, 0xffad4f).strokeCircle(t.x, t.y, t.r + 7);
        rope.fillStyle(0xffe4a4).fillCircle(t.x, t.y, 4);
      } else if (this.hover && sim.phase === 'playing') {
        const b = sim.pick(this.hover.x, this.hover.y);
        if (b) { rope.lineStyle(2, sim.canReach(b) ? C.blue : 0xbc7460, .75).strokeCircle(b.x, b.y, b.r + 7); }
      }
      if (sim.moves === 0 && sim.phase === 'playing') {
        const b = sim.bodies.find(b => b.kind === (sim.levelIndex === 2 ? 'anchor' : sim.levelIndex === 1 ? 'heavy' : 'light'))!;
        const r = b.r + 10 + Math.sin(time / 350) * 3; rope.lineStyle(2, sim.levelIndex === 2 ? C.blue : 0xda9c45, .5).strokeCircle(b.x, b.y, r);
      }
      while (sim.events.length) onEvent(sim.events.shift()!);
      if (time - this.lastPublish > 80 || sim.phase !== this.lastPhase) { publish(sim.snapshot()); this.lastPublish = time; this.lastPhase = sim.phase; }
    }
  }
  return new Phaser.Game({ type: Phaser.AUTO, parent, width: BOARD.width, height: BOARD.height, backgroundColor: '#e9e5d9', transparent: false, antialias: true, roundPixels: false, scene: HookScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, pixelArt: false }, banner: false, callbacks: { postBoot: game => { game.events.once('destroy', () => disposeInput()); } } });
}
