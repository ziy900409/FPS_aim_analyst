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

`peek_click_transfer_pilot_v2_2_5deg` (the 2.5° default, D-52.9) is registered as a researcher-mode drill (`main.ts` `availableDrills`, added 2026-09-01 alongside this checklist). To run it manually:

1. `npm run dev`, open `http://localhost:5173/` in Chrome or Edge.
2. Click **研究員模式** → **單一 Drill 調整**.
3. In the drill dropdown, select `peek_click_transfer_pilot_v2_2_5deg`.
4. Click into the canvas to engage Pointer Lock, then play through the countdown → cue → presentations as normal.
5. Use **Export JSON** after a run to inspect `meta.drillId` (`peek_click_transfer_pilot_v2_2_5deg`), `meta.visibility` (`{ sampleCount: 9, onsetThreshold: 0.5 }`), and confirm no `meta.assessment` field is present.

Each fixed-size candidate (1°/2.5°/5°) is also individually selectable from the same dropdown as `peek_click_transfer_pilot_v2_1deg` / `_2_5deg` / `_5deg`, matching pilot v1's per-candidate registration.

### Comparing candidates directly: the randomized cell (WP-52 T5)

`peek_click_transfer_pilot_v2_randomized` (same dropdown) interleaves all three angular-size candidates within one 21-trial run — a seeded balanced shuffle guarantees exactly 7 presentations per candidate, in random order rather than one fixed size per drill. This was added specifically so a researcher can feel the size contrast directly instead of switching between three separate drills. Export JSON afterward and check that presentations show varying implicit hitbox sizes (visible indirectly via hit difficulty; the raw `hitboxWidthU` only appears in the raw `events[].visible` records, not summarized in `meta`) — `buildPeekClickTransferPilotEvidenceReport()`'s `byCandidate` breakdown (pass `peekClickTransferPilotV2CandidateLabel` as `candidateLabelForWidth`) is the intended way to see per-candidate rates from a batch of these runs.

Session Plan's `'peek-click-transfer'` family checkbox (T2) still resolves to the **v1** drill (`SessionRunner.ts`'s `resolveFamilyDrillId`, unchanged from WP-45) — that family selection proves the KI-016 metadata gap is closed, not that it launches v2. Use the researcher-mode entry points above for v2 specifically.

## Manual gate (native pointer-lock, real human) — ✅ completed 2026-09-01

**2026-09-01**：使用者（研究者本人）親自走查以下 9 項並全數勾選通過，對應 3 場 `peek_click_transfer_pilot_v2_masked` 真人 session（見下方「Evidence collected」，匯出檔名列於該節）。第 5 項「1° 應明顯比 5° 難，不能退化」有實測數據直接佐證：詳下節 per-candidate `validFirstShotRate`（1°=42.9% vs 5°=100%），差距明確、非退化。

