export const BOARD = { width: 440, height: 580 };
export type Kind = 'robot' | 'light' | 'heavy' | 'anchor';
export type Body = { id: string; kind: Kind; x: number; y: number; vx: number; vy: number; r: number; mass: number; required: boolean };
export type Rect = { x: number; y: number; w: number; h: number };
type Spawn = { id: string; kind: Kind; x: number; y: number; required?: boolean };
export type Level = { title: string; subtitle: string; hint: string; dock: Rect; walls: Rect[]; spawns: Spawn[]; plate?: { x: number; y: number; r: number }; gate?: Rect };
const anchors = (points: number[][]): Spawn[] => points.map(([x, y], i) => ({ id: `a${i}`, kind: 'anchor', x, y }));
export const LEVELS: Level[] = [
  { title: '第一份委托', subtitle: '先把小箱子拉进装货区', hint: '按住箱子牵引 · 松手停下', dock: { x: 142, y: 385, w: 156, h: 150 }, walls: [],
    spawns: [{ id: 'robot', kind: 'robot', x: 220, y: 495 }, { id: 'box', kind: 'light', x: 220, y: 265, required: true }, ...anchors([[65, 90], [375, 90], [65, 290], [375, 290], [65, 520], [375, 520]])] },
  { title: '换个角度', subtitle: '绕到箱子另一侧，把两件货送到下方', hint: '按住蓝色固定点移动自己，再拉货物', dock: { x: 70, y: 415, w: 330, h: 135 }, walls: [{ x: 188, y: 150, w: 65, h: 205 }],
    spawns: [{ id: 'robot', kind: 'robot', x: 340, y: 530 }, { id: 'box', kind: 'light', x: 95, y: 175, required: true }, { id: 'heavy', kind: 'heavy', x: 340, y: 420, required: true }, ...anchors([[70, 75], [365, 75], [70, 340], [365, 330], [92, 552], [400, 552]])] },
  { title: '先用，后搬', subtitle: '重箱压住圆盘开门，也可以走右侧绕路', hint: '货物也是工具：先压门，最后一起装车', dock: { x: 45, y: 416, w: 350, h: 134 }, walls: [{ x: 18, y: 245, w: 157, h: 24 }, { x: 265, y: 245, w: 45, h: 24 }], plate: { x: 140, y: 410, r: 34 }, gate: { x: 175, y: 245, w: 90, h: 24 },
    spawns: [{ id: 'robot', kind: 'robot', x: 285, y: 510 }, { id: 'box', kind: 'light', x: 220, y: 140, required: true }, { id: 'heavy', kind: 'heavy', x: 140, y: 440, required: true }, ...anchors([[65, 80], [370, 90], [140, 335], [370, 350], [92, 555], [240, 555], [400, 535], [225, 350]])] },
];
export type HookSnapshot = { levelIndex: number; title: string; subtitle: string; hint: string; total: number; delivered: number; moves: number; phase: 'playing' | 'paused' | 'won'; canShip: boolean; canUndo: boolean; gateOpen: boolean; notice: string };
type Checkpoint = { bodies: Body[]; moves: number; gateOpen: boolean; time: number };
const edges: Rect[] = [{ x: 0, y: 0, w: 440, h: 18 }, { x: 0, y: 562, w: 440, h: 18 }, { x: 0, y: 0, w: 18, h: 580 }, { x: 422, y: 0, w: 18, h: 580 }];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const copy = (bodies: Body[]) => bodies.map(b => ({ ...b }));
export function intersectsSegment(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  let lo = 0, hi = 1;
  for (const [a, d, min, max] of [[ax, bx - ax, r.x, r.x + r.w], [ay, by - ay, r.y, r.y + r.h]]) {
    if (Math.abs(d) < .0001) { if (a < min || a > max) return false; continue; }
    const t1 = (min - a) / d, t2 = (max - a) / d;
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi) return false;
  }
  return true;
}
function circleTouches(b: Body, r: Rect, margin = 0) {
  return Math.hypot(b.x - clamp(b.x, r.x, r.x + r.w), b.y - clamp(b.y, r.y, r.y + r.h)) < b.r + margin;
}

