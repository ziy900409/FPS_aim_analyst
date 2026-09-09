# WP-61 T-exit — 驗收、結論與去向

## Objective

逐條驗收 FR-61.1～11 / NFR-61.1～7，並交付本 WP 的**判定與其宣稱範圍**。**不得**以「實作完成」結案；每一條都要有指令、輸出或斷言檔名。

> 本 WP 的結案有三種合法形態：**通過**、**不可靠分離**、**證據不足**。三者的驗收嚴格度相同 —— 一份寫得清楚的負面結論不是次級品，是 C-D3／GD-20 明文要求的產出。

## Acceptance criteria

| ID | 條件 | 證據來源 | Blocking |
|---|---|---|---|
| **A-61.1** | 標註通道關閉時匯出與本 WP 之前逐位相同 | T1 字串比對測試 | ✅ |
| **A-61.2** | 標註通道開啟時 sim 狀態逐位一致（`TickRecord` 全欄位 `Object.is`，四 FPS parity） | T1 | ✅ |
| **A-61.3** | 標註 code 不進 `TickRecord.keys`／`state.held`（結構性隔離斷言） | T1 | ✅ |
| **A-61.4** | 標註錄製不新增每 tick 配置（`push` 計數差額 = 實際標註次數） | T1 | ✅ |
| **A-61.5** | 標註事件缺席合法；宣稱不符擲指名欄位 typed error（五格 fixture） | T1 | ✅ |
| **A-61.6** | 標註與空洞的獨立性：候選事件表的 `label` 只來自標註事件（掃描 + 測試） | T1 + T2 | ✅ |
| **A-61.7** | 每份 cohort run 的六項可用性覆核有實際值；作廢者具名 | T2 | ✅ |
| **A-61.8** | 標註完整性四欄有實際數字；作廢規則依 T0 凍結上限執行 | T2 | ✅ |
| **A-61.9** | F3 檢定（lift／pause 標註延遲有無系統性差異）有分布數字與二元判定 | T2 | ✅ |
| **A-61.10** | Stage 1 切段 golden 已 commit 且有「TS 重現 golden」的防過期測試 | T2 | ✅ |
| **A-61.11** | 資料充分性判定為明確二元；未達時差多少已具名 | T2 | ✅ |
| **A-61.12** | 四層消融 × 每個 θ 的混淆矩陣、指標、增益齊全 | T3 | ✅ |
| **A-61.13** | 校準集與 held-out 兩組數字都已報告，差距已評述 | T3 | ✅ |
| **A-61.14** | PA 參數五欄表齊全；程式碼內零未換算 PA 常數 | T3 | ✅ |
| **A-61.15** | 可重現：同 seed 兩次報表雜湊逐位相同 | T3 | ✅ |
| **A-61.16** | 二元判定的三欄對照（規則原文 → 實際值 → 判定）齊全 | T3 | ✅ |
| **A-61.17** | C-D1／C-D2 掃描綠（Python 零 TS import、`algorithms/` 零 I/O） | T2 + T3 | ✅ |
| **A-61.18** | C-D4 命名雙向掃描綠 | T1（+ T4） | ✅ |
| **A-61.19**（**僅 promote 路徑**） | C-D5 parity 綠 + golden 產生腳本記名 + 突變驗證 | T4 | 條件式 |
| **A-61.20**（**僅 promote 路徑**） | `src/` 內對新判準零 importer；build 產物不含 | T4 | 條件式 |
| **A-61.21** | `CONTEXT.md` 兩個構念互相指名、差異明列 | T4 或 T-exit | ✅ |
| **A-61.22** | 結論的**宣稱範圍**（OQ-61.6）已明文寫入，非腳註 | T-exit | ✅ |

## Steps

1. 逐條跑 A-61.1～22，把**指令 + 實際輸出**（非「已通過」）貼進 [progress.md](progress.md)。條件式項目在非 promote 路徑上標「不適用（判定為 X）」並說明。
2. 跑收尾閘：`npm run typecheck`（兩個 tsconfig）、全量 `npx vitest run`、`npx vite build`、`uv run pytest`、全量 Playwright。
   - ⚠️ 全量 Playwright 前**先查 port**：`Get-NetTCPConnection -LocalPort 5173,4173 -State Listen`。有人在 → **問使用者**，不得自行終止（WP-60 TF3）。
   - ⚠️ 以 `--workers=1` 取門檻讀數（[KI-030](../../../../known_issue/)）；重現失敗時**第一件事是複製整個 `test-results/`**。
   - ⚠️ 既存 [KI-027](../../../../known_issue/) 會讓 `test:ci` exit 1 —— **明確揭露並歸因**，不得掩蓋、也不得算在本 WP 頭上。
   - ⚠️ 跑完確認 `.playwright-tmp/history-dev`／`-preview` 存在（證明用的是測試 root）；目錄數 > 數百時先清（累積會讓 history-library spec 轉紅）。
3. 逐項歸屬全量測試數的差額（本 repo 有平行 session，數字會涵蓋他人工作）。
4. 覆核 FR/NFR traceability（README §4.1）無遺漏。
5. 覆核 README §2b 硬約束表逐條仍成立（特別是決定性、三迴圈邊界、C-D3、C-D4、C-D5）。
6. 依 T3（或 T4）的判定，產出 README §5 對應情境的**全部**交付物。
7. **入帳 GD-37**（原始輸入取樣的抬滑鼠構念驗證結論）到 [`DECISIONS.md`](../../../DECISIONS.md)。⚠️ **編號必須在寫入當下重新查最大值** —— GD-32／33／34／35／36 已各撞過一次（GD-35 ②）。
8. 更新 [`../README.md`](../README.md) §2 的 WP-61 狀態列與 [`docs/exec-plan/README.md`](../../../README.md) §2 的 stage13 區塊（**只 stage 自己的行**）。
9. 若判定為 `not-separable` 或 `insufficient-evidence`：把「若要再試，需要什麼樣的資料或儀器」寫成下一個 WP 的 entry 條件，放進 [`../README.md`](../README.md) §4 的相依圖。

## Definition of Done

- [ ] A-61.1～22 逐條有指令與輸出；未達成者**明確列出並歸因**，不得省略；條件式項目的「不適用」已附判定理由。
- [ ] 五個收尾閘的實際數字記入 `progress.md`；`test:ci` 若 exit 1，成因逐條歸屬（既存 KI vs 本 WP vs 平行 session）。Playwright 若未執行，**具名說明為何**（不宣稱通過，也不宣稱失敗）。
- [ ] FR/NFR traceability 表逐條對帳完成。
- [ ] README §2b 硬約束表逐條覆核，變動處已更新。
- [ ] **判定已產出且宣稱範圍明文寫入**：`promote` ／ `not-separable` ／ `insufficient-evidence` 三者之一，附 T0 決策規則的字面對照。
- [ ] README §5 對應情境的交付物齊備（三種情境各有其清單）。
- [ ] GD-37（或當下實際可用的編號）已入帳 `DECISIONS.md`，且入帳前重新查過最大值。
- [ ] `../README.md` §2 與 `docs/exec-plan/README.md` §2 狀態已同步（只含自己的變更行）。
- [ ] `progress.md` 的 Decision Log／Surprises／Open Questions 三節完整；未收斂的 OQ 標明 owner 與 deadline。
- [ ] `CONTEXT.md` 已更新（構念定義或「本輪未建立新構念」的明文紀錄）。

## Commit

```text
docs(stage13): close WP-61 lift-off validation
```
