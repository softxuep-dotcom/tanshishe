export type Role = 'chen' | 'tuo' | 'man';
export type Kind = Role | 'punk' | 'runner' | 'tank' | 'boss' | 'slinger' | 'longleg';
export type Action = 'attack' | 'jump' | 'throw' | 'special';
export type EnemyKind = Exclude<Kind, Role>;
export const isBoss = (kind: Kind) => kind === 'boss' || kind === 'longleg';
export const enemyHealth = (kind: Kind) => isBoss(kind) ? 330 : kind === 'tank' ? 86 : kind === 'runner' || kind === 'slinger' ? 42 : 52;
export interface Crate { id: number; x: number; y: number; snack: boolean; }
export interface Shot { x: number; y: number; vx: number; life: number; crate: boolean; snack: boolean; }
export interface Snack { x: number; y: number; }
export const HEROES = {
  chen: { name: '陈野', title: '街头拳手', detail: '连拳 · 上勾拳 · 均衡', speed: 86, damage: 14, color: 0xf1ba63 },
  tuo: { name: '阿拓', title: '修车铺的大块头', detail: '重拳 · 远投 · 强壮', speed: 67, damage: 19, color: 0x65cbb1 },
  man: { name: '小满', title: '夜市快腿', detail: '快踢 · 飞踢 · 灵活', speed: 107, damage: 11, color: 0xdf7f9c },
};
export interface Fighter { id: number; kind: Kind; x: number; y: number; hp: number; max: number; face: number; timer: number; stun: number; inv: number; pose: string; poseTime: number; jump: number; vx: number; wind: number; charge: number; dead: number; }
export interface Spark { x: number; y: number; life: number; text: string; }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export class StreetGame {
  chapter: 0 | 1 = 0; crates: Crate[] = []; carried: Crate | null = null; shots: Shot[] = []; snacks: Snack[] = [];
  get chapterName() { return this.chapter === 0 ? '南桥夜市' : '河边货场'; }
  get bossName() { return this.chapter === 0 ? '铁头' : '长腿'; }
  nextChapter() { if (this.phase === 'won' && this.chapter === 0 && !this.training) this.start(this.role, 1); }
  restockCrates() {
    this.carried = null; this.shots = []; this.snacks = [];
    const x = Math.min(this.wave, 2) * 410;
    this.crates = this.chapter === 1 || this.training ? [
      { id: ++this.serial, x: x + 143, y: 211, snack: true },
      { id: ++this.serial, x: x + 194, y: 173, snack: false },
    ] : [];
  }
  dropCrate() { if (this.carried) { this.carried.x = clamp(this.hero.x + this.hero.face * 25, Math.min(this.wave, 2) * 410 + 20, (this.wave === 0 ? 455 : this.wave === 1 ? 865 : 1300) - 20); this.carried.y = this.hero.y; this.crates.push(this.carried); this.carried = null; } }
  training = false; godMode = false; freezeEnemies = false; showRanges = false;
  trainingEnemy: EnemyKind = 'punk'; trainingCount = 1;
  startTraining(role: Role, kind: EnemyKind = 'punk', count = 1) {
    this.start(role); this.training = true; this.phase = 'playing'; this.godMode = true;
    this.setTrainingOpponents(kind, count);
  }
  setTrainingOpponents(kind: EnemyKind, count: number) {
    if (!this.training) return;
    this.strike = null; this.chainTime = 0;
    this.trainingEnemy = kind; this.trainingCount = Math.max(1, Math.min(4, Math.floor(count) || 1));
    this.enemies = Array.from({ length: this.trainingCount }, (_, i) => this.fighter(kind, 255 + i * 42, 177 + i % 3 * 24, enemyHealth(kind)));
    this.restockCrates();
    this.sparks = []; this.events = []; this.combo = 0; this.comboTime = 0; this.kills = 0; this.hitstop = 0; this.shake = 0; this.clearInput();
  }
  resetTraining() {
    if (!this.training) return;
    const { role, trainingEnemy, trainingCount, godMode, freezeEnemies, showRanges } = this;
    this.startTraining(role, trainingEnemy, trainingCount);
    this.godMode = godMode; this.freezeEnemies = freezeEnemies; this.showRanges = showRanges;
  }
  phase: 'select' | 'intro' | 'playing' | 'bossIntro' | 'won' | 'lost' = 'select';
  paused = false; role: Role = 'chen'; hero: Fighter; enemies: Fighter[] = []; sparks: Spark[] = [];
  time = 0; camera = 0; wave = 0; kills = 0; rage = 50; combo = 0; comboTime = 0; hitstop = 0; shake = 0;
  mx = 0; my = 0; held = false; serial = 0; attackStep = 0; events: string[] = []; food = false;
  sprint = false;
  private buffered: { action: Action; remaining: number } | null = null;
  private strike: { delay: number; face: number; reach: number; damage: number; knockback: number } | null = null;
  private chainTime = 0;
  get windingUp() { return this.strike !== null; }
  get running() { return this.sprint && Math.abs(this.mx) > .5 && !this.carried && !this.hero.jump && !this.hero.stun && !this.hero.timer; }
  get grabTarget() {
    const p = this.hero;
    if (p.jump || p.stun || this.carried) return undefined;
    return this.enemies.filter(e => e.hp > 0 && !isBoss(e.kind) && Math.abs(e.y - p.y) < 25 && Math.abs(e.x - p.x) < (this.role === 'tuo' ? 43 : 35))
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  }
  requestAction(action: Action) {
    if (this.phase !== 'playing' || this.paused) return;
    if (this.hero.timer > 0 || this.hero.stun > 0 || this.hitstop > 0) {
      this.buffered = { action, remaining: .18 };
    } else this.action(action);
  }
  constructor() { this.hero = this.fighter('chen', 85, 199, 150); }
  fighter(kind: Kind, x: number, y: number, hp: number): Fighter { return { id: ++this.serial, kind, x, y, hp, max: hp, face: 1, timer: .8, stun: 0, inv: 0, pose: 'idle', poseTime: 0, jump: 0, vx: 0, wind: 0, charge: 0, dead: 0 }; }
  start(role: Role, chapter: 0 | 1 = 0) {
    this.strike = null; this.chainTime = 0;
    this.chapter = chapter; this.crates = []; this.carried = null; this.shots = []; this.snacks = [];
    this.training = false; this.godMode = false; this.freezeEnemies = false; this.showRanges = false; this.events = [];
    this.role = role; this.hero = this.fighter(role, 85, 199, role === 'tuo' ? 180 : 150); this.hero.timer = 0;
    this.enemies = []; this.sparks = []; this.phase = 'intro'; this.paused = false; this.time = 0; this.camera = 0; this.wave = 0;
    this.kills = 0; this.rage = 50; this.combo = 0; this.comboTime = 0; this.hitstop = 0; this.shake = 0; this.attackStep = 0; this.food = false; this.clearInput();
  }
  clearInput() { this.mx = 0; this.my = 0; this.held = false; this.sprint = false; this.buffered = null; }
  proceed() { if (this.phase === 'intro') { this.phase = 'playing'; this.spawn(); } else if (this.phase === 'bossIntro') { this.phase = 'playing'; this.enemies.push(this.fighter(this.chapter === 1 ? 'longleg' : 'boss', 1215, 197, 330)); if (this.chapter === 1) { this.restockCrates(); this.crates.forEach(c => c.x += 140); } } }
  spawn() {
    const x = this.wave * 410;
    const kinds: Kind[][] = this.chapter === 1 ? [['punk', 'slinger', 'runner'], ['tank', 'slinger', 'punk', 'slinger'], ['runner', 'tank', 'slinger', 'punk']] : [['punk', 'punk', 'runner'], ['punk', 'runner', 'tank', 'punk'], ['runner', 'tank', 'punk']];
    (kinds[this.wave] || []).forEach((k, i) => this.enemies.push(this.fighter(k, x + 230 + i * 49, 174 + (i % 3) * 26, enemyHealth(k))));
    this.restockCrates();
  }
  action(a: Action, fresh = true) {
    if (this.phase !== 'playing' || this.paused) return;
    const p = this.hero;
    if (p.stun > 0 || p.timer > 0) return;
    if (this.carried) {
      if (a === 'attack') {
        this.shots.push({ x: p.x + p.face * 20, y: p.y, vx: p.face * 250, life: 1.3, crate: true, snack: this.carried.snack });
        this.carried = null; p.timer = .45; p.pose = 'throw'; p.poseTime = .4; this.events.push('throw'); return;
      }
      if (a === 'throw') { this.dropCrate(); p.timer = .25; return; }
      if (a === 'jump') return;
      if (a === 'special') this.dropCrate();
    }
    if (a === 'jump') { if (p.jump <= 0) { p.jump = .7; p.pose = 'jump'; p.poseTime = .7; this.events.push('jump'); } return; }
    const dash = a === 'attack' && fresh && this.running;
    if (Math.abs(this.mx) > .2) p.face = Math.sign(this.mx);
    const nearby = this.enemies.filter(e => e.hp > 0 && Math.abs(e.y - p.y) < 25 && Math.abs(e.x - p.x) < 52).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    // Aim assist helps standing attacks, but never overrides deliberate movement.
    if (!dash && Math.abs(this.mx) <= .2 && nearby[0]) p.face = nearby[0].x >= p.x ? 1 : -1;
    if (a === 'special') {
      if (this.rage < 50) { this.sparks.push({ x: p.x, y: p.y - 63, life: .6, text: '怒气不足' }); return; }
      this.rage -= 50; p.inv = .8; p.timer = .7; p.pose = 'special'; p.poseTime = .65;
      for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.x - p.x) < 108 && Math.abs(e.y - p.y) < 49) this.hit(e, 40, (e.x >= p.x ? 1 : -1) * 250);
      this.shake = .3; this.events.push('special'); return;
    }
    if (a === 'throw') {
      if (p.jump > 0) return;
      const e = this.grabTarget;
      if (!e) {
        const c = this.crates.filter(c => Math.abs(c.x - p.x) < 35 && Math.abs(c.y - p.y) < 23).sort((a,b) => Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
        if (c && !p.jump) { this.carried = c; this.crates = this.crates.filter(o => o !== c); p.timer = .2; this.events.push('heal'); }
        else this.sparks.push({ x: p.x, y: p.y - 65, life: .65, text: '靠近小兵或木箱' }); return;
      }
      p.face = Math.abs(this.mx) > .2 ? Math.sign(this.mx) : (e.x >= p.x ? 1 : -1);
      p.timer = .36; p.inv = Math.max(p.inv, .22);
      p.pose = 'throw'; p.poseTime = .36; this.hit(e, this.role === 'tuo' ? 42 : 29, p.face * 350); e.pose = 'thrown'; e.poseTime = .7; e.stun = .75;
      for (const other of this.enemies) if (other !== e && other.hp > 0 && (other.x - e.x) * p.face > 0 && Math.abs(other.x - e.x) < 130 && Math.abs(other.y - e.y) < 30) this.hit(other, 25, p.face * 185);
      this.events.push('throw'); return;
    }
    this.attackStep = this.chainTime > 0 ? (this.attackStep + 1) % 3 : 0;
    this.chainTime = .65;
    const heavy = dash || this.attackStep === 2 || p.jump > 0;
    p.pose = dash ? 'dash' : p.jump > 0 ? 'kick' : this.attackStep === 2 ? 'uppercut' : 'punch';
    p.timer = dash ? .43 : this.role === 'man' ? .22 : this.role === 'tuo' ? .34 : .27;
    p.poseTime = p.timer;
    if (dash) p.vx = p.face * 240;
    this.strike = { delay: dash ? .065 : .05, face: p.face, reach: dash ? 65 : p.jump > 0 ? 63 : 48,
      damage: HEROES[this.role].damage * (heavy ? 1.6 : 1), knockback: dash ? 220 : this.attackStep === 2 ? 185 : 38 };
    this.events.push('swing');
  }
  private resolveStrike() {
    const strike = this.strike;
    if (!strike) return;
    this.strike = null;
    const p = this.hero;
    let landed = false;
    for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.y - p.y) < 23 && (e.x - p.x) * strike.face > -9 && (e.x - p.x) * strike.face < strike.reach) {
      this.hit(e, strike.damage, strike.face * strike.knockback); landed = true;
    }
    if (landed && strike.knockback > 100) this.events.push('heavy');
  }
  hit(e: Fighter, damage: number, velocity: number) {
    if (e.hp <= 0) return;
    e.hp = Math.max(0, e.hp - damage); e.stun = isBoss(e.kind) ? .16 : .3; e.wind = 0; e.charge = 0; e.vx = velocity; e.pose = 'hurt'; e.poseTime = .22;
    this.combo++; this.comboTime = 2; this.rage = Math.min(100, this.rage + 5);
    this.hitstop = Math.max(this.hitstop, Math.abs(velocity) > 100 ? .075 : .035);
    this.shake = Math.max(this.shake, Math.abs(velocity) > 100 ? .16 : .065);
    this.sparks.push({ x: e.x, y: e.y - 28, life: .33, text: String(Math.round(damage)) }); this.events.push('hit');
    if (!e.hp) { e.dead = .65; this.kills++; this.rage = Math.min(100, this.rage + 5); }
  }
  hurt(damage: number, face: number) {
    const p = this.hero; if ((this.training && this.godMode) || p.inv > 0 || p.jump > .12) return;
    this.dropCrate();
    this.strike = null; this.buffered = null; this.chainTime = 0;
    p.hp = Math.max(0, p.hp - damage); p.inv = .85; p.stun = .28; p.vx = face * 115; p.pose = 'hurt'; p.poseTime = .3;
    this.combo = 0; this.shake = .2; this.events.push('hurt'); if (!p.hp) { this.phase = 'lost'; this.clearInput(); }
  }
  update(delta: number) {
    if (this.phase !== 'playing' || this.paused) return;
    const dt = Math.min(delta, .035); this.time += dt; this.shake = Math.max(0, this.shake - dt);
    this.sparks = this.sparks.filter(s => (s.life -= dt) > 0);
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.chainTime = Math.max(0, this.chainTime - dt);
    if (this.buffered) { this.buffered.remaining -= dt; if (this.buffered.remaining <= 0) this.buffered = null; }
    this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.combo = 0;
    for (const f of [this.hero, ...this.enemies]) {
      f.timer = Math.max(0, f.timer - dt); f.stun = Math.max(0, f.stun - dt); f.inv = Math.max(0, f.inv - dt); f.jump = Math.max(0, f.jump - dt);
      f.poseTime = Math.max(0, f.poseTime - dt); if (!f.poseTime) f.pose = 'idle';
      f.x += f.vx * dt; f.vx *= Math.exp(-7 * dt); f.dead = Math.max(0, f.dead - dt);
    }
    const p = this.hero; const alive = this.enemies.filter(e => e.hp > 0);
    if (this.strike) { this.strike.delay -= dt; if (this.strike.delay <= 0) this.resolveStrike(); }
    if (!p.stun) {
      const len = Math.max(1, Math.hypot(this.mx, this.my));
      const movement = p.timer > 0 ? (p.jump > 0 ? .8 : .25) : 1;
      p.x += this.mx / len * HEROES[this.role].speed * dt * movement * (this.running ? 1.65 : 1) * (this.carried ? .75 : 1);
      p.y += this.my / len * 61 * dt * movement;
      if (this.mx && p.timer <= 0) p.face = this.mx > 0 ? 1 : -1;
      if (this.buffered && p.timer <= 0) { const input = this.buffered; this.buffered = null; this.action(input.action); }
      else if (this.held) this.action('attack', false);
    }
    const right = this.wave === 0 ? 455 : this.wave === 1 ? 865 : 1300;
    const left = Math.min(this.wave, 2) * 410;
    p.x = clamp(p.x, left + 22, right - 20); p.y = clamp(p.y, 157, 243);
    this.camera = clamp(p.x - 170, left, Math.max(left, right - 480 + 45));
    for (const shot of this.shots) {
      const previousX = shot.x; shot.x += shot.vx * dt; shot.life -= dt;
      const crosses = (x: number, y: number, radius: number) => Math.abs(y - shot.y) < radius && x >= Math.min(previousX, shot.x) - 14 && x <= Math.max(previousX, shot.x) + 14;
      if (shot.crate) {
        const targets = alive.filter(e => e.hp > 0 && crosses(e.x, e.y, 25));
        if (targets.length) {
          const impact = targets.sort((a,b) => Math.abs(a.x-previousX)-Math.abs(b.x-previousX))[0];
          for (const e of alive) if (e.hp > 0 && Math.abs(e.x-impact.x) < 55 && Math.abs(e.y-shot.y) < 30) this.hit(e, 36, Math.sign(shot.vx) * 170);
          shot.x = impact.x; shot.life = 0;
        }
      } else {
        const blocker = this.crates.find(c => crosses(c.x,c.y,23));
        if (blocker) { shot.life = 0; this.sparks.push({ x: blocker.x, y: blocker.y-28, text:'挡住了',life:.5 }); }
        else if (crosses(p.x,p.y,18)) { this.hurt(12,Math.sign(shot.vx)); shot.life = 0; }
      }
      if (shot.x < left + 10 || shot.x > right - 10) shot.life = 0;
      if (shot.crate && shot.life <= 0) {
        const x = clamp(shot.x,left+25,right-25); this.sparks.push({ x, y:shot.y-22, text:'木箱碎裂',life:.6 }); this.events.push('throw');
        if (shot.snack) this.snacks.push({ x, y:shot.y });
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
    this.snacks = this.snacks.filter(s => { if (Math.abs(s.x-p.x) < 22 && Math.abs(s.y-p.y) < 20) { p.hp = Math.min(p.max,p.hp+30); this.events.push('heal'); this.sparks.push({x:p.x,y:p.y-50,text:'+30 补给',life:.8}); return false; } return true; });
    for (const e of alive) {
      if (e.hp <= 0) continue;
      e.x = clamp(e.x, left + 15, right - 15); e.y = clamp(e.y, 156, 242);
      if (e.stun > 0 || (this.training && this.freezeEnemies)) continue;
      if (e.charge > 0) { e.charge -= dt; e.x += e.face * 230 * dt; if (Math.abs(e.x - p.x) < 27 && Math.abs(e.y - p.y) < 24) this.hurt(23, e.face); if (e.charge <= 0) { e.stun = 1.2; e.pose = 'hurt'; e.poseTime = 1.2; } continue; }
      if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) {
        if (e.kind === 'boss') { e.charge = .68; e.pose = 'charge'; e.poseTime = .68; }
        else if (e.kind === 'slinger') { this.shots.push({x:e.x+e.face*18,y:e.y,vx:e.face*170,life:2.5,crate:false,snack:false}); e.pose='throw'; e.poseTime=.3; }
        else if (e.kind === 'longleg') { e.pose='kick'; e.poseTime=.55; e.stun=.85; if ((p.x-e.x)*e.face > -8 && (p.x-e.x)*e.face < 105 && Math.abs(e.y-p.y)<24) this.hurt(24,e.face); }
        else { e.pose = 'punch'; e.poseTime = .23; if (Math.abs(e.x - p.x) < 43 && Math.abs(e.y - p.y) < 22) this.hurt(e.kind === 'tank' ? 18 : 10, e.face); }
      } continue; }
      const dx = p.x - e.x, dy = p.y - e.y; e.face = dx >= 0 ? 1 : -1;
      const attackers = alive.filter(o => o !== e && (o.wind > 0 || o.charge > 0)).length;
      if (Math.abs(dx) < (e.kind === 'slinger' ? 300 : e.kind === 'longleg' ? 102 : e.kind === 'boss' ? 160 : 33) && Math.abs(dy) < 16 && !e.timer && attackers < 2) {
        e.wind = e.kind === 'slinger' ? .9 : isBoss(e.kind) ? .8 : e.kind === 'runner' ? .42 : .62; e.timer = isBoss(e.kind) || e.kind === 'slinger' ? 2.5 : 1.5; e.pose = 'wind'; e.poseTime = e.wind; continue;
      }
      if (e.kind === 'slinger') { if (Math.abs(dx)<115) e.x-=Math.sign(dx)*42*dt; else if (Math.abs(dx)>200) e.x+=Math.sign(dx)*30*dt; if (Math.abs(dy)>6) e.y+=Math.sign(dy)*24*dt; continue; }
      const targetY = p.y + (e.id % 2 ? 7 : -7); const speed = e.kind === 'runner' ? 58 : e.kind === 'tank' ? 27 : 38;
      if (Math.abs(dx) > (e.kind === 'longleg' ? 70 : 29)) e.x += Math.sign(dx) * (e.kind === 'longleg' ? 58 : speed) * dt;
      if (Math.abs(targetY - e.y) > 4) e.y += Math.sign(targetY - e.y) * 29 * dt;
      for (const o of alive) if (o.id < e.id && Math.abs(o.x - e.x) < 21 && Math.abs(o.y - e.y) < 12) e.y += (e.id % 2 ? 1 : -1) * 23 * dt;
    }
    if (this.food && Math.abs(p.x - 768) < 25 && Math.abs(p.y - 208) < 23) { p.hp = Math.min(p.max, p.hp + 45); this.food = false; this.sparks.push({ x: p.x, y: p.y - 50, life: 1, text: '+45 热包子' }); this.events.push('heal'); }
    if (!this.training && !alive.length && this.enemies.every(e => !e.dead)) {
      if (this.wave === 3) { this.phase = 'won'; this.clearInput(); }
      else if (p.x > right - 60) { this.wave++; this.enemies = []; if (this.wave === 3) { this.wave = 2; this.phase = 'bossIntro'; this.clearInput(); /* boss shares the final street */ this.wave = 3; p.x = 1130; this.camera = 880; } else { this.spawn(); if (this.wave === 1) this.food = true; } }
    }
  }
}
