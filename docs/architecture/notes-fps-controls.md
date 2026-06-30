# FPS controls / Pointer Lock notes for WP-1

> Scope: WP-0 T5 reference note for WP-1. This is not implementation code.
> Canonical project terms follow `CONTEXT.md`: `InputSampler`, `SharedState`, `SimLoop`, `RenderLoop`, `ring buffer`, `two-clock model`, `原始輸入`, and `coalesced events`.

## Sources checked

- three.js r185 `PointerLockControls` source: https://github.com/mrdoob/three.js/blob/r185/examples/jsm/controls/PointerLockControls.js
- three.js r185 pointer lock example: https://github.com/mrdoob/three.js/blob/r185/examples/misc_controls_pointerlock.html
- three.js r185 FPS example: https://github.com/mrdoob/three.js/blob/r185/examples/games_fps.html
- MDN `Element.requestPointerLock()`: https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock
- MDN `pointerlockchange` / `pointerlockerror`: https://developer.mozilla.org/en-US/docs/Web/API/Document/pointerlockchange_event and https://developer.mozilla.org/en-US/docs/Web/API/Document/pointerlockerror_event
- MDN `PointerEvent.getCoalescedEvents()`: https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents
- web.dev raw mouse input article: https://web.dev/articles/disable-mouse-acceleration
- FPS-style reference repo: https://github.com/davidinfante/First-Person-Shooter-JS

## WP-1 decisions to carry forward

1. **Pointer Lock lifecycle belongs to the input layer.** A canvas click should request lock. `lock` hides the blocker and enables `InputSampler`; `unlock` shows the blocker and stops accepting mouse deltas until the next user gesture.
2. **Mouse deltas are samples, not simulation commands.** WP-1 should write numeric mouse/key samples into the input `ring buffer`; `SimLoop` consumes by `event.timeStamp` bucket and updates `SharedState`.
3. **Use `performance.now()` for local timing.** Any manually stamped event uses the measurement clock. Do not introduce `Date.now()`. Browser event `timeStamp` stays in the same time-origin assumption as the project `two-clock model` while Stage A remains Chrome/Edge desktop.
4. **Do not let controls call sim directly.** `PointerLockControls` and DOM listeners may update camera-facing input state or enqueue samples, but they must not call `MovementController`, `HitDetector`, `TargetManager`, or `DataRecorder`.
5. **Prefer raw delta ownership over `moveForward()` / `moveRight()` for WP-1 movement.** three.js helper movement mutates camera position directly. This conflicts with `SharedState` as the only communication path and with `SimLoop` owning velocity/counter-strafe state.

## Pointer Lock lifecycle

Facts from MDN and three.js r185:

- `requestPointerLock()` is asynchronous and success/failure must be observed through document-level `pointerlockchange` / `pointerlockerror`. Some browsers expose a Promise shape, but MDN notes this is not uniformly implemented.
- A transient user activation is required. In WP-1, the stable trigger is `canvas.addEventListener('click', ...)`; do not auto-lock from bootstrap or after timeout.
- The browser default unlock gesture, typically Esc, exits lock. Focus loss can also produce unlock-like recovery work from the app's point of view. Treat every `unlock` event as authoritative.
- `PointerLockControls.lock(unadjustedMovement = false)` calls `requestPointerLock({ unadjustedMovement })`; `unlock()` calls `exitPointerLock()`.
- The control dispatches `change` on mouse movement, and `lock` / `unlock` when `document.pointerLockElement` matches or stops matching the control element. It also exposes `isLocked`.

WP-1 flow:

```ts
canvas click
  -> try lock(true) for 原始輸入
  -> if NotSupportedError or unsupported Promise shape, retry lock(false)
  -> on lock: SharedState.input.pointerLocked = true
  -> on unlock/error: SharedState.input.pointerLocked = false, clear pressed-key latch policy explicitly
```

Important pitfall: after the user releases pointer lock with the browser default gesture, re-lock still needs another user gesture. WP-1 should show the blocker and wait for click rather than retrying in a loop.

## Raw mouse input and yaw/pitch

`unadjustedMovement: true` is the project target for `原始輸入`: it disables OS-level mouse acceleration where supported. web.dev documents Chromium support and a `NotSupportedError` retry path; this matches the project Stage A browser constraint. WP-1 should implement best-effort raw input:

```ts
async function requestRawLock(canvas: HTMLCanvasElement) {
  try {
    await canvas.requestPointerLock({ unadjustedMovement: true });
  } catch (error) {
    if ((error as DOMException).name === 'NotSupportedError') {
      await canvas.requestPointerLock();
      return;
    }
    throw error;
  }
}
```

The code above is a WP-1 shape, not copied from three.js. If a browser returns `void` instead of a Promise, the same state must still be driven by `pointerlockchange` / `pointerlockerror`.

three.js `PointerLockControls` uses `movementX/Y`, a sensitivity multiplier, and clamps pitch through `minPolarAngle` / `maxPolarAngle` to avoid camera inversion. WP-1 should keep the same invariant, but it should make yaw/pitch part of `SharedState` or a narrow input/render state owned by the app:

