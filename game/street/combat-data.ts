export type Role = 'chen' | 'tuo' | 'man';
export type AttackId = 'jab' | 'cross' | 'uppercut' | 'dash' | 'air' | 'slide' | 'lunge';
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
  /** Forward speed handed to the fighter when the advance ends, so the move glides to a stop. */
  momentum?: number;
  /** Whether this move may hit an enemy who is still in the air from a launch. */
  juggle?: boolean;
  /** Goes through a blocker's raised guard (low or charging moves). */
  guardBreak?: boolean;
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
  momentum: 200, guardBreak: true,
};
const air: AttackDefinition = {
  pose: 'kick', windup: .05, active: .08, recover: .14,
  advance: { start: 0, end: 0, speed: 0 }, comboWindow: null,
  reach: 63, lane: 23, height: { low: 8, high: 28 }, damageScale: 1.6, knockback: 38, impact: 180, launchSpeed: 0,
  juggle: true,
};
// Dodge follow-up: closes the gap the dodge just opened and starts a fresh ground chain.
const lunge: AttackDefinition = {
  pose: 'dash', windup: .06, active: .07, recover: .2,
  advance: { start: 0, end: .13, speed: 260 }, comboWindow: null,
  reach: 56, lane: 23, height: { low: 8, high: 38 }, damageScale: 1.5, knockback: 150, impact: 400, launchSpeed: 0,
  momentum: 120,
};
// Running jump: a low slide that trips whoever is standing, and keeps sliding afterwards.
const slide: AttackDefinition = {
  pose: 'slide', windup: .05, active: .22, recover: .26,
  advance: { start: 0, end: .27, speed: 300 }, comboWindow: null,
  reach: 42, lane: 24, height: { low: 0, high: 22 }, damageScale: 1.3, knockback: 260, impact: 1200, launchSpeed: 150,
  momentum: 150, guardBreak: true,
};
// Simulation seconds, not animation-frame counts. Future sprite clips follow this timeline.
export const ATTACKS: Record<Role, Record<AttackId, AttackDefinition>> = {
  chen: { jab: ground('punch', .05, .045, .175, 35), cross: ground('punch', .06, .05, .16, 45), uppercut: ground('uppercut', .075, .065, .20, 55, true), dash, air, slide, lunge },
  tuo: { jab: ground('punch', .06, .06, .22, 25), cross: ground('punch', .075, .065, .20, 35), uppercut: ground('uppercut', .09, .08, .23, 45, true), dash, air, slide, lunge },
  man: { jab: ground('punch', .04, .04, .14, 45), cross: ground('punch', .045, .045, .13, 55), uppercut: ground('uppercut', .06, .06, .16, 65, true), dash, air, slide, lunge },
};
export const GROUND_CHAIN: AttackId[] = ['jab', 'cross', 'uppercut'];
// A dodge stays cancel-into-attack for this long after its own recovery ends.
export const DODGE_FOLLOW = .35;
export const AIR_PHYSICS = { gravity: 600, takeoff: .04, landing: .08, downed: .30, rising: .18, throwSpeed: 180 };
export const JUMP_SPEED: Record<Role, number> = { chen: 200, tuo: 180, man: 215 };
// Accumulated impact is distinct from horizontal knockback velocity.
export const KNOCKBACK = {
  threshold: 600, weak: 60, recoveryDelay: 2, recoveryPerSecond: 180,
  minimumSpeed: 130, lift: 130, flightDrag: 1.5,
  collisionRadius: 24, collisionLane: 23, collisionMinSpeed: 60,
  collateralDamage: 25, collateralLift: 140, collateralSpeedScale: .55, juggleLift: 135,
  wallRestitution: .5, maxWallBounces: 1,
};
export interface HitImpact {
  amount: number;
  juggle?: boolean;
  launchSpeed?: number;
  pose?: 'launched' | 'thrown';
  collateral?: boolean;
}
export const attackDuration = (attack: AttackDefinition) => attack.windup + attack.active + attack.recover;
