// 陈野序列帧：图集由 output/art/chen/build_chen_sprites.py 从豆包视频抽帧生成。
// 格子和锚点按 docs/ANIMATION_SPEC.md：128×96，脚底中心在 (48, 90)，朝右画，朝左由渲染层镜像。
export const CHEN_SHEET = { frameWidth: 128, frameHeight: 96, anchorX: 48, anchorY: 90 } as const;

export type ChenLoop = 'idle' | 'walk' | 'run';
export type ChenAttack = 'jab' | 'cross' | 'uppercut';
export type ChenAnim = ChenLoop | ChenAttack;

/** Sheet frame numbers, in the order the build script packs them. */
export const CHEN_FRAMES: Record<ChenAnim, readonly number[]> = {
  idle: [0, 1, 2, 3], walk: [4, 5, 6, 7, 8, 9], run: [10, 11, 12, 13, 14, 15],
  jab: [16, 17, 18, 19], cross: [20, 21, 22, 23], uppercut: [24, 25, 26, 27],
};
/** Loop frame length in seconds (ANIMATION_SPEC.md: idle 160ms, walk 100ms, run 70ms). */
export const CHEN_LOOP_FRAME: Record<ChenLoop, number> = { idle: .16, walk: .1, run: .07 };

export function chenLoopFrame(anim: ChenLoop, time: number) {
  // The epsilon keeps 0.6 / 0.1 from landing on 5.999… and holding a frame one step too long.
  const frames = CHEN_FRAMES[anim], step = Math.floor(Math.max(0, time) / CHEN_LOOP_FRAME[anim] + 1e-9);
  return frames[step % frames.length];
}

/**
 * Attacks follow the simulation's own phases, not fixed milliseconds, so the ★ frame is on screen
 * exactly while the hit can land: windup → frame 0, active → frame 1 (★), recovery split in two.
 */
export function chenAttackFrame(anim: ChenAttack, elapsed: number, windup: number, active: number, recover: number) {
  const frames = CHEN_FRAMES[anim];
  if (elapsed < windup) return frames[0];
  if (elapsed < windup + active) return frames[1];
  return frames[elapsed < windup + active + recover / 2 ? 2 : 3];
}

export interface ChenStrikeTiming { elapsed: number; windup: number; active: number; recover: number; }
export function chenFrame(anim: ChenAnim, time: number, strike: ChenStrikeTiming | null) {
  if (anim === 'idle' || anim === 'walk' || anim === 'run') return chenLoopFrame(anim, time);
  return strike ? chenAttackFrame(anim, strike.elapsed, strike.windup, strike.active, strike.recover) : CHEN_FRAMES[anim][0];
}

export interface ChenPoseInput {
  role: string; hp: number; pose: string; motion: string; height: number;
  carrying: boolean; attack: string | null; moving: boolean; running: boolean;
}
/** Which drawn animation covers the hero right now; null falls back to the programmatic figure. */
export function chenAnimFor(s: ChenPoseInput): ChenAnim | null {
  if (s.role !== 'chen' || s.hp <= 0 || s.motion !== 'grounded' || s.height > 0 || s.carrying) return null;
  if (s.attack) return s.attack === 'jab' || s.attack === 'cross' || s.attack === 'uppercut' ? s.attack : null;
  // A punch pose can outlive its strike by a frame; anything else (hurt, grab, dodge, specials) is not drawn yet.
  if (s.pose !== 'idle' && s.pose !== 'punch' && s.pose !== 'uppercut') return null;
  return s.running ? 'run' : s.moving ? 'walk' : 'idle';
}
