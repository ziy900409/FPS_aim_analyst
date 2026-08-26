# WP-46(暫用編號)— progress.md

> Running log。Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-26 規劃**:經使用者實機測試回報 + `systematic-debugging` 排查(排除 sim 邏輯 bug)+ `brainstorming` 對話(確認要對齊 Aim Lab Spidershot,含一輪 GD-7 修訂範圍的明確人為確認)產出本 WP 計畫。尚未執行任何 task。
- **2026-08-26 T0**:覆核 README §0 六項讀碼假設 + entry-gate 七項 Steps,對照現行程式碼與文件。六項成立;第七項(`docs/exec-plan/DECISIONS.md` GD-25 狀態)發現與實際不符,已修正 README Constraints 與本檔 D-46.2(見下方 Surprises / Decision Log)。✅ T0 DoD 達成,可進 T1。
- **2026-08-26 T1**:`TargetHitboxConfig`/`TargetHitboxSize`/`TargetState.hitbox` 新增 `shape?:'box'|'sphere'`(`TargetHitboxSize`/`TargetState.hitbox` 側恆填實值);`schema.ts` `validateHitbox` 新增 sphere 三軸相等驗證;`metadata.ts` `requireTargetHitboxConfig` 補上 `shape` 選填讀取(export/import 往返保真);`CLAUDE.md §4` GD-7 措辭擴充為 box|sphere。`npx tsc --noEmit` 揪出 26 處既有 hitbox 字面量/斷言缺少必填 `shape`(13 個檔案,含 1 個 production 檔 `visibilityDerivation.ts`),逐一補 `shape:'box'` 後 tsc 全綠;`npx vitest run` 全專案 1062 個測試全綠(含新增 3 個 sphere 驗證測試)。✅ T1 DoD①–⑤達成,可進 T2。

## Decision Log

- **D-46.1**(2026-08-26,brainstorming 對話拍板):GD-7 的 on-target 幾何由「H1 hitbox(Box3)」擴充為「box|sphere,單一來源不變」。**Why**:使用者要求 spider-shot-v2 目標為真正球體碰撞判定(非視覺近似),而 GD-7(WP-23 第一次收斂)原文把幾何釘死在 Box3;維持單一來源原則(命中判定與視覺同一個 `TargetState.hitbox`)的前提下,把「哪一種幾何」參數化為 `shape` 是唯一不違反 GD-7 精神(零新門檻/同幾何)的擴充方式。**Alternatives considered**:只做視覺球體、判定仍用 box(內接或外接近似)——使用者在對話中明確否決,選擇了會動 GD-7 的真實作法。
- **D-46.2**(2026-08-26,**T0 修正 2026-08-26**):`docs/exec-plan/DECISIONS.md` 本次不寫入正式 GD 編號。**Why(規劃時原始理由,已過時)**:規劃當下誤植為「GD-25 已被 stage8 提案暫用但未正式落帳」。**T0 覆核發現**:GD-25 實際已於 WP-45(stage9,非 stage8)T-exit 正式落帳為完整決議(「✅ WP-45 pilot-ready — peek-click transfer 與元件量測邊界、共用遮擋 kernel」,2026-08-26),非佔位/暫用;下一個可用號為 GD-26。**維持原結論的理由(修正後)**:即便 GD-25 已非「暫用」而是「已占用」,本 WP 仍選擇不搶下一個號碼(GD-26)入帳,理由不變——比照 WP-44/WP-45 T-exit 的延後處置,避免與使用者尚未拍板的 stage9 WP/GD 一次性編號動作(OQ-S9-2)搶跑。**How to apply**:實質決策記在本檔 Decision Log,`CLAUDE.md §4` 直接更新措辭(比照 WP-23 前例:CLAUDE.md 更新早於正式 GD 編號),`DECISIONS.md` 的正式條目(預期為 GD-26)留給使用者一次性指派 stage9 全部編號時補上。
- **D-46.3**(2026-08-26):中心目標逾時處理選擇「不設個別逾時」而非「設一個較長的保險值」。**Why**:專案既有的 `timing.timeLimitMs`/`endCondition` 後援閘機制已經足以防止 drill 卡死,不需要為 spider-shot 中心目標另開一個新的計時概念——重用既有機制比新增參數更簡單、風險更低。
- **D-46.4**(2026-08-26):外圍目標存活時間選固定單一值(1750ms,1500–2000 中點),不做隨機範圍抽樣。**Why**:使用者傾向簡單、不新增隨機性;隨機範圍需要新的 schema 欄位與 RNG 消費點,複雜度不成比例。

## Surprises

- **T0(2026-08-26)**:README §0-3/Constraints 引用的「GD-25 是 stage8 暫用、未正式落帳」與 `docs/exec-plan/DECISIONS.md` 現況不符——GD-25 早已是 WP-45(本 stage9,非 stage8)的正式決議,2026-08-26 隨 WP-45 T-exit 落帳。判斷:此為規劃階段(WP-46 README 撰寫時)的認知落差,非本 WP 執行期間的新變化(WP-45 T-exit 與 WP-46 規劃同日,可能是撰寫順序誤植)。已修正 README Constraints 段落與 D-46.2;不影響 T0 DoD② 判定(結論——延後入帳——不變,只是理由與目標號碼從「避免衝突」改為「不搶跑,下一個可用號為 GD-26」)。

- **T1(2026-08-26)**:README §2 藍圖預估「23 個消費 `.hitbox` 的檔案」,實際 `TargetHitboxSize`/`TargetState.hitbox` 新增必填 `shape` 後 `tsc --noEmit` 命中 26 處字面量/斷言(13 個檔案),其中 `src/metrics/visibilityDerivation.ts` 是 production code(`resolveOptions`/`hitboxFromMeta` 兩處建構 hitbox,需補 `shape` 傳遞才維持型別正確;行為不變,因為該模組不讀 `shape` 欄位)。判斷:數量差異來自「消費 `.hitbox` 讀取欄位」與「建構 `.hitbox` 物件字面量」是兩個不同集合,原估計只涵蓋前者;不影響 T1 DoD(逐一補齊後 tsc/vitest 全綠)。

## Open Questions(狀態)

- OQ-46.1(`targets.count` 安全上限精確值):暫定 300,待 T5 前確認,不阻塞 T0–T4。
- OQ-46.2(正式 WP/GD 編號指派時機):延後,比照 stage9 OQ-S9-2,不阻塞本 WP 交付。
