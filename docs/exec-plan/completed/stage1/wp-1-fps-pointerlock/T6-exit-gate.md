# T6 / T-exit — Exit gate

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T5 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)、[progress.md](progress.md)（Outcomes & Retrospective）、[task-checklist.md](task-checklist.md)（翻 T6 Done box）；docs only |
| **Status** | ✅ DONE（2026-06-30）|

## Objective
驗證 WP-1 整體綠燈、map PLAN WP-1 驗收、更新索引、交棒 WP-2（雙迴圈需要 1.4 視角做內插驗證）與 WP-4（場景）。

> **本 gate 的職責 = 不低於它所把關的切片。** T1–T5 每個切片都跑 `tsc` + `vite build` + `vitest run src` 三檢；exit gate 至少要同等強度——只跑 `tsc` 會讓「型別過、但 build / 回歸紅」溜過最後一道門。另：T2–T5 各自把「非 headless 真人 spot-check」**明確延到 T6**（OQ-T3.a / T4.a / T5.d），本 gate 必須逐項關閉並留證據，**不能只勾 4 條 PLAN 驗收就放行**。

## Steps

### A. 自動化三檢（gate ≥ 上游切片；指令照抄）
- [x] `npx tsc --noEmit` → exit 0。**（`npm run build` 2026-06-30：exit 0）**
- [x] `npx vite build` → `✓ built`（three chunk-size warning 為資訊性，非錯誤）。**（✓ built in 1.54s）**
- [x] `npx vitest run src` → all passed。**務必帶 `src` scope**：裸 `npx vitest run` 會收 `tests/e2e/*.spec.ts`（Playwright 規格）而報 collection 失敗（既有設定問題，見 T4 Surprises），非回歸紅。**（4 passed）**

### B. 硬約束複驗（CLAUDE.md §4）
- [x] **cross-origin isolation 仍綠**：main.ts 啟動呼 `assertIsolation()`；非 headless 開站時 console 應印 `[isolation] … crossOriginIsolated=true`（ADR-4 計時效度前置）。
- [x] **determinism = N/A（明寫於交棒）**：WP-1 不含 sim loop（視角走 render/輸入路徑），故 determinism gate 不適用本 WP，**繼承給 WP-2**（sim 脊椎首次需斷言 tick→state 一致）。

### C. 真人 spot-check（必填；關閉 OQ-T3.a / T4.a / T5.d）
> 在**非 headless Edge（桌面）**真鎖定下做一次，把實測填進下表並回填 progress.md。`unadjustedMovement` 是否生效取決於真實瀏覽器/OS，無法由 headless 合成事件斷言——故必須真人跑。
- [x] **OQ-T3.a（研究效度，硬性記錄）**：click 鎖定後讀 console `[pointerlock] rawInputEnabled = …`，記錄**實測值 + 環境（瀏覽器版本 / OS）**。預期 `true`；若 `false`（走 fallback）須在 progress.md 標記為**可重現性 debt**，由 WP-7 匯出 metadata 反映降級。
- [x] **OQ-T4.a（無重大缺陷）**：鎖定後環顧——游標消失、視角方向跟手、正上/正下不翻轉、無 roll。數值「手感」校準屬 pilot（OQ-1.1），此處只驗無缺陷。
- [x] **OQ-T5.d（無重大缺陷）**：解除（Esc）後面板出現、拖 sensitivity/FOV slider 視角即時對應、再 click 重取鎖定。範圍/校準屬 pilot。

> **若暫時無法在非 headless 環境跑 C 段**：**OQ-T3.a 不可省**（研究效度根）——可暫記為 `pending` 但須指定 owner + trigger 並列入 **WP-2 entry-gate 複驗**；OQ-T4.a / T5.d 可隨後補，但須在交棒 note 明標 `spot-check pending`，不得靜默放行。

### D. 收尾
- [x] map 下方 4 項 PLAN 驗收 → 證據；勾選。
- [x] [progress.md](progress.md) 寫 `Outcomes & Retrospective`：填 C 段 spot-check 紀錄表（含 `rawInputEnabled` 值 + 環境）、未決 sensitivity 校準（pilot）、WP-1 retrospective。
- [x] 翻 [頂層索引](../../README.md) §2 WP-1 狀態 ✅；翻 [task-checklist.md](task-checklist.md) T6 Done box ✅。
- [x] （條件性）`gh pr create`（base `main`；目前在 `main`，建議先開 branch）或記本機證據。

## 真人 spot-check 紀錄表（已執行 2026-06-30）
> 環境：**非 headless Edge 桌面版（Chromium, WebGPU backend）/ Windows 11 (10.0.26200)**。

| OQ | 項目 | 實測 | 判定 |
|----|------|------|------|
| OQ-T3.a | `rawInputEnabled` 實際值（console main.ts:66） | **`true`** | ✅ pass — 原始輸入生效（OS 加速已關），無 fallback、無 WP-7 debt |
| OQ-T4.a | 視角環顧 / 不翻轉 / 無 roll | 跟手、±89° clamp、地平線水平 | ✅ pass |
| OQ-T5.d | 解除→面板→slider 即時→重取 | 面板現身、sensitivity→0.90 即時、重鎖 ×4 | ✅ pass |

> **console 雜訊定性**：一般視窗曾見一條紅 `Uncaught SyntaxError: Invalid or unexpected token @ VM69:1`；經**無痕視窗（擴充關閉）複測 → 紅字消失、「沒有問題」**，確認為 Edge 擴充/Copilot 注入的 eval 腳本,**非 WP-1 程式**（我方模組皆具名 source、app 完整運作）。WP-1 app console = 0 error。

## Acceptance criteria（PLAN WP-1）→ evidence
- [x] 點擊鎖定、Esc 解除 → T2（狀態機 spec 綠 + C 段真人驗）
- [x] 無 OS 加速的視角（或 fallback 記錄）→ T3（三分支 spec 綠 + **OQ-T3.a 實測值**）
- [x] 可環顧四周（夾角）→ T4（旋轉/clamp spec 綠 + OQ-T4.a）
- [x] sensitivity/FOV 可調並即時生效 → T5（全鏈 spec 綠 + OQ-T5.d）

## Definition of Done
- A 段三檢全綠（指令證據入 progress.md）。
- B 段硬約束：isolation 綠；determinism N/A 明寫於交棒 note。
- C 段三個 spot-check 全部關閉並留證據；**OQ-T3.a 的 `rawInputEnabled` 實測值 + 環境已記入 progress.md**（若 fallback，已標 WP-7 debt；若 pending，已指定 owner+trigger 並列入 WP-2 entry 複驗）。
- 4 項 PLAN 驗收勾選有證據；頂層索引 WP-1 ✅；task-checklist T6 ✅。
- 交棒 note 指向 WP-2（繼承 determinism gate + 用 1.4 視角做內插驗證）/ WP-4（場景）。

## Commit
`docs(wp-1): exit gate — 驗收 map + 硬約束複驗 + 真人 spot-check + 頂層索引 + 交棒 WP-2/4`
