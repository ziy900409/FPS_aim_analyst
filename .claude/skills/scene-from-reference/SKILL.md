---
name: scene-from-reference
description: Use when a game scene reference — gameplay video, screen recording, screenshot, photo, map overview, or a "make me a scene like this" request — has to become a buildable scene in this repo. Also use when planning a new drill that needs a new scene, or when someone asks how to turn footage into propBounds, SceneConfig, or an exec-plan work package.
---

# Scene From Reference

## Overview

本 repo 的場景 = **契約化資料 + 原創程序化 box 幾何**,不是美術資產。

**核心原則:不重建,只抽象。**
參考素材決定**拓撲與觀感**;drill 規格決定**數值**。從影片抽出的是「交戰拓撲 / 遮蔽拓撲 / 視覺條件」,
交戰距離、目標尺寸、`eyeZ` 這些數字由 drill 規格反推,不是從畫面量出來的。

產出分兩段,中間有一個**強制停點**:

| 段 | 產出 | 落點 |
|---|---|---|
| ① P0–P3 | 場景分析報告 + `props.json` 草案 + `SceneConfig` 建議值 | `docs/scene-specs/<scene-id>-analysis.md` |
| ② P4–P5 | tech spec → exec-plan WP 包(README + T0..T-exit + checklist + progress) | `docs/exec-plan/active/stageN/wp-NN-<scene-id>/` |

## When to use

- 使用者丟來遊戲影片 / 截圖 / 照片,說「做一個像這樣的場景」
- 新 drill 需要新場景(例:需要 corner-peek 掩體、需要更長 sightline、需要不同雜亂度背景)
- 要把既有場景改版,而參考素材是別的地圖

**不要用在**:改既有場景的單一數值(直接改 `props.json` + 跑測試)、
純渲染調色(不動 `propBounds` 就不是新場景)、非場景的 drill 規劃(用 `engineering-planning`)。

## P2 紅線 — 先讀,不過就不准往下

這三條在 P2 逐條過閘。任何一條未過,**停下來問使用者**,不要自行放寬。

### R1 — 參考素材只能做方法學抽象(GD-9 / GD-11 同源紅線)

商業遊戲(CS2 / Valorant / Apex / …)的地圖是受保護的表達。

| 可以取 | 禁止取 |
|---|---|
| 交戰距離級距(「約 15–20u 的中距對槍」) | 逐點描摹佈局座標 / 依畫面比例還原平面圖 |
| 掩體原型(corner-peek / head-glitch / full / soft) | 複製該地圖的掩體排列與相對位置 |
| 遮蔽關係(目標從哪個邊緣出現) | 任何貼圖、模型、音效、UI 素材 |
| 光照氛圍轉成 `colors` / `lights` 數值 | 場景命名沿用原地圖名(`dust2-mid` ✗ → `mid-long-lane` ✓) |

**參考素材本身不得 commit 進 repo**(截圖/影片是他人著作)。放 scratchpad,分析報告只留文字描述與數值。

### R2 — GD-6:場景幾何永不進 sim runtime

分析結果不得衍生出「`src/sim` / `SharedState` / `HitDetector` / `TargetManager` 讀場景資料」的任務。
需要遮蔽語意時,走既有的 **scene 層離線解析**路徑(`src/scene/occlusionGeometry.ts` +
`validateClearance` 的 occlusion-aware options),不是把 `propBounds` 餵進 sim。

### R3 — 決定性:新場景不得改 sim

不得觸及 `SIM_HZ`、目標演進、命中幾何、輸入鏈。WP 必須包含
「同輸入序列跨場景 sim 狀態逐位一致」的斷言任務(既有測試已有此形狀,照抄不要重發明)。

## Pipeline

### P0 — 素材正規化

**影片**:`python .claude/skills/scene-from-reference/scripts/extract_frames.py <video> -o <scratchpad>/frames`
腳本依序試 `ffmpeg` → `imageio-ffmpeg` → `opencv-python`;三者皆無時會印出**需要哪些鏡位的截圖清單**,
把清單原樣轉達使用者,不要自己硬解影片。

**照片/截圖**:直接 `Read`。

無論哪條路徑,最終要湊齊這四類畫面(缺哪類就明講缺,不要用推測補):

| 鏡位 | 用途 |
|---|---|
| 正面 sightline(玩家視角看向交戰方向) | 距離級距、背景亮度/對比 |
| 掩體側視或斜視 | 掩體型別、暴露側、關鍵高度 |
| 俯視 / 小地圖 / 空拍 | 平面拓撲、走廊寬度 |
| 目標出現瞬間 | 遮蔽關係、目標可辨識度 |

輸出:`frames/` 清單,每幀標「檔名 → 屬於哪個鏡位 → 看得出什麼」。

### P1 — 語義萃取

**載入 `references/extraction-schema.md`**,逐欄填寫。尺度估計**必須**依
`references/scale-anchors.md` 的錨定階梯,每個數值標 `{value_u, anchor, confidence}`。

鐵律:**看不出來的進 `unknowns`,不要猜。** 一個標 `confidence: low` 的誠實估值,
比一個看起來精確的假數字有用得多——後者會在 T3 淨空驗證時炸掉,而且沒人知道為什麼。

### P2 — 契約對齊

