# 拖车大逃亡 / Cargo Escape

Mobile-first playable prototype. Run `npm install`, then `npm run dev`.

## Controls

- The truck moves automatically. Hold left/right to steer relative to the truck.
- Hold the center button (or Space) to slow down and take tighter turns.
- Collect 6 trailers and drive through the top exit before 120 seconds expire.
- Once the truck enters the exit, delivery assist pulls the whole train out and freezes the timer.
- Trailers disconnect after sustained shelf contact. Drive near dropped cargo to recover it.
- Self-crossing is allowed in this prototype. The exit assist ignores further trailer damage.
- Switching tabs pauses play. Best successful delivery is stored on this device if storage is available.

## Structure and validation

- `game/simulation.ts`: movement, trailer constraints, pickups, collisions, timer, and scoring.
- `game/renderer.ts`: Phaser rendering and feedback; loaded only in the browser.
- `app/page.tsx`: touch/keyboard input and responsive DOM HUD.
- `node --test game/simulation.test.mjs`: movement, recovery, pause, failure, delivery, and a complete steering route. Requires Node 22.18+.
- `npm run build`: production build. `npx tsc --noEmit`: type checking.

This is a gameplay prototype, without Poki SDK integration or submission.

Optional WebMCP read/pause tools are feature-detected. Their live browser contract has not been verified in a supported WebMCP context; ordinary gameplay does not depend on them. Physical mobile device playtesting is pending user feedback.
