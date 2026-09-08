export const WORLD = { width: 440, height: 660, gateLeft: 184, gateRight: 256, goal: 6, duration: 120 };
export interface Pose { x: number; y: number; angle: number }
export interface Cargo extends Pose { id: number; gold: boolean; cooldown: number; stress: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Controls { left: boolean; right: boolean; brake: boolean; heading?: number | null; boost?: boolean }
export interface Rival extends Pose { id: number; waypoint: number; path: number[][]; disabled: number; speed: number }
export type Phase = 'ready' | 'playing' | 'paused' | 'exiting' | 'won' | 'lost';
export interface RunSnapshot { phase: Phase; remaining: number; count: number; value: number; score: number; multiplier: number; toast: string; toastId: number; fuel: number; boosting: boolean; combo: number; comboTime: number; steals: number }
export interface RunEvent { kind: 'pickup' | 'drop' | 'bump' | 'win' | 'steal'; x: number; y: number; gold?: boolean }
export const SHELVES: Rect[] = [
  { x: 135, y: 157, w: 52, h: 117 }, { x: 275, y: 157, w: 54, h: 98 },
  { x: 135, y: 363, w: 52, h: 104 }, { x: 271, y: 354, w: 58, h: 113 },
];
const points = [[78,500],[78,427],[78,338],[78,250],[78,163],[142,98],[218,98],[298,98],[371,164],[371,248],[371,327],[371,427],[371,536],[289,555],[213,555],[220,423],[220,306],[219,204]];
export function circleRect(x: number, y: number, radius: number, rect: Rect): boolean {
  return Math.hypot(x - Math.max(rect.x, Math.min(x, rect.x + rect.w)), y - Math.max(rect.y, Math.min(y, rect.y + rect.h))) < radius;
}
export class CargoRun {
  phase: Phase = 'ready'; resumePhase: Phase = 'playing';
  head: Pose = { x: 78, y: 576, angle: -Math.PI / 2 };
  cargo: Cargo[] = []; loose: Cargo[] = [];
  remaining = WORLD.duration; elapsed = 0; toast = ''; toastTime = 0; toastId = 0; bumpTime = 0;
  events: RunEvent[] = []; delivered = 0;
  rivals: Rival[] = []; fuel = 1; boosting = false; combo = 0; comboTime = 0; steals = 0; nextId = 18; impactCooldown = 0; boostExhausted = false;
  constructor() { this.reset(); }
  reset() {
    this.head = { x: 78, y: 576, angle: -Math.PI / 2 }; this.cargo = [];
    this.loose = points.map(([x,y], id) => ({ id,x,y, angle: -Math.PI / 2, gold: [8,15,17].includes(id), cooldown: 0, stress: 0 }));
    this.remaining = WORLD.duration; this.elapsed = 0; this.toast = ''; this.toastTime = 0;
    this.bumpTime = 0; this.events = []; this.delivered = 0;
    this.fuel = 1; this.boosting = false; this.combo = 0; this.comboTime = 0; this.steals = 0; this.nextId = 18; this.impactCooldown = 0; this.boostExhausted = false;
    this.rivals = [
      {id:0,x:370,y:306,angle:Math.PI,waypoint:1,path:[[370,306],[220,306],[220,540],[370,540]],disabled:0,speed:55},
      {id:1,x:220,y:98,angle:Math.PI/2,waypoint:1,path:[[220,98],[220,310],[79,310],[79,98]],disabled:0,speed:43},
    ];
  }
  start() { this.reset(); this.phase = 'playing'; this.say('拖动摇杆指方向，右手冲刺抢货！'); }
  pause() {
    if (this.phase === 'paused') this.phase = this.resumePhase;
    else if (this.phase === 'playing' || this.phase === 'exiting') { this.resumePhase = this.phase; this.phase = 'paused'; }
  }
  say(message: string) { this.toast = message; this.toastTime = 2.8; this.toastId++; }
  value() { return this.cargo.reduce((sum, item) => sum + (item.gold ? 30 : 10), 0); }
  snapshot(): RunSnapshot {
    const multiplier = 1 + Math.floor(this.cargo.length / 3) * 0.2;
    return { phase: this.phase, remaining: this.remaining, count: this.cargo.length, value: this.value(), multiplier, score: Math.round(this.value() * multiplier), toast: this.toast, toastId: this.toastId, fuel: this.fuel, boosting: this.phase === 'playing' && this.boosting, combo: this.combo, comboTime: this.comboTime, steals: this.steals };
  }
  wallHit(x: number, y: number, radius: number, gateOpen: boolean) {
    return x < 22 + radius || x > 418 - radius || y > 638 - radius ||
      (y < 46 + radius && !(gateOpen && x > WORLD.gateLeft + radius && x < WORLD.gateRight - radius));
  }
  update(dt: number, input: Controls) {
    if (this.phase !== 'playing' && this.phase !== 'exiting') return;
    // Bounded substeps keep turning and trailer contact stable at different refresh rates.
    let left = Math.min(Math.max(dt, 0), 0.15);
    while (left > 0) { const step = Math.min(left, 1 / 120); this.step(step, input); left -= step; }
  }
  private step(dt: number, input: Controls) {
    if (this.phase !== 'playing' && this.phase !== 'exiting') return;
    this.elapsed += dt; this.toastTime -= dt; if (this.toastTime <= 0) this.toast = '';
    this.bumpTime = Math.max(0, this.bumpTime - dt);
    for (const c of this.loose) c.cooldown = Math.max(0, c.cooldown - dt);
    if (this.phase === 'exiting') {
      this.head.y -= 110 * dt; this.head.angle = -Math.PI / 2;
      this.head.x += (220 - this.head.x) * Math.min(1, dt * 3);
      this.follow(dt, false);
      this.delivered = this.cargo.filter(c => c.y < 40).length;
      if (this.delivered === this.cargo.length) { this.phase = 'won'; this.events.push({ kind: 'win', x: 220, y: 60 }); }
      return;
    }
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining <= 0) { this.phase = 'lost'; return; }
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.combo = 0;
    this.impactCooldown = Math.max(0, this.impactCooldown - dt);
    if (!input.boost) this.boostExhausted = false;
    if (input.boost && this.fuel <= 0.04) this.boostExhausted = true;
    this.boosting = Boolean(input.boost && !input.brake && !this.boostExhausted && this.fuel > 0.04);
    this.fuel = Math.max(0, Math.min(1, this.fuel + (this.boosting ? -0.32 : 0.16) * dt));
    const steer = Number(input.right) - Number(input.left);
    const rate = this.boosting ? 3.6 : 4.6;
    if (input.heading != null && Number.isFinite(input.heading)) {
      const diff = Math.atan2(Math.sin(input.heading-this.head.angle),Math.cos(input.heading-this.head.angle));
      this.head.angle += Math.max(-rate*dt,Math.min(rate*dt,diff));
    } else this.head.angle += steer * (input.brake ? 1.95 : 2.25) * dt;
    const speed = input.brake ? 42 : this.boosting ? 157 : 91;
    const oldX = this.head.x, oldY = this.head.y;
    const x = oldX + Math.cos(this.head.angle) * speed * dt, y = oldY + Math.sin(this.head.angle) * speed * dt;
    const unlocked = this.cargo.length >= WORLD.goal;
    if (SHELVES.some(r => circleRect(x, y, 12, r)) || this.wallHit(x, y, 12, unlocked)) {
      // Keep steering live when blocked, so turning in place always allows recovery.
      if (this.bumpTime <= 0) { this.bumpTime = 0.65; this.events.push({ kind: 'bump', x: oldX, y: oldY }); this.say('碰到了！把摇杆拨向空处，绕开货架'); }
    } else { this.head.x = x; this.head.y = y; }
    this.follow(dt, true);
    this.moveRivals(dt);
    if (this.head.y < 38 && this.cargo.length >= WORLD.goal) { this.phase = 'exiting'; this.say('已进入出口！正在牵引整列拖车'); return; }
    const pickup = this.loose.find(c => c.cooldown <= 0 && Math.hypot(c.x - this.head.x, c.y - this.head.y) < 27);
    if (pickup) {
      this.loose = this.loose.filter(c => c !== pickup);
      const tail = this.cargo.at(-1) ?? this.head;
      this.events.push({ kind: 'pickup', x: pickup.x, y: pickup.y, gold: pickup.gold });
      pickup.x = tail.x - Math.cos(tail.angle) * 26; pickup.y = tail.y - Math.sin(tail.angle) * 26; pickup.angle = tail.angle; pickup.stress = -0.6;
      this.cargo.push(pickup);
      this.combo = this.comboTime > 0 ? this.combo + 1 : 1; this.comboTime = 3.2;
      this.fuel = Math.min(1, this.fuel + 0.12);
      this.say(this.cargo.length === WORLD.goal ? '够 6 节了！顶部绿色出口已开放 ↑' : pickup.gold ? '贵重货物 +30！小心护送' : this.combo >= 3 ? `连收 ×${this.combo}！冲刺能量恢复` : `咔哒！已挂接 ${this.cargo.length} 节`);
    }
  }
  private moveRivals(dt: number) {
    for (const rival of this.rivals) {
      if (rival.disabled > 0) { rival.disabled = Math.max(0,rival.disabled-dt); continue; }
      const [x,y] = rival.path[rival.waypoint];
      const dx=x-rival.x,dy=y-rival.y,d=Math.hypot(dx,dy);
      if (d < 2) rival.waypoint=(rival.waypoint+1)%rival.path.length;
      else { rival.angle=Math.atan2(dy,dx); const travel=Math.min(d,rival.speed*dt); rival.x+=dx/d*travel;rival.y+=dy/d*travel; }
      // A head-on collision costs cargo; crossing the rival's route with your tail earns loot.
      if (Math.hypot(rival.x-this.head.x,rival.y-this.head.y)<26) {
        // Immunity suppresses damage, but head contact still takes precedence over the tail.
        if (this.impactCooldown > 0) continue;
        this.impactCooldown=2; rival.disabled=1.5;
        if(this.cargo.length) this.dropFrom(Math.max(0,this.cargo.length-2));
        this.combo=0;this.comboTime=0;this.fuel=Math.max(0,this.fuel-.2);
        this.events.push({kind:'bump',x:this.head.x,y:this.head.y});
        this.say('别撞车头！绕到它前面，用拖车截住它');
      } else if (this.cargo.some(c=>Math.hypot(c.x-rival.x,c.y-rival.y)<23)) {
        rival.disabled=7;this.steals++;this.fuel=Math.min(1,this.fuel+.3);
        // Bound total cargo so repeated interceptions cannot grow memory indefinitely.
        for(let j=0;j<3 && this.loose.length+this.cargo.length<45;j++) {
          const c: Cargo={id:this.nextId++,x:rival.x+Math.cos(j*2.1)*30,y:rival.y+Math.sin(j*2.1)*30,angle:0,gold:j===0,cooldown:.2,stress:0};
          this.recoverable(c);this.loose.push(c);
        }
        this.events.push({kind:'steal',x:rival.x,y:rival.y});this.say('截货成功！快捡走散落的金货 + 普通货');
      }
    }
  }
  private recoverable(c: Cargo) {
    for (const r of SHELVES) if (circleRect(c.x,c.y,16,r)) {
      const candidates=[{x:r.x-20,y:c.y},{x:r.x+r.w+20,y:c.y},{x:c.x,y:r.y-20},{x:c.x,y:r.y+r.h+20}];
      candidates.sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));
      c.x=candidates[0].x;c.y=candidates[0].y;
    }
    c.x=Math.max(44,Math.min(396,c.x));c.y=Math.max(74,Math.min(611,c.y));
  }
  private dropFrom(index: number) {
    const dropped=this.cargo.splice(index);
    for(const c of dropped) {c.cooldown=1.2;c.stress=0;this.recoverable(c);}
    this.loose.push(...dropped);
    if(dropped.length) this.events.push({kind:'drop',x:dropped[0].x,y:dropped[0].y});
    this.say('掉了 '+dropped.length+' 节！靠近掉落货物可重新挂接');
  }
  private follow(dt: number, allowDrop: boolean) {
    let lead: Pose = this.head, cut = -1;
    for (let i = 0; i < this.cargo.length; i++) {
      const c = this.cargo[i], dx = lead.x - c.x, dy = lead.y - c.y, distance = Math.hypot(dx, dy);
      if (distance > 26) { c.x += dx / distance * (distance - 26); c.y += dy / distance * (distance - 26); }
      if (distance > 0.1) c.angle = Math.atan2(dy, dx);
      if (allowDrop) {
        const hitting = SHELVES.some(r => circleRect(c.x, c.y, 9, r)) || this.wallHit(c.x, c.y, 8, this.cargo.length >= WORLD.goal);
        c.stress = hitting ? c.stress + dt : Math.max(0, c.stress - dt * 2);
        if (c.stress > 0.3 && cut < 0) cut = i;
      }
      lead = c;
    }
    if (cut >= 0) this.dropFrom(cut);
  }
}
