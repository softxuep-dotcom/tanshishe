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
    { enemies: ['punk', 'punk', 'runner', 'tank'], simultaneous: 3 },
    { enemies: ['runner', 'punk', 'slinger', 'tank'], simultaneous: 3 },
    { enemies: ['tank', 'runner', 'slinger', 'punk'], simultaneous: 3 },
  ],
  [
    { enemies: ['punk', 'runner', 'tank', 'slinger'], simultaneous: 3 },
    { enemies: ['runner', 'runner', 'tank', 'punk', 'slinger'], simultaneous: 4 },
    { enemies: ['tank', 'tank', 'slinger', 'runner'], simultaneous: 4 },
  ],
];
export const REINFORCEMENTS = { delay: .6, entryTime: .45, lanes: [174, 200, 226] };
// Boss punish windows. `recovery` is read back by tests, so every boss keeps that key.
export const BOSS_RULES = {
  guardedDamageScale: .25,
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
// How close a boss walks before it will commit to a move.
export const BOSS_APPROACH: Record<string, { hold: number; speed: number; range: number }> = {
  boss: { hold: 29, speed: 38, range: 160 },
  longleg: { hold: 70, speed: 58, range: 102 },
  luchuan: { hold: 40, speed: 62, range: 108 },
  hanxiao: { hold: 44, speed: 56, range: 150 },
};
// Deterministic move order, so a fight reads the same way every attempt.
export const BOSS_MOVES: Record<string, readonly ('combo' | 'counter' | 'kick' | 'charge')[]> = {
  luchuan: ['combo', 'counter', 'combo'],
  hanxiao: ['combo', 'kick', 'charge'],
};
