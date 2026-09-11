# WP-67 T-exit — 驗收閘（A-67.1～A-67.10）與 GD-43 入帳

## Objective

把 WP-67 的交付宣稱**逐條化為可稽核證據**。每一條 A- 必須指向指令 ＋ 輸出、斷言檔名 ＋ 案例名，或實機數值記於 `progress.md`。任何一條只能寫「已完成」的，視同未通過。

同時把 [GD-43](../../../DECISIONS.md) 本體落帳（規劃期只留草稿，比照 WP-63 D-63-P6 / WP-66 D-66-P7 先例）。

## 驗收矩陣

| # | 宣稱 | 對應 FR/NFR | 證據要求 |
|---|---|---|---|
| **A-67.1** | 新匯出帶 `meta.opening`，兩欄形狀正確 | FR-67.1／67.2 | live 匯出的**實際數值**（`protocol` 字串 + `countdownMs` 數字），非「已驗證」 |
| **A-67.2** | **缺席不補預設**：舊 payload parse 後 `opening` 仍為 `undefined` | FR-67.4 / NFR-67.1 | FM-1 反證案例名 ＋ **8 筆 `CANONICAL_DIGEST_BEFORE_T5` 與 T0 逐筆相同**的測試輸出 |
| **A-67.3** | `protocol` 由 runtime 事實推導，不是硬編字串 | FR-67.8 | FM-2 兩條反證案例名（`requireArm: false` / 省略 option ⇒ `immediate-v0`） |
| **A-67.4** | `countdownMs` 的唯一來源是 config | FR-67.2 / C-D4 | 使用**非 3000** 值的案例名 ＋ 換 drill 後取到新值的案例名 |
| **A-67.5** | 四條 start 路徑一致帶欄 | FR-67.7 | restart／換武器／換場景／換 drill／Session Plan **每個 block** 的實測值列表 |
| **A-67.6** | 舊 payload 仍可被兩側讀取 | FR-67.3 | `parseExportPayload()` 對無 `opening` fixture 的測試案例名 ＋ Python `load_export()` 實跑輸出 |
| **A-67.7** | 離線分類器三分支正確 | FR-67.5 | 三份 fixture 各自的分類結果 ＋ 案例名；`unknown` 分支一條 |
| **A-67.8** | 混池 guard 會拋錯且訊息含檔名 | FR-67.6 / FM-4 | 拋錯案例名 ＋ **錯誤訊息實際字串** ＋ 「同協定一池不拋錯」的正向案例名 |
| **A-67.9** | frozen meta 鍵面 digest 位移，且位移**只由 `opening` 造成** | NFR-67.3 | 三格舊值 → 新值 ＋ 鍵集合差集恰為 `['opening']` 的斷言輸出 |
| **A-67.10** | 構念只有一個定義 | C-D4 | TS 註解／Python docstring／`CONTEXT.md` 三處引文對照，逐句一致 |

> **A-67.2 是整份驗收裡最不能通融的一條。** 它是本 WP 唯一會靜默失效的失敗模式：補了預設值之後所有測試照樣綠，錯誤要等到有人把中間窗資料混進 v0 池才會浮現，而那時已經沒有人記得這裡曾有一個選擇。「8 筆不動、3 格動」這組**一動一不動**的對照，是它唯一的機械化證據。

## Steps

1. 逐條填寫上表的證據欄，證據本體寫入 `progress.md §T-exit`。
2. **最終全量閘**（四項皆須貼出實際輸出，非「已跑過」）：
   - `npm run typecheck` ×2 → exit code
   - `npx vitest run` → `N passed / M skipped` ＋ 與 T0 基線的差額逐條說明
   - `npx playwright test --workers=1` → `N passed / 0 failed` ＋ 耗時 ＋ 執行前後 `.playwright-tmp/history-dev/` 目錄數
   - `npm run build` → exit code
3. **硬約束 diff 檢視**（空結果也要貼，證明真的跑過）：
   - `git diff main...HEAD -- src/ | grep -n "Date.now"` → 應為空
   - `git diff main...HEAD -- src/ | grep -n "Math.random"` → 應為空
   - `git diff --stat main...HEAD -- src/state/SharedState.ts` → 應為空（ADR-2）
   - `git diff --stat main...HEAD -- src/sim/ src/input/` → 應為空（本 WP 不碰 sim 與輸入鏈）
   - `git diff --stat main...HEAD -- research/src/modules/ingest/algorithms/loader.py` → 應為空
   - `grep -rn "import" research/src/modules/ingest/algorithms/opening.py` → 不含任何 `src/` 路徑（C-D1）
4. **[GD-43](../../../DECISIONS.md) 落帳**（本體，非草稿）。至少涵蓋：
   - ① 為何是 `meta.opening` 物件而非 `schemaVersion` bump，也非單一字串（D-67-1）。
   - ② **optional-in／optional-out 的不對稱**：缺席不補預設，以及它為何與 [D-65-3](../../../DECISIONS.md) 刻意相反（D-67-2）。這條是本 WP 的核心，必須寫得讓下一個人不會「順手統一」。
   - ③ `protocol` 由 runner 事實導出而非版號常數，及 arming／可見倒數「同生共死」假設如何被 e2e 釘死（D-67-3）。
   - ④ 中間窗（WP-65～WP-67）以 `validity.pointerLockLost` **原始鍵存在與否**斷代，及該指紋的失效觸發條件（D-67-4）。
   - ⑤ 分類規則只在 Python 側單一實作，TS 側不做第二份的理由（D-67-5，C-D4）。
   - ⑥ 已錄匯出不可變、不寫回填 migration（D-67-6）。
   - ⑦ **落帳前重查** `DECISIONS.md` 當下最大 GD；被平行 session 取用則依 GD-15 順延並同步全部連結。
5. **翻狀態**：本資料夾 `task-checklist.md` 全數 ✅；[stage13 README §2](../README.md) 的 WP-67 列翻 ✅ 並填入具名證據摘要；[exec-plan README §2](../../../README.md) 的 WP-67 列同步翻 ✅；視需要把資料夾移入 `completed/`（stage13 仍 active 時不搬）。
6. **OQ-67.1～67.4 四條全數結案**（關閉或明確降級為非阻塞觀察項，逐條寫明理由）。

## Definition of Done

- [ ] A-67.1～A-67.10 **十條全數**有具名證據（指令+輸出／檔名+案例名／實機數值），無任何一條只寫「已完成」
- [ ] A-67.2 的「8 筆不動、3 格動」對照已逐筆列出（16 個數字全部落在 `progress.md`）
- [ ] 四項最終全量閘的實際輸出已貼入 `progress.md §T-exit`
- [ ] 步驟 3 的六條 diff／grep 檢視輸出已貼入（空結果也要貼）
- [ ] GD-43 本體七項已落入 [`DECISIONS.md`](../../../DECISIONS.md)，且落帳前的編號重查結果已記錄
- [ ] `task-checklist.md` 全 ✅；[stage13 README §2](../README.md) 與 [exec-plan README §2](../../../README.md) 的 WP-67 列均已翻 ✅
- [ ] OQ-67.1～67.4 四條全數結案

## Commit

```text
docs(wp-67): T-exit gate evidence for the export opening protocol marker
```
