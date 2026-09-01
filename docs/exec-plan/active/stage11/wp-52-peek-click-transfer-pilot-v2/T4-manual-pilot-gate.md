# WP-52 / T4 — Manual pilot gate and documentation

> Stage spec：[../README.md](../README.md) · WP spec：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md) · progress：[progress.md](progress.md)
> Format mirrors [wp-45's T-exit manual gate](../../stage9/wp-45-peek-click-transfer/T-exit-gate.md#manual-gate) — the same "automated evidence proves the mechanism; a human still has to feel it" split.

## Automated evidence (already green — see [progress.md](progress.md) Verification log)

- T1: config/id/seed/timing/visibility contract tests, scene-geometry clearance parity, 60/120/240 Hz determinism.
- T2: Session Plan free-selection UI accepts `'peek-click-transfer'`; `session-orchestrator.spec.ts` reaches eligibility gate with only that family selected.
- T3: evidence-report aggregator (synthetic fixture: timeout / first-miss-then-hit / pre-onset fire / no-counter); practice-only history guard.
- Full project `tsc --noEmit`, focused Vitest, and the relevant Playwright spec all pass — see [progress.md](progress.md).

None of this substitutes for a human actually playing the pilot. Automated tests prove the *mechanism* (config, wiring, math); they cannot prove pointer-lock feel, visual readability, or whether a real player's timing distribution is usable.

## How to reach it in the running app

`peek_click_transfer_pilot_v2_2deg` is registered as a researcher-mode drill (`main.ts` `availableDrills`, added 2026-09-01 alongside this checklist). To run it manually:

1. `npm run dev`, open `http://localhost:5173/` in Chrome or Edge.
2. Click **研究員模式** → **單一 Drill 調整**.
3. In the drill dropdown, select `peek_click_transfer_pilot_v2_2deg`.
4. Click into the canvas to engage Pointer Lock, then play through the countdown → cue → presentations as normal.
5. Use **Export JSON** after a run to inspect `meta.drillId` (`peek_click_transfer_pilot_v2_2deg`), `meta.visibility` (`{ sampleCount: 9, onsetThreshold: 0.5 }`), and confirm no `meta.assessment` field is present.

Only the 2° default candidate is wired to a menu entry, matching pilot v1's existing convention (v1 also only registers its 2° default in `availableDrills`); the 1.5°/3° candidates exist as configs (`buildPeekClickTransferPilotV2Config(1.5)` / `(3)`) but have no menu entry yet — comparing across candidates by feel currently requires a code-level harness call, same limitation v1 already has.

Session Plan's `'peek-click-transfer'` family checkbox (T2) still resolves to the **v1** drill (`SessionRunner.ts`'s `resolveFamilyDrillId`, unchanged from WP-45) — that family selection proves the KI-016 metadata gap is closed, not that it launches v2. Use the researcher-mode entry point above for v2 specifically.

## Manual gate (native pointer-lock, real human) — pending, not yet executed

- [ ] pointer lock engages cleanly from the Session Plan → eligibility gate flow for a `'peek-click-transfer'`-only selection (T2's real-DOM path only proves the flow reaches `#eligibility-gate`; going past it into a live pointer-locked round is unverified).
- [ ] center start position: both L/R targets read as visually hidden behind the corridor's center cover, matching `peek-ad-corridor.test.ts`'s geometric guarantee.
- [ ] A/D cue direction matches the side that actually becomes visible after strafing that direction.
- [ ] a shot fired from the hidden center position visibly does not register (tracer/impact stops at the cover), matching the hitscan-occlusion unit tests.
- [ ] after strafing the cued direction and reversing (counter-strafe) to brake, the target is reliably hittable — for all three angular-size candidates (1.5° feels meaningfully harder than 3°, not degenerate).
- [ ] a first miss allows a second shot before the target advances; a hit correctly advances to the next presentation.
- [ ] a full 20-presentation block completes in a reasonable, non-frustrating time; the 3000 ms spawn-anchored timeout does not feel arbitrarily punishing at any candidate size.
- [ ] nothing in the Result/export flow surfaces a composite score, `meta.assessment`, or a "you're being graded" framing — this is a practice pilot, and it should read as one to the player.
- [ ] no researcher-only debug affordance (drill id, seed, raw flags) leaks into the player-facing UI during a pilot run.

> These are the real pointer-lock/visual-feel acceptance items. They must be filled in by a researcher actually running the pilot — automated tests cannot stand in for them, and this file will not claim they passed until someone checks each box with a date and note.

## Sampling limitations and what T4 must not claim

See [analysis-peek-click-transfer.md §Pilot v2](../../../operational/analysis-peek-click-transfer.md#pilot-v2-wp-52) "Sampling limitations" for the full list. In short: no real human export exists in this repository yet; the evidence-report aggregator is proven correct on synthetic input only; a manual gate pass by one or two researchers walking through the checklist above is a smoke test, not a pilot sample — it cannot establish population-level completion/timeout/valid-first-shot rates, and must not be cited as such in a WP-53 freeze decision.

## WP-53 go/no-go

**No-go, pending manual execution.** This WP-52 pass delivers a pilot-v2 config, session wiring, and evidence tooling that are all mechanically verified — but zero real human trials have been run against it in this repository. WP-53 (formal `peek_click_transfer_v1` release) must not begin freezing numeric values until:

1. The manual gate checklist above is walked and dated by a researcher.
2. At least a minimum number of real participant pilot sessions (count deferred to OQ-52-4 — the researcher's call, not assumed here) are collected and run through `buildPeekClickTransferPilotEvidenceReport()`.
3. The resulting evidence report and manual-gate notes are attached to this file (or a dated addendum) before WP-53 T0 cites them.

This is recorded in [progress.md](progress.md) Decision log and mirrored in [stage11/progress.md](../progress.md).
