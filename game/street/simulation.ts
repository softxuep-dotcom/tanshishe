import { AIR_PHYSICS, ATTACKS, DODGE_FOLLOW, GROUND_CHAIN, JUMP_SPEED, KNOCKBACK, attackDuration, type AttackDefinition, type HitImpact, type Role } from './combat-data.ts';
import { BLOCKER, BOSS_MOVES, BOSS_RULES, CHARGES, ENCOUNTERS, FLANK_PENALTY, GRABBER, MOB_AI, REINFORCEMENTS, SLINGER_AI, SLOT_JITTER, STANDOFF, type MobPlan } from './encounter-data.ts';
import { CHAPTERS, CHAPTER_COUNT, waveBounds, type ChapterIndex } from './chapter-data.ts';
export type { Role } from './combat-data.ts';
export type { ChapterIndex } from './chapter-data.ts';
export type Kind = Role | 'punk' | 'runner' | 'tank' | 'blocker' | 'grabber' | 'boss' | 'slinger' | 'longleg' | 'luchuan' | 'hanxiao';
export type Action = 'attack' | 'jump' | 'special' | 'dodge';
export type EnemyKind = Exclude<Kind, Role>;
const BOSS_KINDS: readonly Kind[] = ['boss', 'longleg', 'luchuan', 'hanxiao'];
export const isBoss = (kind: Kind) => BOSS_KINDS.includes(kind);
// Mobs take roughly two full combos. Bosses take full damage but have super armor outside their punish window.
const BOSS_HEALTH: Record<string, number> = { boss: 500, longleg: 500, luchuan: 560, hanxiao: 650 };
const MOB_HEALTH: Record<string, number> = { punk: 110, runner: 85, slinger: 70, tank: 180, blocker: 130, grabber: 95 };
const BOSS_RECOVERY: Record<string, number> = { boss: BOSS_RULES.boss.recovery, longleg: BOSS_RULES.longleg.recovery, luchuan: BOSS_RULES.luchuan.recovery, hanxiao: BOSS_RULES.hanxiao.recovery };
export const enemyHealth = (kind: Kind) => BOSS_HEALTH[kind] ?? MOB_HEALTH[kind] ?? MOB_HEALTH.punk;
export interface Crate { id: number; x: number; y: number; snack: boolean; }
export interface Shot { x: number; y: number; vx: number; life: number; crate: boolean; snack: boolean; }
export interface Snack { x: number; y: number; }
export const HEROES = {
  chen: { name: '陈野', title: '街头拳手', detail: '连拳 · 上勾拳 · 均衡', speed: 86, damage: 14, color: 0xf1ba63 },
  tuo: { name: '阿拓', title: '修车铺的大块头', detail: '重拳 · 远投 · 强壮', speed: 67, damage: 19, color: 0x65cbb1 },
  man: { name: '小满', title: '夜市快腿', detail: '快踢 · 飞踢 · 灵活', speed: 107, damage: 11, color: 0xdf7f9c },
};
// Only 陈野 is offered for now; 阿拓 and 小满 keep their stats and lines for when they are added back.
export const PLAYABLE: readonly Role[] = ['chen'];
export const BADGES: Record<Role, string> = { chen: '拳', tuo: '摔', man: '踢' };
export type MotionState = 'grounded' | 'takeoff' | 'airborne' | 'landing' | 'launched' | 'downed' | 'rising';
export interface Fighter { id: number; kind: Kind; x: number; y: number; hp: number; max: number; face: number; timer: number; stun: number; inv: number; pose: string; poseTime: number; height: number; heightVelocity: number; motion: MotionState; motionTime: number; vx: number; wind: number; charge: number; dead: number; knockbackAmount: number; knockbackRecovery: number; entryTime: number; vulnerable: number; bossAttack: number; guard: number; bossStep: number; bossMove: number; turn: number; }
interface Mind { plan: MobPlan; chasing: number; }
interface Flight { hitIds: Set<number>; collateral: boolean; wallBounces: number; juggled: boolean; }
export interface Spark { x: number; y: number; life: number; text: string; }
export interface EnemySlot { id: number; x: number; y: number; attack: boolean; occupant: number | null; }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// How long a walked-into enemy stays held before struggling free.
const GRAB_HOLD = 1.2;
export class StreetGame {
  private spawnQueue: EnemyKind[] = [];
  private reinforcementTime = REINFORCEMENTS.delay;
  enemyLimit = 0;
  get pendingEnemies() { return this.spawnQueue.length; }
  get remainingEnemies() { return this.enemies.filter(e => e.hp > 0).length + this.pendingEnemies; }
  get encounterClear() { return this.remainingEnemies === 0 && this.enemies.every(e => e.dead <= 0); }
  isBossVulnerable(e: Fighter) { return isBoss(e.kind) && e.hp > 0 && e.motion === 'grounded' && e.vulnerable > 0; }
  /** Which telegraphed move a chapter 3/4 boss has already committed to, for HUD and warning art. */
  bossPendingMove(e: Fighter) { const moves = BOSS_MOVES[e.kind]; return moves && e.bossMove >= 0 ? moves[e.bossMove] ?? null : null; }
  private openBossRecovery(e: Fighter) {
    if (!isBoss(e.kind)) return;
    const duration = BOSS_RECOVERY[e.kind] ?? BOSS_RULES.boss.recovery;
    e.vulnerable = duration; e.stun = duration; e.wind = 0; e.charge = 0; e.bossAttack = 0;
    e.guard = 0; e.bossStep = 0;
    e.pose = 'hurt'; e.poseTime = duration; e.timer = Math.max(e.timer, duration + .35);
  }
  // Chapter 3/4 bosses are trained fighters: telegraphed strings, then a readable recovery.
  private boxerRules(kind: Kind) { return kind === 'hanxiao' ? BOSS_RULES.hanxiao : BOSS_RULES.luchuan; }
  private isBoxer(kind: Kind) { return kind === 'luchuan' || kind === 'hanxiao'; }
  private bossPhase2(e: Fighter) { return e.hp < e.max * .5; }
  private bossPunch(e: Fighter) {
    const rules = this.boxerRules(e.kind), p = this.hero;
    e.bossStep = Math.max(0, e.bossStep - 1);
    e.bossAttack = rules.hit + (this.bossPhase2(e) ? rules.gapPhase2 : rules.gap);
    e.pose = 'punch'; e.poseTime = e.bossAttack;
    if ((p.x - e.x) * e.face > -8 && (p.x - e.x) * e.face < rules.reach && Math.abs(p.y - e.y) < rules.lane) this.hurt(rules.damage, e.face);
  }
  private advanceBossAttack(e: Fighter) {
    if (this.isBoxer(e.kind) && e.bossStep > 0) { this.bossPunch(e); return; }
    this.openBossRecovery(e);
  }
  private releaseBossMove(e: Fighter) {
    const rules = this.boxerRules(e.kind), p = this.hero;
    const moves = BOSS_MOVES[e.kind] ?? [];
    const move = moves[e.bossMove] ?? 'combo';
    if (move === 'kick' && e.kind === 'hanxiao') {
      const k = BOSS_RULES.hanxiao;
      e.pose = 'kick'; e.bossAttack = k.kick; e.poseTime = e.bossAttack;
      if ((p.x - e.x) * e.face > -8 && (p.x - e.x) * e.face < k.kickReach && Math.abs(p.y - e.y) < 24) this.hurt(k.kickDamage, e.face, k.kickHeight);
      return;
    }
    if (move === 'charge') { e.charge = rules.active; e.pose = 'charge'; e.poseTime = e.charge; return; }
    e.bossStep = this.bossPhase2(e) ? rules.comboPhase2 : rules.combo;
    this.bossPunch(e);
  }
  // A scheduled sidestep, never a read of the player's current input.
  private beginBoxerMove(e: Fighter) {
    const rules = this.boxerRules(e.kind), phase2 = this.bossPhase2(e);
    const moves = BOSS_MOVES[e.kind] ?? ['combo'];
    e.bossMove = (e.bossMove + 1) % moves.length;
    e.timer = phase2 ? rules.cooldownPhase2 : rules.cooldown;
    if (moves[e.bossMove] === 'counter' && e.kind === 'luchuan') {
      e.guard = phase2 ? BOSS_RULES.luchuan.guardPhase2 : BOSS_RULES.luchuan.guard;
      e.pose = 'guard'; e.poseTime = e.guard; return;
    }
    e.wind = e.kind === 'hanxiao' && phase2 ? BOSS_RULES.hanxiao.windPhase2 : rules.wind;
    e.pose = 'wind'; e.poseTime = e.wind;
  }
  private updateBoxerGuard(e: Fighter, dt: number) {
    const p = this.hero;
    e.guard = Math.max(0, e.guard - dt);
    e.face = p.x >= e.x ? 1 : -1;
    // Slip out of the player's lane, then answer with a short lunge.
    const away = e.y <= p.y ? -1 : 1;
    e.y = clamp(e.y + away * BOSS_RULES.luchuan.guardDrift * dt, 156, 242);
    if (e.guard) return;
    e.charge = this.boxerRules(e.kind).active; e.pose = 'charge'; e.poseTime = e.charge;
  }
  private flights = new Map<number, Flight>();
  private flightHits: { target: Fighter; velocity: number }[] = [];
  private flightTargets: { fighter: Fighter; x: number; y: number; height: number }[] = [];
  enemySlots: EnemySlot[] = [];
  private slotAnchor = { x: 0, y: 0 };
  private nextAttackStep = 0;
  private isSlotEnemy(e: Fighter) { return e.kind === 'punk' || e.kind === 'runner' || e.kind === 'tank' || e.kind === 'blocker'; }
  private releaseEnemySlot(id: number) { for (const slot of this.enemySlots) if (slot.occupant === id) slot.occupant = null; }
  private arrangeEnemySlots(left: number, right: number) {
    const p = this.hero;
    // Preserve reservations during small movements; re-evaluate after a player dash/cross-over.
    if (Math.hypot(p.x - this.slotAnchor.x, p.y - this.slotAnchor.y) > 48) {
      this.enemySlots = []; this.slotAnchor = { x: p.x, y: p.y };
    }
    const offsets = [[-30, 0], [30, 0], [-74, -28], [74, -28], [-74, 28], [74, 28], [-110, 0], [110, 0], [-146, -28], [146, -28], [-146, 28], [146, 28]];
    const candidates = this.enemies.filter(e => this.isSlotEnemy(e) && e.hp > 0 && e.entryTime <= 0 && e.stun <= 0 && e.motion === 'grounded');
    const canReserveAttack = (e: Fighter) => e.timer <= 0 || e.wind > 0;
    const previous = this.enemySlots;
    this.enemySlots = offsets.map(([x, y], id): EnemySlot => ({ id, x: p.x + x, y: y === 0 ? clamp(p.y, 156, 242) : p.y + y, attack: id < 2, occupant: previous.find(s => s.id === id)?.occupant ?? null }))
      // Do not clamp different slots onto the same wall point.
      .filter(s => s.x >= left + 15 && s.x <= right - 15 && s.y >= 156 && s.y <= 242);
    for (const slot of this.enemySlots) {
      const owner = candidates.find(e => e.id === slot.occupant);
      if (!owner || (slot.attack && !canReserveAttack(owner))) slot.occupant = null;
    }
    const distance = (e: Fighter, s: EnemySlot) => Math.hypot(e.x - s.x, e.y - s.y);
    // Fill the globally nearest free attack position first, promoting waiting enemies.
    for (let i = 0; i < 2; i++) {
      const pairs = this.enemySlots.filter(s => s.attack && s.occupant === null).flatMap(slot =>
        candidates.filter(e => canReserveAttack(e) && !this.enemySlots.some(s => s.attack && s.occupant === e.id))
          .map(enemy => ({ slot, enemy, distance: distance(enemy, slot) + this.flankPenalty(enemy, slot) })));
      pairs.sort((a, b) => a.distance - b.distance || a.enemy.id - b.enemy.id);
      if (!pairs[0]) break;
      const { slot, enemy } = pairs[0]; this.releaseEnemySlot(enemy.id); slot.occupant = enemy.id;
    }
    for (const e of candidates) {
      if (this.enemySlots.some(s => s.occupant === e.id)) continue;
      const waiting = this.enemySlots.filter(s => !s.attack && s.occupant === null).sort((a, b) => distance(e, a) - distance(e, b));
      if (waiting[0]) waiting[0].occupant = e.id;
    }
  }
  // Seeded so a run (and every test) replays identically.
  private seed = 0x1f2e3d;
  private rand() {
    let t = (this.seed = (this.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private between([a, b]: readonly [number, number]) { return a + (b - a) * this.rand(); }
  private minds = new Map<number, Mind>();
  planOf(e: Fighter) { return this.minds.get(e.id)?.plan ?? null; }
  private decide(e: Fighter, forced?: MobPlan): Mind {
    const rules = MOB_AI[e.kind];
    let plan: MobPlan = forced ?? 'press';
    if (!forced) {
      const entries = Object.entries(rules.plans) as [MobPlan, number][];
      let roll = this.rand() * entries.reduce((sum, [, w]) => sum + w, 0);
      for (const [name, weight] of entries) { roll -= weight; if (roll < 0) { plan = name; break; } }
    }
    // A hold is simply a cooldown: the slot system already parks cooling enemies in waiting slots.
    if (plan === 'hold') e.timer = Math.max(e.timer, this.between(rules.hold));
    const mind = { plan, chasing: 0 };
    this.minds.set(e.id, mind); return mind;
  }
  private think(e: Fighter, dt: number) {
    const rules = MOB_AI[e.kind]; if (!rules) return;
    const mind = this.minds.get(e.id) ?? this.decide(e);
    if (mind.plan === 'hold') { if (e.timer <= 0) this.decide(e); return; }
    if (e.wind > 0 || e.timer > 0) { mind.chasing = 0; return; }
    mind.chasing += dt;
    if (mind.chasing > rules.chaseLimit) this.decide(e, 'hold');
  }
  private flankPenalty(e: Fighter, slot: EnemySlot) {
    const p = this.hero;
    return this.minds.get(e.id)?.plan === 'flank' && (slot.x - p.x) * p.face > 0 ? FLANK_PENALTY : 0;
  }
  /** A mob that gets up with the player standing over it swings back almost at once. */
  private onEnemyRise(e: Fighter) {
    const rules = MOB_AI[e.kind], p = this.hero;
    if (!rules?.riseWind || e.hp <= 0 || (this.training && this.freezeEnemies)) return;
    if (Math.abs(p.x - e.x) > 44 || Math.abs(p.y - e.y) > 18) return;
    e.face = p.x >= e.x ? 1 : -1; e.wind = rules.riseWind; e.timer = Math.max(e.timer, rules.riseWind + .5);
    e.pose = 'wind'; e.poseTime = e.wind; this.minds.delete(e.id);
  }
  private heroPrevY = 199;
  private heroVy = 0;
  /** The lane the player will be in when a can thrown now arrives. */
  aimLane(e: Fighter) {
    const p = this.hero, flight = Math.abs(p.x - e.x) / SLINGER_AI.canSpeed;
    return clamp(p.y + this.heroVy * flight * SLINGER_AI.lead, 156, 242);
  }
  private moveSlinger(e: Fighter, laneY: number, left: number, right: number, dt: number) {
    const p = this.hero, side = Math.sign(e.x - p.x) || 1;
    // Stay on its own side, as far back as the street allows, out of the melee pile.
    const targetX = clamp(p.x + side * SLINGER_AI.keep, left + 20, right - 20), dx = targetX - e.x, dy = laneY - e.y;
    if (Math.abs(dx) > 4) e.x += Math.sign(dx) * Math.min(Math.abs(dx), SLINGER_AI.speed * dt);
    if (Math.abs(dy) > 2) e.y += Math.sign(dy) * Math.min(Math.abs(dy), 30 * dt);
  }
  private moveToEnemySlot(e: Fighter, slot: EnemySlot, dt: number) {
    const p = this.hero;
    let x = slot.x, y = slot.y;
    if (!slot.attack) { x += (e.id * 73 % 15 - 7) / 7 * SLOT_JITTER.x; y += (e.id * 41 % 11 - 5) / 5 * SLOT_JITTER.y; }
    const side = Math.sign(x - p.x);
    // Route around the player when changing sides rather than walking through their body.
    if ((e.x - p.x) * side < 20) {
      y = p.y <= 199 ? p.y + 32 : p.y - 32;
      if (Math.abs(e.y - y) > 3) x = e.x;
    }
    const dx = x - e.x, dy = y - e.y;
    const speed = MOB_AI[e.kind]?.speed ?? 38;
    const travelTime = Math.max(Math.abs(dx) / speed, Math.abs(dy) / 29);
    const fraction = travelTime > 0 ? Math.min(1, dt / travelTime) : 0;
    const yScale = MOB_AI[e.kind]?.xFirst && Math.abs(dx) > 40 ? .35 : 1;
    e.x += dx * fraction; e.y += dy * fraction * yScale;
  }
  chapter: ChapterIndex = 0; crates: Crate[] = []; carried: Crate | null = null; shots: Shot[] = []; snacks: Snack[] = [];
  get chapterData() { return CHAPTERS[this.chapter]; }
  get chapterName() { return this.chapterData.name; }
  get bossName() { return this.chapterData.bossName; }
  get bossKind() { return this.chapterData.boss; }
  get hasNextChapter() { return this.chapter + 1 < CHAPTER_COUNT; }
  get bounds() { return waveBounds(this.wave); }
  nextChapter() { if (this.phase === 'won' && this.hasNextChapter && !this.training) this.start(this.role, (this.chapter + 1) as ChapterIndex); }
  restockCrates() {
    this.carried = null; this.shots = []; this.snacks = [];
    const x = waveBounds(this.wave).left;
    this.crates = this.chapterData.crates || this.training ? [
      { id: ++this.serial, x: x + 143, y: 211, snack: true },
      { id: ++this.serial, x: x + 194, y: 173, snack: false },
    ] : [];
  }
  dropCrate() { if (this.carried) { const { left, right } = this.bounds; this.carried.x = clamp(this.hero.x + this.hero.face * 25, left + 20, right - 20); this.carried.y = this.hero.y; this.crates.push(this.carried); this.carried = null; } }
  training = false; godMode = false; freezeEnemies = false; showRanges = false;
  trainingEnemy: EnemyKind = 'punk'; trainingCount = 1;
  startTraining(role: Role, kind: EnemyKind = 'punk', count = 1) {
    this.start(role); this.training = true; this.phase = 'playing'; this.godMode = true;
    this.setTrainingOpponents(kind, count);
  }
  setTrainingOpponents(kind: EnemyKind, count: number) {
    if (!this.training) return;
    this.spawnQueue = []; this.reinforcementTime = REINFORCEMENTS.delay; this.enemyLimit = 0;
    this.flights.clear(); this.flightHits = []; this.flightTargets = [];
    this.strike = null; this.chainTime = 0; this.nextAttackStep = 0; this.enemySlots = []; this.grabbed = null; this.grabTime = 0; this.minds.clear(); this.heldBy = null;
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
  dodgeCooldown = 0;
  dodgeFollow = 0;
  /** A dodge may interrupt your own recovery frames, but never your windup or active frames. */
  get dodgeCancelReady() { return this.attackPhase === 'recover' && this.hero.stun <= 0 && !this.motionLocked && this.dodgeCooldown <= 0 && !this.carried; }
  private dodgeMotion: { x: number; y: number; remaining: number } | null = null;
  private buffered: { action: Action; remaining: number }[] = [];
  private strike: { data: AttackDefinition; elapsed: number; face: number; damage: number; hitIds: Set<number>; landed: boolean; comboStep: number | null; comboChecked: boolean } | null = null;
  private chainTime = 0;
  get currentAttack() { return this.strike?.data ?? null; }
  get attackPhase() { const s = this.strike; return !s ? null : s.elapsed < s.data.windup ? 'windup' : s.elapsed < s.data.windup + s.data.active ? 'active' : 'recover'; }
  get windingUp() { return this.attackPhase === 'windup'; }
  private get motionLocked() { return this.hero.motion !== 'grounded' && this.hero.motion !== 'airborne'; }
  get running() { return this.sprint && Math.abs(this.mx) > .5 && !this.carried && this.hero.motion === 'grounded' && !this.hero.stun && !this.hero.timer; }
  get grabTarget() {
    const p = this.hero;
    if (p.motion !== 'grounded' || p.stun || this.carried) return undefined;
    return this.enemies.filter(e => e.hp > 0 && e.entryTime <= 0 && e.motion === 'grounded' && !isBoss(e.kind) && Math.abs(e.y - p.y) < 25 && Math.abs(e.x - p.x) < (this.role === 'tuo' ? 43 : 35))
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  }
  grabbed: Fighter | null = null;
  private grabTime = 0;
  private releaseGrab() { if (this.grabbed) this.grabbed.stun = Math.min(this.grabbed.stun, .25); this.grabbed = null; this.grabTime = 0; }
  private updateGrab(dt: number) {
    const p = this.hero, e = this.grabbed;
    if (e) {
      this.grabTime -= dt;
      if (this.grabTime <= 0 || e.hp <= 0 || e.motion !== 'grounded' || p.motion !== 'grounded') { this.releaseGrab(); return; }
      e.x = p.x + p.face * 24; e.y = p.y; e.vx = 0; e.stun = Math.max(e.stun, .2); e.wind = 0; e.charge = 0;
      e.pose = 'hurt'; e.poseTime = .1; p.pose = 'grab'; p.poseTime = .1;
      return;
    }
    // Walking into an enemy without attacking grabs them, as in most brawlers; there is no grab button.
    const target = this.grabTarget;
    if (!target || this.held || this.strike || p.timer > 0 || p.stun > 0 || Math.abs(this.mx) <= .5 || Math.sign(this.mx) !== Math.sign(target.x - p.x)) return;
    this.grabbed = target; this.grabTime = GRAB_HOLD + dt; p.face = Math.sign(target.x - p.x) || p.face;
    this.releaseEnemySlot(target.id); this.events.push('swing');
    this.updateGrab(dt);
  }
  /** The grabber currently holding the player, if any. */
  heldBy: Fighter | null = null;
  private heldTime = 0;
  private squeezeTime = 0;
  private startHold(e: Fighter) {
    const p = this.hero;
    this.releaseGrab(); this.dropCrate(); this.strike = null; this.buffered = []; this.dodgeMotion = null; this.chainTime = 0;
    this.heldBy = e; this.heldTime = GRABBER.hold; this.squeezeTime = GRABBER.squeezeEvery;
    e.charge = 0; e.pose = 'grab'; e.poseTime = GRABBER.hold;
    p.timer = 0; p.vx = 0; p.pose = 'held'; p.poseTime = .1;
    this.sparks.push({ x: p.x, y: p.y - 70, life: .6, text: '被抓住' }); this.events.push('hurt');
  }
  private releaseHold(how: 'escape' | 'slam' | 'break') {
    const e = this.heldBy; if (!e) return;
    this.heldBy = null; this.heldTime = 0;
    if (how === 'slam') { e.stun = .45; e.pose = 'throw'; e.poseTime = .3; this.hurt(GRABBER.slam, e.face); return; }
    if (how === 'escape') {
      e.stun = GRABBER.escapeStun; e.pose = 'hurt'; e.poseTime = e.stun; e.vx = -e.face * 80;
      this.hero.inv = Math.max(this.hero.inv, .3);
      this.sparks.push({ x: this.hero.x, y: this.hero.y - 70, life: .5, text: '挣脱' });
    }
  }
  /** Every fresh press while held shortens the hold; reaching zero this way breaks free instead of being slammed. */
  private struggle() {
    this.heldTime -= GRABBER.struggle; this.shake = Math.max(this.shake, .04);
    if (this.heldTime <= 0) this.releaseHold('escape');
  }
  private updateHold(e: Fighter, left: number, right: number, dt: number) {
    const p = this.hero;
    p.x = clamp(e.x + e.face * 22, left + 22, right - 20); p.y = e.y; p.pose = 'held'; p.poseTime = .1;
    e.pose = 'grab'; e.poseTime = .1;
    this.squeezeTime -= dt;
    if (this.squeezeTime <= 0) {
      this.squeezeTime = GRABBER.squeezeEvery;
      if (!(this.training && this.godMode)) {
        p.hp = Math.max(0, p.hp - GRABBER.squeeze); this.events.push('hurt'); this.shake = Math.max(this.shake, .08);
        this.sparks.push({ x: p.x, y: p.y - 60, life: .35, text: String(GRABBER.squeeze) });
        if (!p.hp) { this.heldBy = null; this.phase = 'lost'; this.clearInput(); return; }
      }
    }
    this.heldTime -= dt;
    if (this.heldTime <= 0) this.releaseHold('slam');
  }
  private updateLunge(e: Fighter, left: number, right: number, dt: number) {
    const p = this.hero, step = Math.min(dt, e.charge);
    e.charge -= step; e.x = clamp(e.x + e.face * GRABBER.speed * step, left + 15, right - 15);
    // Dodge frames, a jump, or already being held all make the lunge miss.
    if (!this.heldBy && p.hp > 0 && p.inv <= 0 && p.motion === 'grounded' && Math.abs(e.x - p.x) < GRABBER.reach && Math.abs(e.y - p.y) < GRABBER.lane) { this.startHold(e); return; }
    if (e.charge <= 0) { e.stun = GRABBER.whiffStun; e.pose = 'hurt'; e.poseTime = e.stun; }
  }
  /** Blockers stop frontal hits from anything that does not break guard. */
  private blocks(e: Fighter, data: AttackDefinition) {
    return e.kind === 'blocker' && e.hp > 0 && e.motion === 'grounded' && e.stun <= 0 && e.wind <= 0 && !data.guardBreak && (this.hero.x - e.x) * e.face > 0;
  }
  private onBlocked(e: Fighter, face: number) {
    this.hero.vx = -face * BLOCKER.recoil; this.hitstop = Math.max(this.hitstop, .03); this.shake = Math.max(this.shake, .05);
    if (e.timer > BLOCKER.counterAfter) e.timer = BLOCKER.counterAfter;
    this.sparks.push({ x: e.x, y: e.y - 50, life: .35, text: '格挡' }); this.events.push('block');
  }
  get crateInReach() {
    const p = this.hero;
    if (this.carried || p.motion !== 'grounded') return undefined;
    return this.crates.filter(c => Math.abs(c.x - p.x) < 35 && Math.abs(c.y - p.y) < 23).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  }
  requestAction(action: Action) {
    if (this.phase !== 'playing' || this.paused) return;
    if (this.heldBy) { this.struggle(); return; }
    if (action === 'dodge' && this.hitstop <= 0 && this.dodgeCancelReady) { this.action(action); return; }
    if (this.hero.timer > 0 || this.hero.stun > 0 || this.hitstop > 0 || this.motionLocked) {
      // Keep one deliberate action plus one attack; repeat attacks cannot erase a jump.
      const priority = { dodge: 5, special: 4, jump: 3, attack: 1 };
      this.buffered = this.buffered.filter(input => input.action !== action);
      const s = this.strike, window = s?.data.comboWindow;
      const comboRetention = action === 'attack' && s && window && s.elapsed >= window.open && s.elapsed < window.close ? window.close - s.elapsed + .04 : 0;
      this.buffered.push({ action, remaining: Math.max(.18, comboRetention) });
      this.buffered.sort((a, b) => priority[b.action] - priority[a.action]);
      const command = this.buffered.find(input => input.action !== 'attack');
      this.buffered = this.buffered.filter(input => input === command || input.action === 'attack');
    } else this.action(action);
  }
  constructor() { this.hero = this.fighter('chen', 85, 199, 150); }
  fighter(kind: Kind, x: number, y: number, hp: number): Fighter { return { id: ++this.serial, kind, x, y, hp, max: hp, face: 1, timer: .8, stun: 0, inv: 0, pose: 'idle', poseTime: 0, height: 0, heightVelocity: 0, motion: 'grounded', motionTime: 0, vx: 0, wind: 0, charge: 0, dead: 0, knockbackAmount: 0, knockbackRecovery: 0, entryTime: 0, vulnerable: 0, bossAttack: 0, guard: 0, bossStep: 0, bossMove: -1, turn: 0 }; }
  start(role: Role, chapter: ChapterIndex = 0) {
    this.spawnQueue = []; this.reinforcementTime = REINFORCEMENTS.delay; this.enemyLimit = 0;
    this.flights.clear(); this.flightHits = []; this.flightTargets = [];
    this.enemySlots = []; this.nextAttackStep = 0; this.grabbed = null; this.grabTime = 0;
    this.minds.clear(); this.seed = 0x1f2e3d; this.heroVy = 0; this.heroPrevY = 199; this.heldBy = null;
    this.dodgeMotion = null; this.dodgeCooldown = 0; this.dodgeFollow = 0;
    this.strike = null; this.chainTime = 0;
    this.chapter = chapter; this.crates = []; this.carried = null; this.shots = []; this.snacks = [];
    this.training = false; this.godMode = false; this.freezeEnemies = false; this.showRanges = false; this.events = [];
    this.role = role; this.hero = this.fighter(role, 85, 199, role === 'tuo' ? 180 : 150); this.hero.timer = 0;
    this.enemies = []; this.sparks = []; this.phase = 'intro'; this.paused = false; this.time = 0; this.camera = 0; this.wave = 0;
    this.kills = 0; this.rage = 50; this.combo = 0; this.comboTime = 0; this.hitstop = 0; this.shake = 0; this.attackStep = 0; this.food = false; this.clearInput();
  }
  stopHeldAttack() { this.held = false; this.buffered = this.buffered.filter(input => input.action !== 'attack'); }
  clearInput() { this.mx = 0; this.my = 0; this.held = false; this.sprint = false; this.buffered = []; }
  proceed() {
    if (this.phase === 'intro') { this.phase = 'playing'; this.spawn(); return; }
    if (this.phase !== 'bossIntro') return;
    this.phase = 'playing';
    const kind = this.bossKind;
    this.enemies.push(this.fighter(kind, 1215, 197, enemyHealth(kind)));
    // The boss street keeps its props so throwable cover carries into the duel.
    if (this.chapterData.crates) { this.restockCrates(); this.crates.forEach(c => c.x += 140); }
  }
  spawn() {
    this.flights.clear(); this.flightHits = []; this.flightTargets = [];
    this.enemySlots = [];
    const x = this.wave * 410;
    const encounter = ENCOUNTERS[this.chapter][this.wave];
    this.spawnQueue = [...(encounter?.enemies ?? [])]; this.enemyLimit = encounter?.simultaneous ?? 0;
    this.reinforcementTime = REINFORCEMENTS.delay;
    for (let i = 0; i < this.enemyLimit && this.spawnQueue.length && this.enemies.filter(e => e.hp > 0).length < this.enemyLimit; i++) {
      const kind = this.spawnQueue.shift()!;
      this.enemies.push(this.fighter(kind, x + 230 + i * 49, REINFORCEMENTS.lanes[i % 3], enemyHealth(kind)));
    }
    this.restockCrates();
  }
  private updateReinforcements(dt: number) {
    if (this.training || this.phase !== 'playing' || !this.pendingEnemies) return;
    if (this.enemies.filter(e => e.hp > 0).length >= this.enemyLimit) { this.reinforcementTime = REINFORCEMENTS.delay; return; }
    this.reinforcementTime -= dt;
    if (this.reinforcementTime > 1e-8) return;
    const { left: leftEdge, right: rightEdge } = this.bounds;
    const left = leftEdge + 28, right = rightEdge - 28;
    const points = [left, right].flatMap(x => REINFORCEMENTS.lanes.map(y => ({ x, y })))
      .filter(point => Math.hypot(point.x - this.hero.x, point.y - this.hero.y) >= 90);
    const score = (point: { x: number; y: number }) => Math.min(
      Math.hypot(point.x - this.hero.x, point.y - this.hero.y),
      ...this.enemies.filter(e => e.hp > 0).map(e => Math.hypot(point.x - e.x, point.y - e.y)));
    points.sort((a, b) => score(b) - score(a));
    const point = points[0], kind = this.spawnQueue.shift()!;
    const enemy = this.fighter(kind, point.x, point.y, enemyHealth(kind));
    enemy.entryTime = REINFORCEMENTS.entryTime; enemy.face = this.hero.x >= enemy.x ? 1 : -1;
    this.enemies.push(enemy); this.reinforcementTime = REINFORCEMENTS.delay;
    this.sparks.push({ x: enemy.x, y: enemy.y - 65, life: .6, text: '增援' });
  }
  action(a: Action, fresh = true) {
    if (this.phase !== 'playing' || this.paused) return;
    const p = this.hero;
    if (this.heldBy) return;
    if ((p.stun > 0 || p.timer > 0 || this.motionLocked) && !(a === 'dodge' && this.dodgeCancelReady)) return;
    if (p.motion === 'airborne' && a !== 'attack') return;
    if (this.grabbed) {
      const e = this.grabbed;
      if (a !== 'attack') this.releaseGrab();
      else {
        // Attack throws the held enemy toward the pushed direction, or forward when neutral.
        this.grabbed = null; this.grabTime = 0;
        p.face = Math.abs(this.mx) > .2 ? Math.sign(this.mx) : p.face;
        p.timer = .36; p.inv = Math.max(p.inv, .22); p.pose = 'throw'; p.poseTime = .36;
        this.hit(e, this.role === 'tuo' ? 42 : 29, p.face * 350, { amount: 1200, launchSpeed: AIR_PHYSICS.throwSpeed, pose: 'thrown' });
        this.events.push('throw'); return;
      }
    }
    if (a === 'dodge') {
      if (this.carried || this.dodgeCooldown > 0) return;
      const length = Math.hypot(this.mx, this.my);
      // Commit to the initial direction; neutral input retreats without turning.
      const x = length > .2 ? this.mx / length : -p.face;
      const y = length > .2 ? this.my / length : 0;
      this.dodgeMotion = { x: x * 240, y: y * 170, remaining: .18 };
      this.dodgeCooldown = .55; this.chainTime = 0; this.strike = null; this.dodgeFollow = .34 + DODGE_FOLLOW;
      p.vx = 0; p.timer = .34; p.pose = 'dodge'; p.poseTime = .34;
      p.inv = Math.max(p.inv, .18);
      this.events.push('dodge'); return;
    }
    if (this.carried) {
      if (a === 'attack') {
        this.shots.push({ x: p.x + p.face * 20, y: p.y, vx: p.face * 250, life: 1.3, crate: true, snack: this.carried.snack });
        this.carried = null; p.timer = .45; p.pose = 'throw'; p.poseTime = .4; this.events.push('throw'); return;
      }
      if (a === 'jump') return;
      if (a === 'special') this.dropCrate();
    }
    if (a === 'jump') {
      // A jump out of a run turns into a sliding trip instead of leaving the ground.
      if (this.running && !this.carried) { this.beginStrike(ATTACKS[this.role].slide, null); return; }
      this.chainTime = 0; this.nextAttackStep = 0;
      p.motion = 'takeoff'; p.motionTime = AIR_PHYSICS.takeoff; p.pose = 'takeoff'; p.poseTime = 0;
      this.events.push('jump'); return;
    }
    const dash = a === 'attack' && fresh && this.running;
    if (Math.abs(this.mx) > .2) p.face = Math.sign(this.mx);
    const nearby = this.enemies.filter(e => e.hp > 0 && e.entryTime <= 0 && e.motion === 'grounded' && Math.abs(e.y - p.y) < 25 && Math.abs(e.x - p.x) < 52).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    // Aim assist helps standing attacks, but never overrides deliberate movement.
    if (!dash && Math.abs(this.mx) <= .2 && nearby[0]) p.face = nearby[0].x >= p.x ? 1 : -1;
    // Crates share the attack button: a fresh press with nobody in reach lifts one instead of swinging.
    const crate = a === 'attack' && fresh && !dash && !nearby.length ? this.crateInReach : undefined;
    if (crate) {
      this.carried = crate; this.crates = this.crates.filter(o => o !== crate); p.timer = .2;
      // Lifting consumes the press, so a held attack cannot lift and immediately throw.
      this.held = false; this.buffered = this.buffered.filter(input => input.action !== 'attack');
      this.events.push('heal'); return;
    }
    if (a === 'special') {
      if (this.rage < 50) { this.sparks.push({ x: p.x, y: p.y - 63, life: .6, text: '怒气不足' }); return; }
      this.rage -= 50; p.inv = .8; p.timer = .7; p.pose = 'special'; p.poseTime = .65;
      for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.x - p.x) < 108 && Math.abs(e.y - p.y) < 49) this.hit(e, 40, (e.x >= p.x ? 1 : -1) * 250, { amount: 600, launchSpeed: 170 });
      this.shake = .3; this.events.push('special'); return;
    }
    const airborne = p.motion === 'airborne';
    // Attacking out of a dodge lunges back into range and opens a fresh chain.
    const lunging = !dash && !airborne && this.dodgeFollow > 0;
    this.attackStep = !dash && !airborne && !lunging && this.chainTime > 0 ? this.nextAttackStep : 0;
    if (lunging) this.dodgeFollow = 0;
    // Consume the previous confirmation. Only this punch actually landing earns the next step.
    this.beginStrike(lunging ? ATTACKS[this.role].lunge : ATTACKS[this.role][dash ? 'dash' : airborne ? 'air' : GROUND_CHAIN[this.attackStep]],
      dash || airborne ? null : this.attackStep);
  }
  private beginStrike(data: AttackDefinition, comboStep: number | null) {
    const p = this.hero;
    this.chainTime = 0; this.nextAttackStep = 0;
    p.pose = data.pose; p.timer = attackDuration(data); p.poseTime = p.timer;
    this.strike = { data, elapsed: 0, face: p.face, damage: HEROES[this.role].damage * data.damageScale,
      hitIds: new Set(), landed: false, comboStep, comboChecked: false };
    this.events.push('swing');
  }
  private updateStrike(dt: number) {
    const strike = this.strike;
    if (!strike) return;
    const p = this.hero, data = strike.data, before = strike.elapsed;
    strike.elapsed += dt;
    const overlap = Math.max(0, Math.min(strike.elapsed, data.advance.end) - Math.max(before, data.advance.start));
    p.x += strike.face * data.advance.speed * overlap;
    // Hand the burst over to sliding momentum; the shared ground friction brings it to a stop.
    if (data.momentum && before < data.advance.end && strike.elapsed >= data.advance.end) p.vx = strike.face * data.momentum;
    if (strike.elapsed >= data.windup && before < data.windup + data.active) {
      for (const e of this.enemies) if (!strike.hitIds.has(e.id) && Math.abs(e.y - p.y) < data.lane &&
        (e.x - p.x) * strike.face > -9 && (e.x - p.x) * strike.face < data.reach &&
        p.height + data.height.high >= e.height && p.height + data.height.low <= e.height + 48) {
        if (this.blocks(e, data)) { strike.hitIds.add(e.id); this.onBlocked(e, strike.face); continue; }
        if (!this.hit(e, strike.damage, strike.face * data.knockback, { amount: data.impact, launchSpeed: data.launchSpeed, juggle: data.juggle })) continue;
        strike.hitIds.add(e.id);
        if (!strike.landed) {
          if (strike.comboStep !== null) { this.nextAttackStep = (strike.comboStep + 1) % 3; this.chainTime = .65; }
          if (data.knockback > 100) this.events.push('heavy');
          strike.landed = true;
        }
      }
    }
    const window = data.comboWindow;
    if (window && !strike.comboChecked && strike.elapsed >= window.close) {
      strike.comboChecked = true;
      if (strike.landed && !this.buffered.some(input => input.action !== 'attack') && (this.held || this.buffered.some(input => input.action === 'attack'))) {
        this.buffered = this.buffered.filter(input => input.action !== 'attack');
        this.strike = null; p.timer = 0; this.action('attack', false); return;
      }
    }
    if (strike.elapsed >= attackDuration(data)) this.strike = null;
  }
  hit(e: Fighter, damage: number, velocity: number, impact: HitImpact = { amount: KNOCKBACK.weak }) {
    if (e.hp <= 0 || e.entryTime > 0 || e.motion === 'downed' || e.motion === 'rising') return false;
    const flight = this.flights.get(e.id);
    const juggling = e.motion === 'launched';
    if (juggling && !(impact.juggle && flight && !flight.juggled)) return false;
    // Bosses always take the full hit, but outside the punish window they have super armor:
    // no flinch, no interrupted move, no launch. The window is where combos and knockdowns happen.
    const armored = isBoss(e.kind) && !this.isBossVulnerable(e);
    if (this.heldBy === e) this.releaseHold('break');
    this.minds.delete(e.id);
    e.hp = Math.max(0, e.hp - damage);
    if (!armored || !e.hp) {
      this.releaseEnemySlot(e.id);
      e.stun = Math.max(e.vulnerable, isBoss(e.kind) ? .16 : .3); e.wind = 0; e.charge = 0; e.bossAttack = 0; e.guard = 0; e.bossStep = 0; e.vx = velocity; e.pose = 'hurt'; e.poseTime = .22;
    }
    this.combo++; this.comboTime = 2; this.rage = Math.min(100, this.rage + 5);
    this.hitstop = Math.max(this.hitstop, Math.abs(velocity) > 100 ? .075 : .035);
    this.shake = Math.max(this.shake, Math.abs(velocity) > 100 ? .16 : .065);
    this.sparks.push({ x: e.x, y: e.y - e.height - 28, life: .33, text: `${armored && e.hp ? '霸体 ' : ''}${Math.round(damage)}` }); this.events.push('hit');
    if (!e.hp) { e.dead = .65; this.kills++; this.rage = Math.min(100, this.rage + 5); }
    if (armored && e.hp) return true;
    e.knockbackAmount += Math.max(0, impact.amount); e.knockbackRecovery = KNOCKBACK.recoveryDelay;
    if (e.knockbackAmount >= KNOCKBACK.threshold || (impact.launchSpeed ?? 0) > 0 || juggling) {
      e.vx = (Math.sign(velocity) || this.hero.face) * Math.max(Math.abs(velocity), KNOCKBACK.minimumSpeed);
      this.launch(e, juggling ? KNOCKBACK.juggleLift : impact.launchSpeed || KNOCKBACK.lift, impact.pose, impact.collateral ?? true);
      // One juggle per launch: the fresh flight record inherits the spent hit.
      if (juggling) { const next = this.flights.get(e.id); if (next) next.juggled = true; }
      if (Math.abs(velocity) <= 100) {
        this.hitstop = Math.max(this.hitstop, .075); this.shake = Math.max(this.shake, .16); this.events.push('heavy');
      }
    }
    return true;
  }
  hurt(damage: number, face: number, hitHeight = 22) {
    const p = this.hero; if ((this.training && this.godMode) || p.inv > 0 || p.height > hitHeight || p.motion === 'downed' || p.motion === 'rising') return;
    this.dropCrate();
    this.dodgeMotion = null; this.dodgeFollow = 0;
    if (this.heldBy) { this.heldBy.stun = Math.max(this.heldBy.stun, .3); this.heldBy = null; }
    this.strike = null; this.buffered = []; this.chainTime = 0; this.releaseGrab();
    p.hp = Math.max(0, p.hp - damage); p.inv = .85; p.stun = .28; p.vx = face * 115; p.pose = 'hurt'; p.poseTime = .3;
    p.timer = 0;
    if (p.height > 0) { p.motion = 'launched'; p.heightVelocity = Math.min(0, p.heightVelocity); }
    else { p.motion = 'grounded'; p.motionTime = 0; }
    this.combo = 0; this.shake = .2; this.events.push('hurt'); if (!p.hp) { this.phase = 'lost'; this.clearInput(); }
  }
  private launch(f: Fighter, speed: number, pose = 'launched', collateral = true) {
    this.releaseEnemySlot(f.id); f.motion = 'launched'; f.motionTime = 0; f.heightVelocity = speed;
    f.pose = pose; f.poseTime = 0; f.wind = 0; f.charge = 0; f.guard = 0; f.bossStep = 0;
    f.knockbackAmount = 0; f.knockbackRecovery = 0;
    this.flights.set(f.id, { hitIds: new Set([f.id]), collateral, wallBounces: 0, juggled: false });
  }
  private sweepFlight(f: Fighter, flight: Flight, from: number, to: number, startTime: number, duration: number, velocity: number) {
    if (!flight.collateral || Math.abs(velocity) < KNOCKBACK.collisionMinSpeed || from === to) return;
    const direction = Math.sign(to - from), distance = Math.abs(to - from), radius = KNOCKBACK.collisionRadius;
    const candidates = this.flightTargets.filter(t => !flight.hitIds.has(t.fighter.id) &&
      Math.abs(t.y - f.y) < KNOCKBACK.collisionLane && (t.x - from) * direction >= -radius &&
      (t.x - from) * direction <= distance + radius).sort((a, b) => (a.x - b.x) * direction || a.fighter.id - b.fighter.id);
    for (const t of candidates) {
      const entryDistance = clamp((t.x - from) * direction - radius, 0, distance);
      const exitDistance = clamp((t.x - from) * direction + radius, 0, distance);
      const timeAt = (travel: number) => startTime + Math.min(duration, -Math.log(Math.max(1e-12, 1 - travel * KNOCKBACK.flightDrag / Math.abs(velocity))) / KNOCKBACK.flightDrag);
      const heightAt = (time: number) => f.height + f.heightVelocity * time - .5 * AIR_PHYSICS.gravity * time * time;
      const low = Math.min(heightAt(timeAt(entryDistance)), heightAt(timeAt(exitDistance)));
      if (low > t.height + 48) continue;
      flight.hitIds.add(t.fighter.id);
      this.flightHits.push({ target: t.fighter, velocity: velocity * Math.exp(-KNOCKBACK.flightDrag * (timeAt(entryDistance) - startTime)) });
    }
  }
  private moveFlight(f: Fighter, flight: Flight, delta: number) {
    const { left: leftEdge, right: rightEdge } = this.bounds;
    const left = leftEdge + 15, right = rightEdge - 15;
    f.x = clamp(f.x, left, right);
    let remaining = delta, elapsed = 0;
    // At most one bounce, then one final segment; never teleport through a wall.
    for (let i = 0; i < 3 && remaining > 1e-9 && Math.abs(f.vx) > 1e-6; i++) {
      const velocity = f.vx, wall = velocity > 0 ? right : left;
      const ratio = (wall - f.x) * KNOCKBACK.flightDrag / velocity;
      const wallTime = ratio < 1 ? -Math.log(Math.max(1e-12, 1 - ratio)) / KNOCKBACK.flightDrag : Infinity;
      const step = Math.min(remaining, wallTime), from = f.x;
      f.x += velocity * (1 - Math.exp(-KNOCKBACK.flightDrag * step)) / KNOCKBACK.flightDrag;
      this.sweepFlight(f, flight, from, f.x, elapsed, step, velocity);
      f.vx *= Math.exp(-KNOCKBACK.flightDrag * step); remaining -= step; elapsed += step;
      if (wallTime > step) break;
      f.x = wall;
      if (flight.wallBounces >= KNOCKBACK.maxWallBounces) { f.vx = 0; break; }
      flight.wallBounces++; f.vx *= -KNOCKBACK.wallRestitution;
      this.sparks.push({ x: wall, y: f.y - f.height - 20, life: .4, text: '撞墙' });
      this.shake = Math.max(this.shake, .1); this.events.push('heavy');
    }
  }
  private updateMotion(f: Fighter, delta: number) {
    let remaining = delta;
    // Consume leftover time at transitions so jump trajectories do not depend on frame rate.
    for (let i = 0; remaining > 0 && i < 5; i++) {
      if (f.motion === 'grounded') break;
      if (f.motion === 'airborne' || f.motion === 'launched') {
        const g = AIR_PHYSICS.gravity, v = f.heightVelocity;
        const landingTime = (v + Math.sqrt(v * v + 2 * g * f.height)) / g;
        const step = Math.min(remaining, landingTime);
        const flight = this.flights.get(f.id);
        if (flight && f.motion === 'launched') this.moveFlight(f, flight, step);
        f.height = Math.max(0, f.height + v * step - .5 * g * step * step); f.heightVelocity -= g * step;
        remaining -= step;
        if (step < landingTime) break;
        const launched = f.motion === 'launched';
        this.flights.delete(f.id);
        f.height = 0; f.heightVelocity = 0; f.vx = 0;
        f.motion = launched ? 'downed' : 'landing'; f.motionTime = launched ? AIR_PHYSICS.downed : AIR_PHYSICS.landing;
        f.poseTime = 0;
        if (f === this.hero) { this.strike = null; f.timer = 0; }
      } else {
        if (f.motion === 'downed' && f.hp <= 0) break;
        const step = Math.min(remaining, f.motionTime); f.motionTime -= step; remaining -= step;
        if (f.motionTime > 1e-8) break;
        if (f.motion === 'takeoff') { f.motion = 'airborne'; f.heightVelocity = JUMP_SPEED[this.role]; }
        else if (f.motion === 'downed') { f.motion = 'rising'; f.motionTime = AIR_PHYSICS.rising; }
        else { const rose = f.motion === 'rising'; f.motion = 'grounded'; f.motionTime = 0; if (rose && f !== this.hero) this.onEnemyRise(f); }
      }
    }
    if (!f.poseTime) f.pose = f.motion === 'airborne' ? 'jump' : f.motion === 'grounded' ? 'idle' : f.motion === 'launched' && f.pose === 'thrown' ? 'thrown' : f.motion;
  }
  update(delta: number) {
    if (this.phase !== 'playing' || this.paused) return;
    const dt = Math.min(delta, .035); this.time += dt; this.shake = Math.max(0, this.shake - dt);
    this.sparks = this.sparks.filter(s => (s.life -= dt) > 0);
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt); this.dodgeFollow = Math.max(0, this.dodgeFollow - dt);
    if (this.dodgeMotion) {
      const step = Math.min(dt, this.dodgeMotion.remaining);
      this.hero.x += this.dodgeMotion.x * step; this.hero.y += this.dodgeMotion.y * step;
      this.dodgeMotion.remaining -= dt;
      if (this.dodgeMotion.remaining <= 0) this.dodgeMotion = null;
    }
    this.chainTime = Math.max(0, this.chainTime - dt);
    this.buffered = this.buffered.filter(input => {
      // Once the buffered jump starts, its paired attack survives the brief takeoff
      // even at 30 Hz. Slide-out/cancel still removes it immediately.
      if (input.action === 'attack' && this.hero.motion === 'takeoff') return true;
      return (input.remaining -= dt) > 0;
    });
    this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.combo = 0;
    this.flightTargets = this.enemies.filter(e => e.hp > 0 && e.entryTime <= 0 && e.motion === 'grounded').map(fighter => ({ fighter, x: fighter.x, y: fighter.y, height: fighter.height }));
    for (const f of [this.hero, ...this.enemies]) {
      f.timer = Math.max(0, f.timer - dt); f.stun = Math.max(0, f.stun - dt); f.inv = Math.max(0, f.inv - dt);
      f.entryTime = Math.max(0, f.entryTime - dt); f.vulnerable = Math.max(0, f.vulnerable - dt);
      f.poseTime = Math.max(0, f.poseTime - dt);
      if (!this.flights.has(f.id)) { f.x += f.vx * dt; f.vx *= Math.exp(-7 * dt); }
      const recoveryStep = Math.max(0, dt - f.knockbackRecovery);
      f.knockbackRecovery = Math.max(0, f.knockbackRecovery - dt);
      f.knockbackAmount = Math.max(0, f.knockbackAmount - KNOCKBACK.recoveryPerSecond * recoveryStep);
      this.updateMotion(f, dt);
      if (f.motion !== 'launched') f.dead = Math.max(0, f.dead - dt);
    }
    // Resolve after all movement: newly knocked-down targets start flying next frame,
    // independent of their ordering in the enemies array. Secondary bodies do not chain.
    for (const contact of this.flightHits.splice(0)) {
      if (this.hit(contact.target, KNOCKBACK.collateralDamage, contact.velocity * KNOCKBACK.collateralSpeedScale,
        { amount: KNOCKBACK.threshold, launchSpeed: KNOCKBACK.collateralLift, collateral: false })) {
        this.sparks.push({ x: contact.target.x, y: contact.target.y - 48, life: .4, text: '撞倒' });
      }
    }
    const p = this.hero; const alive = this.enemies.filter(e => e.hp > 0);
    this.updateStrike(dt);
    if (!p.stun) {
      const len = Math.max(1, Math.hypot(this.mx, this.my));
      const movement = this.motionLocked || this.grabbed || this.heldBy || p.pose === 'dodge' ? 0 : p.motion === 'airborne' ? .8 : p.timer > 0 ? .25 : 1;
      p.x += this.mx / len * HEROES[this.role].speed * dt * movement * (this.running ? 1.65 : 1) * (this.carried ? .75 : 1);
      p.y += this.my / len * 61 * dt * movement;
      if (this.mx && p.timer <= 0) p.face = this.mx > 0 ? 1 : -1;
      if (this.buffered.length && p.timer <= 0 && !this.motionLocked) {
        // Takeoff retains a paired attack until the character is actually airborne.
        while (this.buffered.length && p.timer <= 0 && !this.motionLocked) this.action(this.buffered.shift()!.action);
      } else if (this.held) this.action('attack', false);
    }
    this.updateGrab(dt);
    const { left, right } = this.bounds;
    p.x = clamp(p.x, left + 22, right - 20); p.y = clamp(p.y, 157, 243);
    this.heroVy = clamp((p.y - this.heroPrevY) / dt, -61, 61); this.heroPrevY = p.y;
    this.camera = clamp(p.x - 170, left, Math.max(left, right - 480 + 45));
    for (const shot of this.shots) {
      const previousX = shot.x; shot.x += shot.vx * dt; shot.life -= dt;
      const crosses = (x: number, y: number, radius: number) => Math.abs(y - shot.y) < radius && x >= Math.min(previousX, shot.x) - 14 && x <= Math.max(previousX, shot.x) + 14;
      if (shot.crate) {
        const targets = alive.filter(e => e.hp > 0 && e.entryTime <= 0 && crosses(e.x, e.y, 25));
        if (targets.length) {
          const impact = targets.sort((a,b) => Math.abs(a.x-previousX)-Math.abs(b.x-previousX))[0];
          for (const e of alive) if (e.hp > 0 && Math.abs(e.x-impact.x) < 55 && Math.abs(e.y-shot.y) < 30) this.hit(e, 36, Math.sign(shot.vx) * 170, { amount: 300 });
          shot.x = impact.x; shot.life = 0;
        }
      } else {
        const blocker = this.crates.find(c => crosses(c.x,c.y,23));
        if (blocker) { shot.life = 0; this.sparks.push({ x: blocker.x, y: blocker.y-28, text:'挡住了',life:.5 }); }
        else if (crosses(p.x,p.y,18)) { this.hurt(12,Math.sign(shot.vx),18); shot.life = 0; }
      }
      if (shot.x < left + 10 || shot.x > right - 10) shot.life = 0;
      if (shot.crate && shot.life <= 0) {
        const x = clamp(shot.x,left+25,right-25); this.sparks.push({ x, y:shot.y-22, text:'木箱碎裂',life:.6 }); this.events.push('throw');
        if (shot.snack) this.snacks.push({ x, y:shot.y });
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
    this.snacks = this.snacks.filter(s => { if (p.motion === 'grounded' && Math.abs(s.x-p.x) < 22 && Math.abs(s.y-p.y) < 20) { p.hp = Math.min(p.max,p.hp+30); this.events.push('heal'); this.sparks.push({x:p.x,y:p.y-50,text:'+30 补给',life:.8}); return false; } return true; });
    this.arrangeEnemySlots(left, right);
    for (const e of alive) {
      if (e.hp <= 0) continue;
      e.x = clamp(e.x, left + 15, right - 15); e.y = clamp(e.y, 156, 242);
      if (e.entryTime > 0 || e.stun > 0 || e.vulnerable > 0 || e.motion !== 'grounded' || (this.training && this.freezeEnemies)) continue;
      if (this.heldBy === e) { this.updateHold(e, left, right, dt); continue; }
      if (e.charge > 0 && e.kind === 'grabber') { this.updateLunge(e, left, right, dt); continue; }
      if (e.bossAttack > 0) { e.bossAttack = Math.max(0, e.bossAttack - dt); if (!e.bossAttack) this.advanceBossAttack(e); continue; }
      if (e.guard > 0) { this.updateBoxerGuard(e, dt); continue; }
      if (e.charge > 0) { const c = CHARGES[e.kind] ?? CHARGES.boss; const step = Math.min(dt, e.charge); e.charge -= step; e.x = clamp(e.x + e.face * c.speed * step, left + 15, right - 15); if (Math.abs(e.x - p.x) < c.reach && Math.abs(e.y - p.y) < c.lane) this.hurt(c.damage, e.face); if (e.charge <= 0) this.openBossRecovery(e); continue; }
      if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) {
        if (this.isBoxer(e.kind)) this.releaseBossMove(e);
        else if (e.kind === 'boss') { e.charge = BOSS_RULES.boss.active; e.pose = 'charge'; e.poseTime = e.charge; }
        else if (e.kind === 'slinger') { this.shots.push({x:e.x+e.face*18,y:e.y,vx:e.face*SLINGER_AI.canSpeed,life:2.5,crate:false,snack:false}); e.pose='throw'; e.poseTime=.3; }
        else if (e.kind === 'longleg') { e.pose='kick'; e.bossAttack=BOSS_RULES.longleg.active; e.poseTime=e.bossAttack; if ((p.x-e.x)*e.face > -8 && (p.x-e.x)*e.face < 105 && Math.abs(e.y-p.y)<24) this.hurt(24,e.face,34); }
        else if (e.kind === 'grabber') { e.charge = GRABBER.lunge; e.pose = 'lunge'; e.poseTime = e.charge; }
        else { e.pose = 'punch'; e.poseTime = .23; if (Math.abs(e.x - p.x) < 43 && Math.abs(e.y - p.y) < 22) this.hurt(MOB_AI[e.kind]?.damage ?? 10, e.face); }
      } continue; }
      const dx = p.x - e.x, dy = p.y - e.y, facing = dx >= 0 ? 1 : -1;
      // Blockers turn slowly, so crossing over or dodging past opens their back for a moment.
      if (e.kind === 'blocker' && facing !== e.face) { e.turn += dt; if (e.turn >= BLOCKER.turnDelay) { e.face = facing; e.turn = 0; } }
      else { e.face = facing; e.turn = 0; }
      const attackers = alive.filter(o => o !== e && (o.wind > 0 || o.charge > 0 || o.bossAttack > 0)).length;
      const slot = this.enemySlots.find(s => s.occupant === e.id);
      const atAttackSlot = !this.isSlotEnemy(e) || (slot?.attack && Math.hypot(slot.x - e.x, slot.y - e.y) <= 3);
      if (this.isSlotEnemy(e)) this.think(e, dt);
      const approach = STANDOFF[e.kind], mob = MOB_AI[e.kind];
      const slinger = e.kind === 'slinger', laneY = slinger ? this.aimLane(e) : p.y;
      if (atAttackSlot && Math.abs(dx) < (slinger ? 300 : approach?.range ?? 33) && Math.abs(laneY - e.y) < (slinger ? 10 : 16) && !e.timer && attackers < 2) {
        if (this.isBoxer(e.kind)) { this.beginBoxerMove(e); continue; }
        e.wind = slinger ? .9 : isBoss(e.kind) ? .8 : mob?.wind ?? .62;
        e.timer = mob ? this.between(mob.cooldown) : 2.5; e.pose = 'wind'; e.poseTime = e.wind;
        if (mob) this.minds.delete(e.id);
        continue;
      }
      if (slinger) { this.moveSlinger(e, laneY, left, right, dt); continue; }
      if (this.isSlotEnemy(e)) { if (slot) this.moveToEnemySlot(e, slot, dt); continue; }
      const targetY = p.y + (e.id % 2 ? 7 : -7); const speed = approach?.speed ?? (e.kind === 'runner' ? 58 : e.kind === 'tank' ? 27 : 38);
      if (Math.abs(dx) > (approach?.hold ?? 29)) e.x += Math.sign(dx) * speed * dt;
      if (Math.abs(targetY - e.y) > 4) e.y += Math.sign(targetY - e.y) * 29 * dt;
      for (const o of alive) if (o.id < e.id && Math.abs(o.x - e.x) < 21 && Math.abs(o.y - e.y) < 12) e.y += (e.id % 2 ? 1 : -1) * 23 * dt;
    }
    if (this.food && p.motion === 'grounded' && Math.abs(p.x - 768) < 25 && Math.abs(p.y - 208) < 23) { p.hp = Math.min(p.max, p.hp + 45); this.food = false; this.sparks.push({ x: p.x, y: p.y - 50, life: 1, text: '+45 热包子' }); this.events.push('heal'); }
    this.updateReinforcements(dt);
    if (!this.training && this.encounterClear) {
      if (this.wave === 3) { this.phase = 'won'; this.clearInput(); }
      else if (p.x > right - 60) { this.wave++; this.enemies = []; if (this.wave === 3) { this.wave = 2; this.phase = 'bossIntro'; this.clearInput(); /* boss shares the final street */ this.wave = 3; p.x = 1130; this.camera = 880; } else { this.spawn(); if (this.wave === 1) this.food = true; } }
    }
  }
}
