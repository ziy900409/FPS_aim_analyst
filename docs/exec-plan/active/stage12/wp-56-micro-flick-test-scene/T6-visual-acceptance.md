# WP-56 T6 — Visual Acceptance／Reference Review

## Objective

在自動語意與效能 gates通過後，以固定環境的1080p/720p畫面確認走廊構圖、材質層次、三靶辨識度與no-weapon scope；人工review只負責視覺選擇，不取代核心行為tests。

## Capture matrix

| Viewport | Seed/keyframe | Required capture |
|---|---|---|
| 1920×1080 | frozen seed，initial 3 targets | 全畫面、無UI debug overlays |
| 1920×1080 | first hit後replacement | survivors + replacement位置 |
| 1280×720 | frozen seed，initial 3 targets | responsive/safe-region畫面 |
| 1920×1080 | asset fallback | 可操作fallback/error evidence |

## Review checklist

- 走廊狹長、左右對稱，主要panel/ceiling/floor線條朝中央消失點收斂。
- floor/side walls/end wall明亮但仍可分面；ceiling較深且不壓暗targets。
- panel seams規則、低干擾，沒有裝飾物、掩體、自然景觀或視覺噪音。
- 三顆紅色球在上／中／下與左右範圍可辨識，不重疊、不切viewport邊界。
- 綠色Crosshair清楚且位於screen center；target被準星遮住時仍可辨識輪廓。
- 畫面沒有槍、手臂、hands、muzzle、weapon shadow或weapon UI；沒有Kovaak editor、FPS counter、ammo bar。
- HUD若沿用，只顯示README允許的現有metrics，且不遮住spawn safe region。

## Evidence rules

- 記錄commit、browser/version、GPU/backend、DPR、viewport、seed、drill/scene asset version。
- approved screenshot存放位置須由T0/T6決定；不得提交使用者原影片或未授權第三方影格。
- 若pixel diff因driver漂移但semantic geometry/contrast gates仍通過，必須記差異與owner決策，不可靜默更新baseline。
- 視覺sign-off需列「接受的差異」與「blocking差異」，避免只寫「看起來正確」。

## Definition of Done

- [x] 四個capture entries皆有可追溯artifact與環境metadata。
- [x] review checklist每項為Pass/Fail/Accepted difference，並有owner/date。
- [x] OQ-56.2/3/5最終值與visual結果一致；不需改動README/contracts/tests。
- [x] no-weapon與safe-region同時有automated gate及人工畫面證據。
- [x] blocking visual差異為0。

## Review record — 2026-09-07

Owner：Engineering visual review（Codex）。Capture commit：`43818f30e430d315a8629d1e8c14f6f954841204`。
完整環境資料在 [metadata.json](captures/metadata.json)：Microsoft Edge 151.0.4129.101、headless、DPR 1、WebGPU API available；drill=`micro_flick_three_target_test_v1`、seed=`56001`、scene=`micro-flick-room`、asset pack=`micro-flick-room-v1`。capture runner 以 researcher-only 入口選擇 drill、取得 native Pointer Lock 後隱藏研究員控制項與 dev-only readouts；不修改 scene 或 live target state。

| Capture | Result | Evidence |
|---|---|---|
| 1920×1080 initial | Pass — `t0/t1/t2` 三靶、綠色中心準星與允許的既有 HUD 可見。 | [initial-1920x1080.png](captures/initial-1920x1080.png) |
| 1920×1080 first-hit replacement | Pass — metadata 記錄 `t0` 被撤除、survivors=`t1/t2`、replacement=`t3`；畫面保持三顆球。 | [replacement-1920x1080.png](captures/replacement-1920x1080.png) |
| 1280×720 initial | Pass — 三靶均在安全區內，中心準星清楚。 | [initial-1280x720.png](captures/initial-1280x720.png) |
| 1920×1080 forced asset fallback | Accepted difference — abort Micro Flick GLTF request 後顯示既有深色 placeholder room，HUD／準星仍可操作；metadata 仍記錄 live `t0/t1/t2`。此為失敗路徑證據，不是 Micro Flick visual baseline。 | [fallback-1920x1080.png](captures/fallback-1920x1080.png) |

| Checklist | Result | Review evidence |
|---|---|---|
| 狹長、對稱與中央消失點 | Pass | 1080p/720p capture 的 floor、ceiling、side panel 與 end wall 線條均向畫面中心收斂。 |
| 明亮 floor/walls/end wall、較深 ceiling | Pass | 面向可辨；ceiling 維持較深灰而紅靶未被壓暗。 |
| 規則、低干擾 panel seams | Pass | 兩側等距垂直接縫，無掩體、景觀或裝飾物。 |
| 三顆 red sphere 可辨、無重疊／裁切 | Pass | initial、replacement 與720p均顯示三顆分離球體；T3 projection/safe-region automated gate 仍為佐證。 |
| 綠色 Crosshair 位於中心 | Pass | 四張畫面都可見中心 green crosshair；T4 的 1 CSS px automated gate 覆蓋精度。 |
| no weapon/hands/muzzle/editor/FPS/ammo UI | Pass | 畫面沒有 weapon view-model、手臂、weapon shadow、editor、FPS counter 或 ammo bar。 |
| HUD 不遮擋 spawn safe region | Pass | 僅既有 score/time/hit-rate/velocity HUD 置於上方；spawn 區域保持清楚。 |

Accepted difference：fallback capture 是刻意 abort 資產後的通用 placeholder scene，色調、幾何與 Micro Flick corridor 不同，故不作為 primary visual baseline。沒有 blocking visual difference。

## Commit

```text
docs(stage12): approve WP-56 micro-flick visuals
```