export class HookGame {
  levelIndex = 0;
  bodies: Body[] = [];
  phase: HookSnapshot['phase'] = 'playing';
  targetId: string | null = null;
  moves = 0;
  time = 0;
  gateOpen = false;
  plateActive = false;
  notice = '';
  history: Checkpoint[] = [];
  events: string[] = [];
  private accumulator = 0;
  private noticeTime = 0;
  private undoFrozen = false;
  private dockCount = 0;
  private bumpCooldown = 0;
  constructor() { this.loadLevel(0); }
  get level() { return LEVELS[this.levelIndex]; }
  get robot() { return this.bodies[0]; }
  get target() { return this.bodies.find(b => b.id === this.targetId); }
  get solids() { return [...edges, ...this.level.walls, ...(this.level.gate && !this.gateOpen ? [this.level.gate] : [])]; }
  loadLevel(index: number) {
    this.levelIndex = clamp(Math.trunc(index) || 0, 0, LEVELS.length - 1);
    this.bodies = this.level.spawns.map(s => ({ ...s, vx: 0, vy: 0, required: !!s.required, r: s.kind === 'robot' ? 17 : s.kind === 'anchor' ? 11 : s.kind === 'heavy' ? 24 : 20, mass: s.kind === 'anchor' ? Infinity : s.kind === 'robot' ? 1.6 : s.kind === 'heavy' ? 2.6 : .24 }));
    this.phase = 'playing'; this.moves = 0; this.time = 0; this.targetId = null; this.gateOpen = false; this.plateActive = false; this.history = []; this.events = []; this.notice = ''; this.noticeTime = 0; this.accumulator = 0; this.undoFrozen = false; this.dockCount = this.delivered().length; this.bumpCooldown = 0;
  }
  restart() { this.loadLevel(this.levelIndex); }
  say(message: string) { this.notice = message; this.noticeTime = 2.6; }
  delivered() {
    const d = this.level.dock;
    return this.bodies.filter(b => b.required && b.x - b.r >= d.x - .5 && b.x + b.r <= d.x + d.w + .5 && b.y - b.r >= d.y - .5 && b.y + b.r <= d.y + d.h + .5 && Math.hypot(b.vx, b.vy) < 9);
  }
  snapshot(): HookSnapshot {
    const total = this.bodies.filter(b => b.required).length, delivered = this.delivered().length;
    return { levelIndex: this.levelIndex, title: this.level.title, subtitle: this.level.subtitle, hint: this.level.hint, total, delivered, moves: this.moves, phase: this.phase, canShip: this.phase === 'playing' && delivered === total && !this.targetId, canUndo: this.history.length > 0 && this.phase !== 'won', gateOpen: this.gateOpen, notice: this.notice };
  }
  canReach(b: Body) {
    const p = this.robot;
    if (Math.hypot(p.x - b.x, p.y - b.y) > 560) return false;
    if (this.solids.some(r => intersectsSegment(p.x, p.y, b.x, b.y, r))) return false;
    const dx = b.x - p.x, dy = b.y - p.y, len2 = dx * dx + dy * dy;
    return !this.bodies.some(other => {
      if (other.id === b.id || other.kind === 'robot' || other.kind === 'anchor' || len2 === 0) return false;
      const t = ((other.x - p.x) * dx + (other.y - p.y) * dy) / len2;
      return t > 0 && t < 1 && Math.hypot(other.x - p.x - dx * t, other.y - p.y - dy * t) < other.r - 2;
    });
  }
  pick(x: number, y: number) {
    return this.bodies.filter(b => b.kind !== 'robot' && Math.hypot(b.x - x, b.y - y) <= b.r + 13).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  }
  beginPull(x: number, y: number) {
    if (this.phase !== 'playing' || this.targetId) return false;
    const b = this.pick(x, y);
    if (!b) { this.say('按住箱子或蓝色固定点'); return false; }
    if (!this.canReach(b)) { this.say('这里被挡住了，先换个固定点'); return false; }
    if (Math.hypot(b.x - this.robot.x, b.y - this.robot.y) < b.r + this.robot.r + 5) { this.say('已经靠近了，换个固定点调整方向'); return false; }
    this.history.push({ bodies: copy(this.bodies), moves: this.moves, gateOpen: this.gateOpen, time: this.time });
    this.targetId = b.id; this.moves++; this.undoFrozen = false; this.events.push('hook');
    this.notice = ''; this.noticeTime = 0;
    return true;
  }
  endPull() { this.targetId = null; }
  pause() { this.endPull(); if (this.phase === 'playing') this.phase = 'paused'; this.accumulator = 0; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; this.endPull(); this.accumulator = 0; }
  undo() {
    if (this.phase === 'won') return false;
    const previous = this.history.pop(); if (!previous) return false;
    this.bodies = copy(previous.bodies); this.moves = previous.moves; this.gateOpen = previous.gateOpen; this.time = previous.time; this.targetId = null; this.accumulator = 0; this.undoFrozen = true; this.events = []; this.updateGate(); this.dockCount = this.delivered().length; this.say('已撤销这一钩'); return true;
  }
  ship() {
    if (!this.snapshot().canShip) return false;
    this.phase = 'won'; this.endPull(); this.events.push('win'); return true;
  }
  update(dt: number) {
    if (this.phase !== 'playing') return;
    const elapsed = clamp(dt, 0, .1);
    this.noticeTime = Math.max(0, this.noticeTime - elapsed); if (!this.noticeTime) this.notice = '';
    if (this.undoFrozen) return;
    this.accumulator += elapsed;
    while (this.accumulator >= 1 / 120) { this.tick(1 / 120); this.accumulator -= 1 / 120; }
  }
  private updateGate() {
    const plate = this.level.plate, gate = this.level.gate;
    if (!plate || !gate) return;
    this.plateActive = this.bodies.some(b => b.kind === 'heavy' && Math.hypot(b.x - plate.x, b.y - plate.y) <= 20);
    const occupied = this.bodies.some(b => b.kind !== 'anchor' && circleTouches(b, gate, 3));
    const open = this.plateActive || (this.gateOpen && occupied);
    if (open !== this.gateOpen) { this.gateOpen = open; this.events.push('gate'); if (open) this.say('门开了！先搬出里面的小箱子'); }
  }
  private tick(dt: number) {
    this.time += dt; this.bumpCooldown = Math.max(0, this.bumpCooldown - dt); this.updateGate();
    const p = this.robot, t = this.target;
    if (t) {
      if (!this.canReach(t)) { this.endPull(); this.say('钩索被挡住，松开后重新选目标'); }
      else {
        const dx = t.x - p.x, dy = t.y - p.y, distance = Math.hypot(dx, dy), gap = distance - p.r - t.r - 5;
        if (gap <= 1.5) { this.endPull(); p.vx = p.vy = 0; if (t.kind !== 'anchor') t.vx = t.vy = 0; }
        else {
          const speed = Math.min(t.kind === 'anchor' ? 310 : 230, gap * 7);
          const a = 1 / p.mass, b = 1 / t.mass, f = 1 - Math.exp(-19 * dt);
          p.vx += (dx / distance * speed * a / (a + b) - p.vx) * f;
          p.vy += (dy / distance * speed * a / (a + b) - p.vy) * f;
          if (t.kind !== 'anchor') { t.vx += (-dx / distance * speed * b / (a + b) - t.vx) * f; t.vy += (-dy / distance * speed * b / (a + b) - t.vy) * f; }
        }
      }
    }
    for (const b of this.bodies) {
      if (b.kind === 'anchor') continue;
      if (!this.targetId || (b.id !== this.targetId && b.kind !== 'robot')) {
        const d = this.level.dock, inDock = b.x > d.x && b.x < d.x + d.w && b.y > d.y && b.y < d.y + d.h;
        const drag = Math.exp(-(inDock ? 12 : 9) * dt); b.vx *= drag; b.vy *= drag;
      }
      if (Math.abs(b.vx) < .08) b.vx = 0; if (Math.abs(b.vy) < .08) b.vy = 0;
      b.x += b.vx * dt; b.y += b.vy * dt;
      for (const wall of this.solids) this.collideWall(b, wall);
    }
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
      const a = this.bodies[i], b = this.bodies[j];
      // Floor-mounted anchors are hooks, not physical posts.
      if (a.kind === 'anchor' || b.kind === 'anchor') continue;
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), overlap = a.r + b.r - dist;
      if (overlap <= 0) continue;
      const nx = dist > .001 ? dx / dist : 1, ny = dist > .001 ? dy / dist : 0, ia = 1 / a.mass, ib = 1 / b.mass;
      a.x -= nx * overlap * ia / (ia + ib); a.y -= ny * overlap * ia / (ia + ib); b.x += nx * overlap * ib / (ia + ib); b.y += ny * overlap * ib / (ia + ib);
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing < 0) { const impulse = -(1.1 * closing) / (ia + ib); a.vx -= impulse * ia * nx; a.vy -= impulse * ia * ny; b.vx += impulse * ib * nx; b.vy += impulse * ib * ny; this.bump(-closing); }
    }
    for (const b of this.bodies) if (b.kind !== 'anchor') for (const wall of this.solids) this.collideWall(b, wall);
    this.updateGate();
    const delivered = this.delivered().length;
    if (delivered > this.dockCount) this.events.push('dock'); this.dockCount = delivered;
  }
  private bump(speed: number) { if (speed > 55 && !this.bumpCooldown) { this.events.push('bump'); this.bumpCooldown = .18; } }
  private collideWall(b: Body, w: Rect) {
    const qx = clamp(b.x, w.x, w.x + w.w), qy = clamp(b.y, w.y, w.y + w.h), dx = b.x - qx, dy = b.y - qy, distance = Math.hypot(dx, dy);
    if (distance >= b.r) return;
    let nx: number, ny: number, depth: number;
    if (distance > .001) { nx = dx / distance; ny = dy / distance; depth = b.r - distance; }
    else {
      const options = [{ d: b.x - w.x, nx: -1, ny: 0 }, { d: w.x + w.w - b.x, nx: 1, ny: 0 }, { d: b.y - w.y, nx: 0, ny: -1 }, { d: w.y + w.h - b.y, nx: 0, ny: 1 }];
      const side = options.sort((a, c) => a.d - c.d)[0]; nx = side.nx; ny = side.ny; depth = b.r + side.d;
    }
    b.x += nx * depth; b.y += ny * depth;
    const into = b.vx * nx + b.vy * ny;
    if (into < 0) { b.vx -= into * nx; b.vy -= into * ny; this.bump(-into); }
  }
}
