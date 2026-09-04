# WP-56 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | Not started | — | — | — |
| T1 Contract and Fixtures | Blocked by T0 | — | — | — |
| T2 Three-target Lifecycle | Blocked by T1 | — | — | — |
| T3 Corridor Scene and Presentation | Blocked by T0/T1 | — | — | — |
| T4 Fixed Player, Hit and HUD | Blocked by T1–T3 | — | — | — |
| T5 Automated Integration and Performance | Blocked by T2–T4 | — | — | — |
| T6 Visual Acceptance | Blocked by T3–T5 | — | — | — |
| T-exit | Blocked by T1–T6 | — | — | — |

## Decision Log

| ID | Date | Decision | Owner | Evidence |
|---|---|---|---|---|
| D-56.P1 | 2026-09-04 | 場景是固定位置的灰白狹長 Micro Flick 走廊，同時三顆紅色球形目標，命中後補位 | 使用者 | 對影片理解的明確確認 |
| D-56.P2 | 2026-09-04 | 不製作槍枝模型；規劃同時排除手臂／weapon view model | 使用者 | 原始需求 + 確認訊息 |
| D-56.P3 | 2026-09-04 | 規劃文件採 stage10/WP-50 的 README、checklist、progress、T0～T6、T-exit 結構 | 使用者 | 本文件組 |
| D-56.P4 | 2026-09-04 | v1 recommended default 為 researcher-only／practice；不宣稱 Assessment 或 full replay | Planning default，待OQ-56.4 | README §1.4/§3.2 |

## Open Questions（狀態）

| ID | Status | Owner | Deadline | Notes |
|---|---|---|---|---|
| OQ-56.1 | Resolved | 使用者 | 2026-09-04 | 核心場景／玩法／no-gun scope已確認 |
| OQ-56.2 | Open | 使用者 + Gameplay owner | T0 exit | FOV、spawn field、球體尺寸、separation |
| OQ-56.3 | Open | Gameplay owner | T0 exit | quota vs time-limit |
| OQ-56.4 | Open/non-blocking for v1 | Product/Research owner | T-exit | 是否另開 Assessment/full-replay WP |
| OQ-56.5 | Open | 使用者 | T4 start | 是否需要影片式進階HUD；default否 |

## Planning Evidence（2026-09-04）

- `DrillConfig` 約115 consumers、`SceneConfig` 約79 consumers；新契約須 additive/optional。
- `TargetManager` 目前以 `hasAliveTarget()` 限制單 active；三靶是 engine lifecycle change，不是純 config。
- `SpawnAreaConfig` 缺 vertical/pitch；現有 target center固定 `TARGET_Y=1.5`。
- `HitDetector.raycastWithRay()` 已支援多 active targets並取最近命中。
- `TargetView` 已有 sphere geometry與mesh pool，可重用到三靶。
- `Crosshair` 已固定screen center且與camera中心射線同源。
- 現有 live scene graph沒有第一人稱槍／手view model；no-gun以asset/scene regression守住。
- WP-50 replay既有官方 profile/capture以單target為基礎，故v1保持practice-only。

## T0 Evidence Log

尚未開始。開工後記錄：HEAD、working tree、CodeGraph impact、baseline commands、數值候選、PoC路徑、最壞seed、asset budget、owner decisions與artifact cleanup。

## T1 Evidence Log

尚未開始。

## T2 Evidence Log

尚未開始。

## T3 Evidence Log

尚未開始。

## T4 Evidence Log

尚未開始。

## T5 Evidence Log

尚未開始。

## T6 Evidence Log

尚未開始。

## T-exit Evidence Log

尚未開始。

