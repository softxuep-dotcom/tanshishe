// Distances are normalized to the visible stick radius, not device pixels.
export function readStick(x: number, y: number, radius: number) {
  const length = Math.hypot(x, y);
  const distance = length / Math.max(1, radius);
  const strength = Math.min(1, Math.max(0, (distance - .16) / .66));
  return {
    x: length ? x / length * strength : 0,
    y: length ? y / length * strength : 0,
    knobX: length ? x / length * Math.min(length, radius) : 0,
    knobY: length ? y / length * Math.min(length, radius) : 0,
  };
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
