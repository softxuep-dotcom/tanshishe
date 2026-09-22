// Digital D-pad in the style of TMNT: Shredder's Revenge mobile: a dead centre, then one of
// eight directions at full walking speed. Distances are relative to the drawn pad's radius.
const PAD_DIRS = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur'] as const;
export function readDpad(x: number, y: number, radius: number) {
  if (Math.hypot(x, y) < Math.max(1, radius) * .22) return { x: 0, y: 0, dir: '' };
  const sector = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8, angle = sector * Math.PI / 4;
  // `+ 0` folds -0 into 0 so callers can compare directions directly.
  return { x: Math.round(Math.cos(angle) * 1000) / 1000 + 0, y: Math.round(Math.sin(angle) * 1000) / 1000 + 0, dir: PAD_DIRS[sector] };
}

export class DoublePushRun {
  private direction = 0;
  private lastDirection = 0;
  private lastPush = -Infinity;
  private running = false;
  reset() {
    this.direction = 0; this.lastDirection = 0;
    this.lastPush = -Infinity; this.running = false;
  }
  update(x: number, y: number, nowMs: number) {
    const length = Math.hypot(x, y);
    // Return to the center before another push; edge jitter is not a second tap.
    if (length < .12) { this.direction = 0; this.running = false; return false; }
    if (Math.abs(y) > Math.abs(x)) { this.reset(); return false; }
    if (this.direction && Math.sign(x) !== this.direction) this.running = false;
    if (Math.abs(x) < .5) return this.running && Math.sign(x) === this.direction;
    const direction = Math.sign(x);
    if (direction !== this.direction) {
      this.running = this.direction === 0 && direction === this.lastDirection &&
        nowMs - this.lastPush >= 0 && nowMs - this.lastPush <= 280;
      this.lastDirection = direction; this.lastPush = nowMs;
      this.direction = direction;
    }
    return this.running;
  }
}

// Once a captured attack pointer leaves its circular button, it cannot resume
// until a new press. Other fingers (including the movement stick) are ignored.
export class AttackHold {
  private pointer: number | null = null;
  reset() { this.pointer = null; }
  begin(id: number) { if (this.pointer !== null) return false; this.pointer = id; return true; }
  end(id: number) { if (this.pointer !== id) return false; this.reset(); return true; }
  move(id: number, x: number, y: number, bounds: { left: number; top: number; width: number; height: number }) {
    if (this.pointer !== id) return false;
    const dx = (x - bounds.left - bounds.width / 2) / (bounds.width / 2);
    const dy = (y - bounds.top - bounds.height / 2) / (bounds.height / 2);
    if (dx * dx + dy * dy <= 1) return false;
    this.reset(); return true;
  }
}