- yaw accumulates from horizontal delta.
- pitch accumulates from vertical delta.
- pitch is clamped before writing the camera quaternion or `RenderSnapshot`.
- sensitivity is a `DrillConfig` or app setting, not hidden inside the control instance.

High-risk point: do not rely on the default `minPolarAngle = 0` and `maxPolarAngle = Math.PI` without a project-level pitch limit decision. A training tool should pick an explicit clamp so no future three.js default change affects aim behavior.

## Input collection and the true ring buffer

The reference examples keep booleans like `moveForward` / `keyStates` and apply `deltaTime` in the render loop. That is normal for demos, but it is not enough for this project because counter-strafe metrics need event ordering and timing.

WP-1 should use the project `ring buffer` contract:

- `InputSampler` listens to `keydown`, `keyup`, `pointermove`, `pointerrawupdate` where available, and fire/mouse button events.
- Each event becomes a fixed numeric record such as `type,t,a,b`; no per-event object `push` during drills.
- `t` is `event.timeStamp` when available, otherwise `performance.now()`. Never use `Date.now()`.
- `SimLoop` consumes by logical tick window `[tickStart, tickEnd)`, sorts equal-bucket samples by timestamp, and records `lateEventCount` / `bufferOverflow`.
- `pointermove` can be the WP-1 baseline. `getCoalescedEvents()` should be treated as a WP-3 upgrade path for sub-frame mouse samples, because MDN documents that browsers may coalesce many pointer updates into one event.

WP-1 must decide whether to listen to `mousemove` under pointer lock, `pointermove`, or both. three.js `PointerLockControls` uses `mousemove`; the project wants coalesced sample support later, so an app-owned sampler that can switch event source is safer than binding all behavior to the control class.

## SharedState boundary and controls tradeoff

`PointerLockControls` offers useful lifecycle behavior and proven yaw/pitch math, but its movement helpers are a mismatch for the project:

- `moveForward(distance)` and `moveRight(distance)` mutate camera position.
- This bypasses `MovementController`, `SimLoop`, `RenderSnapshot`, and `DataRecorder`.
- It would make `counter-strafe`, `residual speed`, and `停火時序對齊` depend on render-frame timing, not fixed-timestep consumption.

Recommended WP-1 split:

- Use browser Pointer Lock directly or wrap `PointerLockControls` only for lock state and yaw/pitch reference behavior.
- Do not call `controls.moveForward()` or `controls.moveRight()` for A/D movement.
- Let `InputSampler` enqueue A/D key transitions and mouse delta samples.
- Let `SimLoop` update velocity and aim/crosshair state through `SharedState`.
- Let `RenderLoop` read `RenderSnapshot` and apply camera orientation/position for display only.

This preserves ADR-2: input/render and sim are separate loops, with `SharedState` as the only bridge.

## Stage A Chrome/Edge desktop impact

Stage A deliberately targets Chrome/Edge desktop. That narrows WP-1 risk:

- `event.timeStamp` and `performance.now()` are treated as directly comparable in Chromium, matching `CONTEXT.md`'s two-clock model note.
- `unadjustedMovement` is viable enough to implement and test on Chrome/Edge, with fallback to adjusted pointer lock.
- Pointer Lock UX can assume desktop keyboard/mouse. Touch, Safari, Firefox-specific behavior, iframe sandboxing, and mobile browser QA remain out of scope.

But the browser constraint does not remove all UX state work. Browser permission and user-activation policy can still produce lock failures, so WP-1 should treat `pointerlockerror` as a normal recoverable state and keep a visible click-to-retry blocker.

## WP-1 pending questions / risks

- **R1: raw input fallback policy.** If `unadjustedMovement` fails, should the drill continue with adjusted movement and mark metadata, or block the drill? Recommendation: continue for development, but write `rawInput=false` into metadata once WP-7 exists.
- **R2: pitch clamp value.** Need a project explicit `minPitch/maxPitch` before implementation. Do not inherit three.js defaults silently.
- **R3: pointer event source.** `mousemove` matches three.js controls; `pointermove` enables `getCoalescedEvents()`. Decide whether WP-1 starts with `mousemove` plus a future adapter, or begins with pointer events and keeps a fallback.
- **R4: unlock recovery semantics.** On `unlock`, decide whether pressed keys are cleared immediately or preserved until real `keyup`. For training validity, clearing is safer because hidden pointer state plus stuck keys can corrupt a peek.
- **R5: render camera ownership.** If yaw/pitch is applied immediately in render for feel, `SimLoop` still needs the exact samples for metrics. The architecture must avoid two divergent aim states.
- **R6: fire event ordering.** Mouse button events and coalesced movement samples in the same tick must be sorted by timestamp before `HitDetector` raycast so `準心對齊偏移` remains sub-tick faithful.
- **R7: permissions and user gesture changes.** Browser policy can change. Keep Playwright coverage for click-to-lock, Esc unlock, relock after click, and error UI once WP-1 exists.

## T5 conclusion

WP-1 should not adopt an off-the-shelf FPS control loop wholesale. The safe path is to use Pointer Lock as a browser capability, copy the proven yaw/pitch invariants, and keep all movement and metric-relevant input inside the project `InputSampler` -> `ring buffer` -> `SimLoop` -> `SharedState` path.
