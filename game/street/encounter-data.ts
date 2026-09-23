import type { EnemyKind } from './simulation.ts';

export interface EncounterDefinition { enemies: readonly EnemyKind[]; simultaneous: number; }
export const ENCOUNTERS: readonly (readonly EncounterDefinition[])[] = [
  [
    { enemies: ['punk', 'punk', 'runner'], simultaneous: 2 },
    { enemies: ['punk', 'runner', 'tank', 'punk'], simultaneous: 3 },
    { enemies: ['runner', 'tank', 'punk'], simultaneous: 3 },
  ],
  [
    { enemies: ['punk', 'slinger', 'runner'], simultaneous: 2 },
    { enemies: ['tank', 'slinger', 'punk', 'slinger'], simultaneous: 3 },
    { enemies: ['runner', 'tank', 'slinger', 'punk'], simultaneous: 3 },
  ],
  [
    { enemies: ['punk', 'blocker', 'runner', 'tank'], simultaneous: 3 },
    { enemies: ['runner', 'blocker', 'slinger', 'punk'], simultaneous: 3 },
    { enemies: ['tank', 'blocker', 'slinger', 'punk'], simultaneous: 3 },
  ],
  [
    { enemies: ['punk', 'grabber', 'tank', 'slinger'], simultaneous: 3 },
    { enemies: ['runner', 'grabber', 'blocker', 'punk', 'slinger'], simultaneous: 4 },
    { enemies: ['tank', 'grabber', 'blocker', 'runner'], simultaneous: 4 },
  ],
];
export const REINFORCEMENTS = { delay: .6, entryTime: .45, lanes: [174, 200, 226] };
// Boss punish windows. `recovery` is read back by tests, so every boss keeps that key.
export const BOSS_RULES = {
  boss: { recovery: 1.2, active: .68 },
  longleg: { recovery: .95, active: .18 },
  luchuan: {
    recovery: .8, wind: .5, range: 108, cooldown: 1.5, cooldownPhase2: 1.05,
    combo: 2, comboPhase2: 3, hit: .1, gap: .14, gapPhase2: .11, damage: 13, reach: 46, lane: 22,
    guard: .55, guardPhase2: .42, guardDrift: 34, active: .2,
  },
  hanxiao: {
    recovery: .7, wind: .55, windPhase2: .44, range: 150, cooldown: 1.7, cooldownPhase2: 1.2,
    combo: 2, comboPhase2: 3, hit: .1, gap: .13, gapPhase2: .1, damage: 15, reach: 50, lane: 22,
    kick: .18, kickReach: 112, kickDamage: 26, kickHeight: 34, active: .6,
  },
} as const;
// Forward lunges that damage on contact instead of on a single frame.
export const CHARGES: Record<string, { speed: number; damage: number; reach: number; lane: number }> = {
  boss: { speed: 230, damage: 23, reach: 27, lane: 24 },
  luchuan: { speed: 300, damage: 20, reach: 30, lane: 22 },
  hanxiao: { speed: 265, damage: 26, reach: 29, lane: 24 },
};
// Fighters that keep a stand-off distance instead of taking a melee slot: bosses, and the grabber's lunge range.
export const STANDOFF: Record<string, { hold: number; speed: number; range: number }> = {
  boss: { hold: 29, speed: 38, range: 160 },
  longleg: { hold: 70, speed: 58, range: 102 },
  luchuan: { hold: 40, speed: 62, range: 108 },
  hanxiao: { hold: 44, speed: 56, range: 150 },
  grabber: { hold: 64, speed: 44, range: 84 },
};
// Deterministic move order, so a fight reads the same way every attempt.
export const BOSS_MOVES: Record<string, readonly ('combo' | 'counter' | 'kick' | 'charge')[]> = {
  luchuan: ['combo', 'counter', 'combo'],
  hanxiao: ['combo', 'kick', 'charge'],
};

// ---- Mob AI ----
// Each melee mob re-rolls a plan after attacking, after being hit, or when a plan runs out:
//   press: take a free attack slot and swing when in range
//   hold:  hang back in a waiting slot for a moment (breaks the "everyone swings in sync" look)
//   flank: like press, but prefers the attack slot behind the player
// Weights are relative (Downtown Beatdown's weighted behaviour picker).
export type MobPlan = 'press' | 'hold' | 'flank';
export interface MobAi {
  plans: Record<MobPlan, number>;
  hold: readonly [number, number];
  cooldown: readonly [number, number];
  /** Give up a chase that has not produced a swing in this long (Downtown Beatdown's max_chase_time). */
  chaseLimit: number;
  /** Windup of the wake-up swing at a player standing over them (OpenBOR's RISEATTACK); 0 = none. */
  riseWind: number;
  /** Close the horizontal gap before the depth gap (OpenBOR's CHASEX movement style). */
  xFirst?: boolean;
  speed: number;
  wind: number;
  damage: number;
}
export const MOB_AI: Record<string, MobAi> = {
  punk: { plans: { press: 5, hold: 3, flank: 2 }, hold: [.45, 1], cooldown: [1.2, 1.8], chaseLimit: 3.5, riseWind: .22, speed: 38, wind: .62, damage: 10 },
  runner: { plans: { press: 4, hold: 1, flank: 5 }, hold: [.3, .7], cooldown: [1, 1.5], chaseLimit: 3, riseWind: .18, speed: 58, wind: .42, damage: 10 },
  tank: { plans: { press: 6, hold: 3, flank: 1 }, hold: [.6, 1.2], cooldown: [1.5, 2.1], chaseLimit: 4.5, riseWind: .28, xFirst: true, speed: 27, wind: .62, damage: 18 },
  // Raised guard: frontal hits bounce off. Answer it with a grab, a slide or dash, or by getting behind it.
  blocker: { plans: { press: 5, hold: 4, flank: 1 }, hold: [.5, 1], cooldown: [1.4, 2], chaseLimit: 4, riseWind: .25, speed: 30, wind: .7, damage: 14 },
  // Stands off, crouches, then lunges to grab. Answer it with a dodge or a jump; mash to break a hold.
  grabber: { plans: { press: 1, hold: 0, flank: 0 }, hold: [.4, .8], cooldown: [1.8, 2.6], chaseLimit: 99, riseWind: 0, speed: 44, wind: .55, damage: 0 },
};
/** Flankers treat the attack slot in front of the player as this much farther away. */
export const FLANK_PENALTY = 80;
/** Waiting slots are nudged per enemy so a crowd does not stand on a grid (punchy's target offset). */
export const SLOT_JITTER = { x: 7, y: 5 };
// Slingers back off toward the far side and aim at the lane the player is walking into.
export const SLINGER_AI = { keep: 170, speed: 40, canSpeed: 170, lead: 1 };

export const BLOCKER = {
  /** Seconds before a blocker turns to face a player who got behind it. */
  turnDelay: .35,
  /** A block cuts its cooldown to this, so it answers pressure with a shield bash. */
  counterAfter: .3,
  recoil: 90,
};
export const GRABBER = {
  lunge: .28, speed: 230, reach: 22, lane: 16,
  /** A hold ends in a slam after this long unless the player mashes free first. */
  hold: 1.4, struggle: .16,
  squeeze: 5, squeezeEvery: .4, slam: 16,
  whiffStun: .6, escapeStun: .7,
};
