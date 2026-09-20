export type Role = 'chen' | 'tuo' | 'man';
export type AttackId = 'jab' | 'cross' | 'uppercut' | 'dash' | 'air';
export interface AttackDefinition {
  pose: string;
  windup: number;
  active: number;
  recover: number;
  advance: { start: number; end: number; speed: number };
  comboWindow: { open: number; close: number } | null;
  reach: number;
  lane: number;
  height: { low: number; high: number };
  damageScale: number;
  knockback: number;
  impact: number;
  launchSpeed: number;
}

const ground = (pose: string, windup: number, active: number, recover: number, speed: number, finisher = false): AttackDefinition => ({
  pose, windup, active, recover,
  advance: { start: windup, end: windup + active, speed },
  comboWindow: finisher ? null : { open: windup + active, close: windup + active + recover - .035 },
  reach: 48, lane: 23, height: { low: 12, high: 40 },
  damageScale: finisher ? 1.6 : 1, knockback: finisher ? 185 : 38, impact: finisher ? 600 : 60, launchSpeed: finisher ? 180 : 0,
});
const dash: AttackDefinition = {
  pose: 'dash', windup: .065, active: .08, recover: .285,
  advance: { start: 0, end: .12, speed: 240 }, comboWindow: null,
  reach: 65, lane: 23, height: { low: 8, high: 40 }, damageScale: 2, knockback: 350, impact: 1200, launchSpeed: 200,
};
const air: AttackDefinition = {
  pose: 'kick', windup: .05, active: .08, recover: .14,
  advance: { start: 0, end: 0, speed: 0 }, comboWindow: null,
  reach: 63, lane: 23, height: { low: 8, high: 28 }, damageScale: 1.6, knockback: 38, impact: 180, launchSpeed: 0,
};
// Simulation seconds, not animation-frame counts. Future sprite clips follow this timeline.
export const ATTACKS: Record<Role, Record<AttackId, AttackDefinition>> = {
  chen: { jab: ground('punch', .05, .045, .175, 35), cross: ground('punch', .06, .05, .16, 45), uppercut: ground('uppercut', .075, .065, .20, 55, true), dash, air },
  tuo: { jab: ground('punch', .06, .06, .22, 25), cross: ground('punch', .075, .065, .20, 35), uppercut: ground('uppercut', .09, .08, .23, 45, true), dash, air },
  man: { jab: ground('punch', .04, .04, .14, 45), cross: ground('punch', .045, .045, .13, 55), uppercut: ground('uppercut', .06, .06, .16, 65, true), dash, air },
};
export const GROUND_CHAIN: AttackId[] = ['jab', 'cross', 'uppercut'];
export const AIR_PHYSICS = { gravity: 600, takeoff: .04, landing: .08, downed: .30, rising: .18, throwSpeed: 180 };
export const JUMP_SPEED: Record<Role, number> = { chen: 200, tuo: 180, man: 215 };
// Accumulated impact is distinct from horizontal knockback velocity.
export const KNOCKBACK = {
  threshold: 600, weak: 60, recoveryDelay: 2, recoveryPerSecond: 180,
  minimumSpeed: 130, lift: 130, flightDrag: 1.5,
  collisionRadius: 24, collisionLane: 23, collisionMinSpeed: 60,
  collateralDamage: 25, collateralLift: 140, collateralSpeedScale: .55,
  wallRestitution: .5, maxWallBounces: 1,
};
export interface HitImpact {
  amount: number;
  launchSpeed?: number;
  pose?: 'launched' | 'thrown';
  collateral?: boolean;
}
export const attackDuration = (attack: AttackDefinition) => attack.windup + attack.active + attack.recover;