先跑上面的 R1/R2/R3 紅線,再**載入 `references/scene-contract.md`**,對照:
8 件交付物是否都有著落、`SceneConfig` 每個欄位是否都有來源、
`eyeZ` / `floorY` / `playerCorridor.halfWidthU` 是否被 drill 需求決定而非被畫面決定。

### P3 — 規格草案

1. 從 `assets/props.template.json` 起手,寫出 `props.json` 草案(單位 u,`kind` 用既有分類)。
2. 體檢:`python .claude/skills/scene-from-reference/scripts/check_props.py <draft.json>`
   —— 檢查 `min ≤ max`、`id` 唯一、prop 是否壓到眼位或走廊。**綠燈才算草案成立。**
3. 用 `assets/scene-analysis-report.md` 模板寫出分析報告,填齊 `SceneConfig` 建議值表與 Open Questions。

### STOP — 交報告,等使用者核可

<CRITICAL>
P3 結束後**停止**。把分析報告交給使用者審閱,明確說出:
「這是第一段產出(分析 + 規格草案),核可後我才生成 WP 執行計畫。」

不要在同一輪把 WP 包也生出來。分析若有偏差,WP 整包要重做——這正是兩段式存在的理由。
</CRITICAL>

### P4 — Tech spec

使用者核可後,**呼叫 `engineering-planning` skill**,把 P1–P3 的產出當作
Requirements(場景要服務的 drill 與拓撲需求)與 Technical design(props/SceneConfig/clearance)輸入。
硬約束衝擊表照填,GD-6 / GD-9 / 決定性三列絕不留白。

### P5 — WP 包

從 `assets/wp-package/` 複製骨架到 `docs/exec-plan/active/stageN/wp-NN-<scene-id>/`,
WP 編號接 `docs/exec-plan/README.md` 現行最大號 +1,stage 依使用者指示。

固定任務骨架(**T1–T4 必要**,其餘依複雜度增刪):

| Task | Objective |
|---|---|
| `T0` | entry-gate:上游 exit-gate 綠燈 + 授權判定(R1)+ OQ 收斂 |
| `T1` | `props.json` + `scripts/gen-<id>-gltf.mjs` + `public/assets/scenes/<id>/` + `ATTRIBUTIONS.md` 逐項 |
| `T2` | `src/scene/scenes/<id>.ts`(`validateScene`)+ `<id>.test.ts` |
| `T3` | clearance / occlusion:對抗性 fixture(恰相交 / 恰不相交)兩例 |
| `T4` | registry 掛線(`main.ts` 選單 · `ResultPresentation.KNOWN_SCENES` · `replaySceneResolution`)+ `meta.scene` round-trip |
| `T5` | 跨場景決定性逐位一致 + 負載基準(draw call / 三角形數 / 無掉 tick) |
| `T-exit` | 證據清單:置換 / 拒載 / 決定性 / attribution 四項 |

每個 `Tn` 檔從 `assets/wp-package/Tn-task.md` 複製一份、改名為表中的檔名
(`T1-props-and-asset.md` / `T2-scene-config.md` / `T3-clearance.md` /
`T4-registry-and-meta.md` / `T5-determinism-and-load.md`),各自填 Steps /
Definition of Done / Commit(協議 §3.3)。`T0` 與 `T-exit` 已是完整檔,直接改 `<...>` 佔位即可。

生成後把該 WP 登入 `docs/exec-plan/README.md` 的 WP 狀態表(協議 §3.5)。

## Red flags — 看到就停

- 「我從影片量出這面牆是 3.2 公尺」 → 你量不出來。走 `scale-anchors.md` 的錨定階梯。
- 「照著小地圖把佈局還原出來」 → 踩 R1。抽象成掩體原型,不還原佈局。
- 「場景就叫 `mirage-a-site` 吧」 → 踩 R1。用功能命名。
- 「順便讓 sim 讀 `propBounds` 判掩體」 → 踩 R2/GD-6。
- 「先把 WP 包寫了,分析報告等等補」 → 破壞兩段式停點。
- 「這幾格 schema 空著沒差」 → 空欄位會變成 T1 的隱藏返工。填 `unknowns`。
- 「把參考截圖放進 `public/assets/` 當貼圖」 → 踩 R1 授權紅線。

## Common mistakes

| 錯誤 | 後果 | 正解 |
|---|---|---|
| 用畫面決定交戰距離 | drill 的 `distance` 與場景打架,`eyeZ` 語意錯亂 | 距離由 drill 規格定,場景只負責容納 |
| `propBounds` 與 gltf 幾何各寫一份 | 視覺與淨空判定漂移 | `props.json` 是唯一權威,gltf 由 script 生成 |
| 忘記 `ATTRIBUTIONS.md` | GD-9 稽核破口,exit-gate 過不了 | T1 的 DoD 就含這項 |
| 直接把外部 GLTF 丟進來 | 授權風險 + `propBounds` 得手動量測 | 本 repo 一律原創程序化 box(見 `scene-contract.md`) |
| 跳過 `check_props.py` | T3 才發現目標包絡被牆卡住 | P3 綠燈才算草案成立 |

## Bundled resources

- `references/scene-contract.md` — 8 件交付物、`SceneConfig` 欄位語意、硬約束
- `references/extraction-schema.md` — P1 萃取 schema 逐欄定義
- `references/scale-anchors.md` — 尺度錨定階梯與 confidence 規則
- `assets/scene-analysis-report.md` · `assets/props.template.json` · `assets/wp-package/`
- `scripts/extract_frames.py` · `scripts/check_props.py`
