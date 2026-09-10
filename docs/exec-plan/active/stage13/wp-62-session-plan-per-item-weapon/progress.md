# WP-62 — Progress

> Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md) · 決策 [GD-38](../../../DECISIONS.md)
>
> 每個 task 完成時追加一段（Progress / Decision Log / Surprises / Open Questions），與該切片一起 stage（協議 §3.4）。

---

## §0 規劃（2026-09-10）

**狀態**：📋 規劃完成，未開工。

計畫由 `engineering-planning` skill 產出，落點依使用者指示為 `active/stage13/`（主題不符的說明見 [README §落點說明](README.md)）。

### 規劃期發現（已寫入 README §0，此處只記推翻了什麼）

1. **原始需求是「全域 pin 一把武器」，經稽核後改向。** 使用者最初要求把整輪測試 pin 成 `usp_s_laser`。稽核 sim 消費路徑後發現兩個 blocker：
   - **散佈公式歸零**：`totalInaccuracy = stand + inaccuracyFire + speedRatio^0.25 × move`（[spread.ts:41](../../../../../src/recoil/spread.ts)），`usp_s_laser` 三項全 0 ⇒ `sampleSpread` 恆回 `{0,0}` ⇒ 移動中開火與靜止開火彈著點相同 ⇒ **counter-strafe 的「急停時機 → 首發命中」因果通道消失**，F1–F4 的核心構念失效（不是與舊資料斷代，是不再量測任何東西）。
   - **`magSize: 12` 且全 repo 無 reload**：`state.weapon.ammo` 只在 `createSimLoop()` 設一次（[SimLoop.ts:815](../../../../../src/loop/SimLoop.ts)），打空即 `heldFire = false`、`nextFireT = Infinity`（[SimLoop.ts:541-544](../../../../../src/loop/SimLoop.ts)）⇒ 12 發 × 0.17 s = 2.04 秒後該 run 靜默停火，且受測者的「按住」意圖被記成放開。
   使用者據此改向為**逐列指定**，本 WP 即此方向。原「全域 pin」方案已放棄，不再保留為備選。
2. **可排程 drill 中只有 4 個宣告武器**（BR 2×2 實驗格）。綁 `tracking_pilot_hold` 的兩個 tracking pilot drill **不可排程**（走 `loadDrillConfigDirect`）⇒「武器鎖」的範圍是 4 列，不是一整套機制。這把 D-62-1 從「需要鎖定 UI」縮成「編譯器一條驗證」。
3. **`CompatibilityKey` 已含 `weaponId`**（[compatibilityKey.ts:8](../../../../../src/metrics/compatibilityKey.ts)）⇒ 不同武器的 run 本來就不會併池，本 WP 對 history/trend **零程式修改**。代價是趨勢線會依武器碎裂（FM-5），屬正確行為但外觀像 bug，故列為表單必須明示的文字。
4. **`drillFamily.ts` 已 import 全部 drill 模組** ⇒ 「哪個 drill 宣告了武器」可推導，不需第二份手寫清單（避免 KI-016 重演）。這是 T1 存在的理由。

### 凍結決策

D-62-1～4 見 [README §1.4](README.md)，同步入帳 `GD-38`（編號待 T0 寫入當下重查確認）。

### Open Questions（開工前狀態）

| OQ | 狀態 | Owner | 預設假設 |
|---|---|---|---|
| OQ-62.1 | 🟡 未決 | 研究者 | 預覽對未指定列顯示「預設」；BR 四格顯示實名 |
| OQ-62.2 | 🟡 未決 | 研究者 | 不做 ADS 警告，只記為已知限制 |
| OQ-62.3 | 🟡 未決 | 實作者（T1 開工時） | 對表測試全覆蓋 36 個 schedulable drill；解析成本過高者具名豁免 |

### Surprises

- 使用者要求的 `usp_s_laser` 恰好是全 repo 唯一同時具備「零 move 散佈」與「12 發彈匣」的武器，兩個 blocker 疊在同一把上——若當初直接照做，counter-strafe 資料會全部作廢且不會有任何錯誤訊息。這條記錄下來是為了說明：**武器不是外觀參數，是量測儀器的一部分**。
