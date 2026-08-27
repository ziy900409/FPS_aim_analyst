# WP-50 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27**：依engineering-planning skill完成repository-grounded規劃。盤點`TickRecord`／`DrillEvent`／`Meta`、live render callback、SceneManager、CameraController、Target/Impact/Tracer views與official roster；尚未修改production code。
- **2026-08-27**：確認legacy v2不能一律宣稱full：tick只有第一個visible/alive target座標且無ID/lifecycle，continuous recoil、shot ray/impact與projectile visual未完整export。規劃T1 additive replay contract，legacy依capability降級。
- **2026-08-27**：將工作拆為T0～T6 + T-exit；預設單renderer／隔離scene／single app rAF exclusive ownership，並以pure time sampling守住seek invariant。

## Decision Log

- **D-50-P1 / Recorded state**：不重跑input或live sim；payload + normalized time是唯一replay truth。
- **D-50-P2 / Exact support**：support registry只接受exact `drillId`，status由profile與observed capabilities共同判定。
- **D-50-P3 / Legacy honesty**：沒有replay v1 evidence的舊payload最高先視為partial；T0可依逐drill證據收斂，但不得按schemaVersion批次升full。
- **D-50-P4 / Seek purity**：targets與短效fire/hit visuals由recording+t純推導；不重用live Impact/Tracer累積state。
- **D-50-P5 / Presentation ownership**：prototype優先共用既有renderer/canvas，但scene/camera/view state隔離；app frame owner在live/replay間互斥。

## Open Questions（狀態）

- **OQ-50.1**：full visual fidelity最低集合，待使用者／遊戲設計owner於T0 exit確認。
- **OQ-50.2**：current Practice Result是否允許in-memory replay，建議允許但不保存。
- **OQ-50.3**：partial是否可進有限重播，建議可，並持續顯示缺失capabilities。
- **OQ-50.4**：asset pack version mismatch，建議降partial並顯示版本警告。

## Evidence Log

尚未開始T0；無production implementation、test或benchmark evidence。
