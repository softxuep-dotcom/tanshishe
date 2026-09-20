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
];
export const REINFORCEMENTS = { delay: .6, entryTime: .45, lanes: [174, 200, 226] };
export const BOSS_RULES = {
  guardedDamageScale: .25,
  boss: { recovery: 1.2, active: .68 },
  longleg: { recovery: .95, active: .18 },
};
