# T1 — hitbox `shape` 型別擴充 + `schema.ts` sphere 驗證 + `CLAUDE.md §4` GD-7 措辭更新

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Med / Low(型別擴充機械化,風險在「23 個消費 `.hitbox` 的檔案是否有遺漏處」,靠既有測試矩陣把關) |
| **Touches** | MODIFY `src/drill/DrillConfig.ts`、`src/state/types.ts`、`src/drill/schema.ts`、`CLAUDE.md`;NEW/MODIFY `src/drill/schema.test.ts` |
| **狀態** | ✅ |

## Objective

把 `shape?: 'box' \| 'sphere'` 新增進 hitbox 的單一來源型別鏈(`TargetHitboxConfig` → `TargetHitboxSize` → `TargetState.hitbox`),`schema.ts` 驗證 sphere 時三軸相等,並把 `CLAUDE.md §4` 的 GD-7 hitbox 硬約束措辭從「box」擴充為「box|sphere」。這是後續 T2(HitDetector)/T3(TargetView)/T5(config)能讀到 `shape` 欄位的前置依賴。

## Steps

- [x] `src/drill/DrillConfig.ts`:`TargetHitboxConfig` 新增 `shape?: 'box' | 'sphere'`;`TargetHitboxSize` 新增必填 `shape: 'box' | 'sphere'`。
- [x] `resolveTargetHitbox(config)`:回傳值補上 `shape: hitbox?.shape ?? 'box'`(省略即 box,逐位相容 FR-46.2)。
- [x] `targetHitboxToConfig(hitbox)`:回傳值補上 `shape: hitbox.shape`(export 端 `TargetsMeta.hitbox` 透過 `data/metadata.ts` 既有的 `TargetHitboxConfig` 型別自動帶到,不需要額外改 `metadata.ts`——先確認這個假設成立,若 `requireTargetHitboxConfig` 用 `requireRecord` 白名單欄位需額外加 `shape` 讀取,則一併補上)。**確認假設不成立**:`requireTargetHitboxConfig` 用白名單讀取欄位,已補上 `shape` 選填讀取(`requireHitboxShape`)。
- [x] `src/state/types.ts`:`TargetState.hitbox` inline type 新增 `shape: 'box' | 'sphere'`。
- [x] `src/sim/TargetManager.ts`:確認 `spawn()` 內 `hitbox: { ...hitbox }` 的展開語法已經會自動帶上 `shape`(因為 `resolveTargetHitbox` 回傳值已含 `shape`)——展開語法無問題,此檔不需額外改動;`TargetManager.test.ts` 型別編譯通過。
- [x] `src/drill/schema.ts`:`validateDrill`(或對應 hitbox 驗證函式)新增:讀取 `targets.hitbox.shape`,若為 `'sphere'` 則要求 `widthU === heightU === depthU`,否則 `throw err('targets.hitbox.shape', 'sphere 要求 widthU/heightU/depthU 三軸相等')`;若為 `'box'` 或省略則不驗證相等性(既有行為不變)。
- [x] `CLAUDE.md §4`:找到「目標 hitbox 單一來源」條目,把「必須逐位等同現行 H1 `{1,2,1}`」附近措辭擴充,加入「`shape?` 省略/`'box'` 時維持既有 Box3 判定;`shape:'sphere'` 時命中判定與渲染改用球體相交,但仍須同一個 `TargetState.hitbox` 單一來源,不得為 sphere 另開一套尺寸常數(WP-23/GD-7,經 WP-46 擴充)」。
- [x] 新增 `schema.test.ts` 測試:①`shape:'sphere'` 且三軸相等時通過驗證;②`shape:'sphere'` 但三軸不等時擲出清楚錯誤;③省略 `shape` 或 `shape:'box'` 時既有驗證行為逐位不變。
- [x] 執行 `npx tsc --noEmit` 全專案型別檢查,確認新增必填 `shape` 欄位沒有讓既有測試/程式碼的 `TargetHitboxSize`/`TargetState.hitbox` 字面量出現型別錯誤(若有遺漏處,逐一補 `shape: 'box'`)。**發現 26 處遺漏**(13 個檔案的 hitbox 字面量/斷言),已逐一補 `shape: 'box'` 或更新斷言預期值;`src/metrics/visibilityDerivation.ts`(production code)兩處 hitbox 建構也需補 `shape` 傳遞。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `shape` 省略/`'box'` 時,既有全部 hitbox 相關測試(`schema.test.ts`/`TargetManager.test.ts`/`HitDetector.test.ts`/`TargetView.test.ts`/`trackingDerivation.test.ts`/`spiderShotConditions.test.ts`)零回歸全綠 | `npx vitest run` 全專案 |
| ② | `shape:'sphere'` 三軸不等時 schema 驗證清楚拒絕 | 新測試 |
| ③ | `shape:'sphere'` 三軸相等時 schema 驗證通過 | 新測試 |
| ④ | `CLAUDE.md §4` GD-7 hitbox 措辭已更新,明確允許 box\|sphere 且維持單一來源 | 文件 diff |
| ⑤ | `npx tsc --noEmit` 全專案綠 | 執行確認 |

## Commit

`feat(wp-46): T1 — hitbox shape 型別擴充(box\|sphere)+ schema 驗證 + CLAUDE.md GD-7 措辭更新`
