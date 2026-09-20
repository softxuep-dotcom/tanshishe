// Distances are normalized to the visible stick radius, not device pixels.
export function readStick(x: number, y: number, radius: number, wasSprinting: boolean) {
  const length = Math.hypot(x, y);
  const distance = length / Math.max(1, radius);
  const strength = Math.min(1, Math.max(0, (distance - .16) / .66));
  const horizontal = length > 0 && Math.abs(x) / length > .65;
  const sprint = horizontal && distance >= (wasSprinting ? .78 : 1.05);
  return {
    x: length ? x / length * strength : 0,
    y: length ? y / length * strength : 0,
    knobX: length ? x / length * Math.min(length, radius) : 0,
    knobY: length ? y / length * Math.min(length, radius) : 0,
    sprint,
  };
}