- [x] pointer lock engages cleanly from the Session Plan → eligibility gate flow for a `'peek-click-transfer'`-only selection (T2's real-DOM path only proves the flow reaches `#eligibility-gate`; going past it into a live pointer-locked round is unverified).
- [x] center start position: both L/R targets read as visually hidden behind the corridor's center cover, matching `peek-ad-corridor.test.ts`'s geometric guarantee.
- [x] A/D cue direction matches the side that actually becomes visible after strafing that direction.
- [x] a shot fired from the hidden center position visibly does not register (tracer/impact stops at the cover), matching the hitscan-occlusion unit tests.
- [x] after strafing the cued direction and reversing (counter-strafe) to brake, the target is reliably hittable — for all three angular-size candidates (1°/2.5°/5°, D-52.9's widened spread; 1° should feel meaningfully harder than 5°, not degenerate — this was the exact complaint about the original 1.5°/2°/3° set that motivated the widening).
- [x] a first miss allows a second shot before the target advances; a hit correctly advances to the next presentation.
- [x] a full 20-presentation block completes in a reasonable, non-frustrating time; the 3000 ms spawn-anchored timeout does not feel arbitrarily punishing at any candidate size.
- [x] nothing in the Result/export flow surfaces a composite score, `meta.assessment`, or a "you're being graded" framing — this is a practice pilot, and it should read as one to the player.
- [x] no researcher-only debug affordance (drill id, seed, raw flags) leaks into the player-facing UI during a pilot run.

> These are the real pointer-lock/visual-feel acceptance items. They must be filled in by a researcher actually running the pilot — automated tests cannot stand in for them, and this file will not claim they passed until someone checks each box with a date and note.

## Evidence collected (2026-09-01)

**n = 1 participant (the researcher), 3 sessions**, all `peek_click_transfer_pilot_v2_masked` (fixed 2.5° reference `visualSize`, true hitbox varying 1°/2.5°/5° per the balanced-shuffle candidate sequence, `rngSeed` 95200 — same seeded presentation order replayed 3 times, so these are 3 independent performance draws over the identical stimulus sequence, not 3 independent stimulus samples). Exported files (not committed to the repo — personal export paths):

1. `peek_click_transfer_pilot_v2_masked-2026-09-01T13_20_18.816Z.json`
2. `peek_click_transfer_pilot_v2_masked-2026-09-01T13_21_04.339Z.json`
3. `peek_click_transfer_pilot_v2_masked-2026-09-01T13_21_41.696Z.json`

Processed through `derivePeekClickTransferMetrics()` (against the real `peek-ad-corridor-v1` scene, `{ sampleCount: 9, onsetThreshold: 0.5 }`) then `buildPeekClickTransferPilotEvidenceReport()` (`candidateLabelForWidth: peekClickTransferPilotV2CandidateLabel`):

| | presentations | completionRate | timeoutRate | validFirstShotRate | L/R |
|---|---|---|---|---|---|
| **Aggregate** | 63 | 100% | 0% | 79.4% | 33L / 30R |
| 1° | 21 | 100% | 0% | **42.9%** | 6L / 15R |
| 2.5° | 21 | 100% | 0% | 95.2% | 12L / 9R |
| 5° | 21 | 100% | 0% | **100%** | 15L / 6R |

No flags fired across any presentation (no `timeout`, `no_counter`, `fire_before_gate`, etc.) — every non-valid first shot was a plain miss on the smaller target, not a gating/mechanism problem. Per-session `validFirstShotRate` (71.4% / 81.0% / 85.7%) trended upward run-over-run, consistent with a practice/learning effect across 3 back-to-back sessions on an identical seeded sequence.

**Reads on the manual gate items this substantiates:**
- Item 5 (1° meaningfully harder than 5°, not degenerate): **confirmed empirically** — 42.9% vs 100% valid-first-shot is a clear, non-degenerate gap. D-52.9's widening (from 1.5/2/3° to 1/2.5/5°) achieved its goal, and the masked-visual variant shows this difficulty gradient survives even when the render size is held constant (i.e., the participant isn't reading the gap off a visual size cue — it's a real aiming-difficulty effect).
- Items 1–4/6–9 (pointer lock, occlusion, cue direction, shot-from-cover, miss/hit advance, pacing, no score/debug leak): 100% completion / 0% timeout across all 63 presentations is consistent with (but does not by itself prove) a smooth mechanical experience; the checkbox confirmations above are the actual attestation for those.

## Sampling limitations and what T4 must not claim

See [analysis-peek-click-transfer.md §Pilot v2](../../../operational/analysis-peek-click-transfer.md#pilot-v2-wp-52) "Sampling limitations" for the full list. **Still applies after the 2026-09-01 evidence above**: this is one participant across three sessions on one repeated seeded sequence — a smoke test with a real difficulty-gradient signal, not a population-level pilot sample. It establishes that the mechanism, gating, and candidate spread all behave sanely for at least one player; it does **not** establish population-level completion/timeout/valid-first-shot rates or inter-participant variance, and must not be cited as if it did in a WP-53 freeze decision unless the researcher (OQ-52-4) explicitly decides n=1 is sufficient for that decision's purposes.

## WP-53 go/no-go

**Manual gate: ✅ done (2026-09-01).** Evidence collection: ✅ 1 participant / 3 sessions attached above, but this is exactly the "one or two researchers" case the Sampling limitations section already flags as a smoke test, not a population-level pilot sample. Per this file's original three conditions:

1. ✅ The manual gate checklist above is walked and dated by a researcher (2026-09-01).
2. 🟡 Real participant pilot sessions collected and run through `buildPeekClickTransferPilotEvidenceReport()` — done for n=1 (this researcher, 3 sessions). Whether n=1 is *enough* to declare the OQ-52-4 threshold met is the researcher's call, not assumed here.
3. ✅ The resulting evidence report and manual-gate notes are attached to this file (above), dated 2026-09-01.

**Formal status change from "No-go" is pending the researcher's explicit OQ-52-4 call on whether n=1 clears the bar.** See [stage11/README.md §6](../README.md) for where that decision, once made, must also be reflected.

This is recorded in [progress.md](progress.md) Decision log and mirrored in [stage11/progress.md](../progress.md).
