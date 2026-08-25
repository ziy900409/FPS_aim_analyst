# T2 — `spider-shot-v1` drill config + 條件格(`D_deg`/`W_deg`/象限)離線推導

> Part of [WP-36 spider-shot](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(排程引擎 + `zone` 事件欄位) |
| **Risk / Cplx** | Med / Med |
| **Touches** | ADD `src/drill/spider_shot_v1.ts`、`src/metrics/spiderShotConditions.ts`;MODIFY(若需要抽出共用夾角輔助函式)`src/metrics/eyeOrigin.ts` |
| **狀態** | ⬜ |

## Objective

交付 FR-F8 的條件格部分:每次 transition(center→peripheral / peripheral→center)離線推導方向、象限、`D_deg`、`W_deg`、hitbox、世界距離、seed,並組成 `targetConditionCell` 字串供 WP-33 `buildCompatibilityKey()` 消費。

## In scope

1. `spider-shot-v1` drill config(`mode: 'assessment'`,`spiderShot` 排程,承 WP-33 契約——`mode: 'assessment'` 時 `sequence.seed` 必填,已由既有 `schema.ts` 驗證涵蓋)。
2. `spiderShotConditions.ts`:`deriveSpiderShotTransitions(payload)` 消費連續兩個 `visible` 事件(按 `zone` 欄位分辨 direction),計算:
   - **`D_deg`**:複用 [`angularEccentricityDeg`](../../../../../src/metrics/eyeOrigin.ts) 底層的球面夾角公式(§2③),以「玩家原點 → 前一目標」方向向量取代 `tick.aim` 推出的方向。若既有函式簽名不便直接餵入合成向量,從 `eyeOrigin.ts` 抽出「兩方向向量求夾角」的內部輔助函式(結構抽出,零語意變更,既有 `eyeOrigin.test.ts`/`detectionDerivation.test.ts` 零修改為判準)。
   - **`W_deg`**:新公式 `2 · atan(hitbox 半寬 / 世界距離) · (180/π)`,`hitbox` 取 [`resolveTargetHitbox`](../../../../../src/drill/DrillConfig.ts)/`meta.targets.hitbox`(GD-7 單一來源)。
   - **象限**:`azimuthDeg`(由周邊目標座標相對中心目標方向反算)以 45° 分箱為 `'horizontal' | 'vertical' | 'oblique'`(呈現層標籤,非相容鍵欄位,承 README Failure modes 表)。
   - **`targetConditionCell`**:`'spider:d=<D_deg>;w=<W_deg>'` 格式字串(比照 hold-click 的 `key=value` 分號序列慣例)。
3. `docs/operational/analysis-spider-shot.md` 起稿:排程語意、`zone` 欄位定義、公式、格式。

## Out of scope

- 五類指標本身(T3)。
- `D_deg`/`W_deg` 範圍凍結(WP-39)。
- 回中心 transition 是否計入切換反應/停止控制(OQ-S6-17,T2 只需拍板是否納入本函式輸出範圍)。

## Steps

- [x] (2026-08-24) `spider_shot_v1.ts` drill config 落地(比照既有 `*_v1.ts` drill 形狀,套用 T1 的 `spiderShot` 排程)。
- [x] (2026-08-24) `deriveSpiderShotTransitions()`:direction/象限/`D_deg`/`W_deg`/hitbox/世界距離/seed/`targetConditionCell`。
- [x] (2026-08-24) 抽出共用夾角輔助函式;`eyeOrigin.test.ts`/`detectionDerivation.test.ts`/`holdClickMetrics.test.ts` 零修改全綠。
- [x] (2026-08-24) OQ-S6-17 拍板:回中心 transition 保留在 `deriveSpiderShotTransitions` 輸出供節奏使用,但象限為 `undefined`(D-36.4)。
- [x] (2026-08-24) 合成 fixture:四象限 + 兩斜向的 `D_deg`/`W_deg`/象限標記端到端驗證(驗證條件格計算,非重複驗證幾何換算)。
- [x] (2026-08-24) `analysis-spider-shot.md` 起稿。
- [x] (2026-08-24) `npm run test:ci` 全綠: typecheck ✅, Vitest **111 files / 882 tests**, Playwright **21 passed**。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `D_deg` 不另立第二套球面夾角公式(複用既有夾角公式或其抽出的共用輔助函式) | `git diff` 可審為複用/結構抽出,非重寫 |
| ② | `W_deg` 唯一輸入來源是 GD-7 單一 hitbox | 測試斷言換不同 `meta.targets.hitbox` 值時 `W_deg` 隨之改變,無第二尺寸常數 |
| ③ | 四象限 + 兩斜向合成 fixture 條件格計算正確 | 測試綠 |
| ④ | `targetConditionCell` 格式一致且可被 `buildCompatibilityKey()` 消費(非空字串) | 端到端測試呼叫 `buildCompatibilityKey()` 不拋錯 |
| ⑤ | OQ-S6-17 拍板 | Decision Log D-36.4 |
| ⑥ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-36): T2 — spider-shot-v1 config + D_deg/W_deg/象限條件格離線推導`
