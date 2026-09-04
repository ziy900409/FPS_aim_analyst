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

- [ ] 四個capture entries皆有可追溯artifact與環境metadata。
- [ ] review checklist每項為Pass/Fail/Accepted difference，並有owner/date。
- [ ] OQ-56.2/3/5最終值與visual結果一致；任何變更回寫README/contracts/tests。
- [ ] no-weapon與safe-region同時有automated gate及人工畫面證據。
- [ ] blocking visual差異為0，或明確回到T3/T4修正後重跑T5。

## Commit

```text
docs(stage12): approve WP-56 micro-flick visuals
```

