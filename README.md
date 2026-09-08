# 拖车大逃亡 / Cargo Escape

Mobile-first playable prototype. Run `npm install`, then `npm run dev`.

The current warehouse prototype is a control and convoy-following experiment. The approved next concept is documented in [车队劫持开发计划](docs/CONVOY_HEIST_PLAN.md); do not expand the warehouse loop as production content.

## Controls

- Mobile: drag the left joystick toward the direction to drive; release to keep the current heading. The truck moves automatically.
- Desktop: left/right arrows steer relative to the truck.
- Hold the right boost button (or Space) for a speed burst. Energy is finite and regenerates. Release after exhaustion to re-arm boost.
- Two computer-controlled transport vehicles follow routes. Cross their path with a trailer to spill three loot items, including gold; a head-on collision costs up to two trailers. Disabled vehicles recover after a visible countdown.
- Consecutive pickups within 3.2 seconds build a visible collection chain. Each pickup restores boost energy.
- Delivery awards one/two/three stars for 6/12/18 trailers.
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

V2 validation: 10 simulation checks, 390×844 and 375×667 browser views, two-finger joystick plus boost input, pause timer, pointer release and restart. Browser simulation does not replace physical-phone feedback.
