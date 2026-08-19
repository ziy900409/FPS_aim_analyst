# 階段 D 驗收清單 D — WP-32 T-exit / M15(stage4 交付)

> M15(stage4 交付:瞄準 × 急停教練分析管線 pilot-ready)的驗收對照。每項有自動測試入口,無手動回填項
> (本清單全數為離線分析管線 + 結果頁 additive 呈現,無新增遊玩手感面)。
> Companion:[analysis-peek-timeline.md](analysis-peek-timeline.md) · [analysis-phase-curves.md](analysis-phase-curves.md) ·
> [analysis-advanced-diagnostics.md](analysis-advanced-diagnostics.md) ·
> [WP-32 progress](../exec-plan/completed/stage4/wp-32-dashboard-integration/progress.md)。

---

## 0. 執行基線

| 命令 | 結果 |
|---|---|
| `npm.cmd run test:ci`(`tsc --noEmit && vitest run && playwright test`) | ✅ exit 0 — `tsc --noEmit` clean;Vitest **98 files / 810 tests passed**(每次嘗試皆 100% 綠,含四支 `promoted-*.test.ts` + 既有 `timeline-parity`/`epsilon-parity`/`detect-parity`);Playwright 於資料夾移動前第五次嘗試達成 **21/21 全綠 exit 0**。**Sandbox note**:移動前四次嘗試、移動後三次嘗試各遇 1 支隨機 Playwright e2e(`backend.spec.ts`/`input-sampler.spec.ts`)因 `gotoAppReady` 等 `window.__aimDebug` 於 5000ms timeout——與 T1–T5 progress 記載的 dev-server flakiness 同構,非本切片程式碼問題(本切片對 `src/`/`tests/e2e/` 零 diff,僅文件 + 資料夾搬移);Vitest 100% 綠已足以證明資料夾移動未破壞任何 import/fixture 路徑(「連結型測試」關切點)。 |
| `uv run pytest -q --tb=short --color=no --basetemp ../.pytest_tmp_texit_full`(於 `research/`) | ✅ `466 passed`(與 WP-32 T5 的 pytest baseline 一致 — T-exit 為純文件切片,零 `research/` 程式碼變更,故通過測項數不變) |
| `graphify update .` | ✅ 已執行(AST extraction 2642 nodes / 5983 edges / 173 communities;`graphify-out/` 已更新) |

---

## 1. 驗收項

| # | 驗收項 | 判定 | 證據入口 | 狀態 |
|---|---|---|---|---|
| D-1 | 教練報告一鍵產出(FR-D16) | **A** | `research/src/report/coach_report.py`(`REPORT_VERSION = 'coach-report-v2'`);9 份 committed 範例 `research/src/modules/metrics/notebooks/t-exit/outputs/coach-report-*.html`(v0→v1→v2 累積,byte-deterministic,`test_repeated_generation_is_byte_identical` 覆蓋);[WP-29 progress T-exit](../exec-plan/completed/stage4/wp-29-coach-timeline/progress.md)(v0)· [WP-30 progress T-exit](../exec-plan/completed/stage4/wp-30-trajectory-metrics/progress.md)(v1)· [WP-31 progress T-exit](../exec-plan/completed/stage4/wp-31-advanced-diagnostics/progress.md)(v2) | ✅ |
| D-2 | 晉升指標 TS golden 對表綠 | **A** | 四支 `promoted-*.test.ts`(`tests/golden/research/promoted-kinematics.test.ts` / `promoted-segments.test.ts` / `promoted-phase-sync.test.ts` / `promoted-curve.test.ts`)皆在 `npm run test:ci` 內;容差三級([WP-32 progress D-32.2](../exec-plan/completed/stage4/wp-32-dashboard-integration/progress.md) P3):① SG 係數表 ≤1e-12 ② 浮點量 ≤1e-9 相對誤差 ③ 整數/flag/verdict 逐位相等 | ✅ |
| D-3 | `npm run test:ci` exit 0 **且** `uv run pytest` 綠 | **A** | 本檔 §0 原始輸出 | ✅ |
| D-4 | 每指標附效度證據(fixture + 真實檢核 + 已知限制) | **A/M** | `sync-v1` → [analysis-peek-timeline.md](analysis-peek-timeline.md) §Pre-registered precision decision;`phase-v1`/`curve-v1` → [analysis-phase-curves.md](analysis-phase-curves.md) `Known limits` 段 + `WP-32 TS promotion surface` 段;P2 三指標(未晉升)→ [analysis-advanced-diagnostics.md](analysis-advanced-diagnostics.md) `T-exit` 章節「Sample limits 總覽」 | ✅ |
| D-5 | **P2 三指標各有明確進退判定** | **A/M** | 見本檔 §1.1 | ✅ |
| D-6 | 結果頁晉升區塊在實機成立且統計 = 匯出 | **A** | `tests/e2e/full-drill.spec.ts` 斷言 promoted DOM 非 `blocked` 且 `sync-release-to-fire-ms` 顯示值 = 同一次 export payload 跑 `computePromotedMetrics()`;[WP-32 progress D-32.9](../exec-plan/completed/stage4/wp-32-dashboard-integration/progress.md)(單一 `ExportPayload` 派生兩條 metrics) | ✅ |
| D-7 | 引擎不變式未受損 | **A** | `git diff --stat 9a34560^..HEAD -- src/sim src/input src/loop src/data` 零輸出(零 diff);`git diff --stat 9a34560^..HEAD -- src/` 全部 17 個變更檔皆落在 `src/metrics/`、`src/ui/ResultScreen.ts`、`src/main.ts`、`src/testharness/`(dev-only 測試工具);`schemaVersion` 常數無 diff;決定性回歸零重錄(既有 `determinism.test.ts`/`tests/regression/*` 零修改全綠) | ✅ |
| D-8 | research ↔ src 單向隔離維持(C-D1) | **A** | `grep -rn "from .*\.ts\b" research/src` 零命中(research 零 TS import);`grep -rln "fixtures/golden\|fixtures/parity" src/` 唯一命中為 `src/metrics/filters/savitzkyGolay.ts` 檔頭 provenance 註解(非 runtime 讀取,凍結常數表內嵌於生產碼);其餘全在 `*.test.ts` 測試路徑 | ✅ |

### 1.1 D-5 — P2 三指標進退判定(逐項)

三個 P2 指標(WP-31)在本 WP 的晉升清單評估中**全數判定不晉升**——這是合格交付(C-D3:寧可少一個指標,不能有一個會說錯話的指標),理由與證據見 [WP-32 progress §0.6](../exec-plan/completed/stage4/wp-32-dashboard-integration/progress.md) 與 [analysis-advanced-diagnostics.md 的 WP-32 交接結論](analysis-advanced-diagnostics.md#wp-32-交接結論)。

| 指標 | 判定 | 理由(一句) | 證據 |
|---|---|---|---|
| SPARC(`sparc-v1`) | ❌ **不晉升**(`stratified_only`) | 段長階梯 `step_ratio = 0.7643 ≥ 0.5`,SPARC 僅可在同一 `padded_n` bucket 內比較,單一數字無法承載該限制條件 | [WP-31 progress D-31.6](../exec-plan/completed/stage4/wp-31-advanced-diagnostics/progress.md) |
| Key-Velocity xcorr(`xcorr-v1`) | ❌ **不晉升**(`research_only`) | `gate-v1` 三 session 判定:09:18/09:37 未過 ① circular-shift shuffle null(p=0.056/0.173);`coach_report` 分支由 AST 掃描證明在本樣本結構下不可達 | [WP-31 progress D-31.9](../exec-plan/completed/stage4/wp-31-advanced-diagnostics/progress.md) |
| Fitts(`fitts-v1`) | ❌ **不晉升**(`blocked-by-data` ×2 + `ok` r² 過低 ×1) | 09:18 `blocked-by-data`(`insufficient_d_ratio`,d_ratio=1.8343<2.0);**09:24 `blocked-by-data`(`insufficient_id_range`,經 [KI-008](../known_issue/KI-008-fitts-v1-threshold-drift-and-xcorr-empty-table.md)/[BD-008](../known_issue/BUGFIX-DECISIONS.md) 於 2026-08-17 修正門檻偏離後更正,原判定為 `ok` 但屬 bug)**;09:37 `ok` 但 r²=0.0339 過低,加上 D 內生性(OQ-S4-19)與 MT 含反應時間兩項限制,單一 TP 數字會誤導教練 | [analysis-advanced-diagnostics.md T-exit 三份判定收斂表](analysis-advanced-diagnostics.md#三份判定收斂表);[BUGFIX-DECISIONS.md BD-008](../known_issue/BUGFIX-DECISIONS.md) |

> **文件對帳註記**:[WP-32 progress.md §0.6](../exec-plan/completed/stage4/wp-32-dashboard-integration/progress.md) 的 T0 決策記錄(2026-08-17 早於 KI-008 修復落地的引用時序)沿用 WP-31 T-exit 原始 D-31.10 數字(「09:24/09:37 `ok` 但 r² 僅 0.0669/0.0339」);KI-008/BD-008 已於同日修正 `fitts-v1` 門檻偏離,使 09:24 改判 `blocked-by-data`。**結論不變**(Fitts 三 session 皆不支持晉升),此處以 `analysis-advanced-diagnostics.md`(KI-008 修正後的權威版本)為準,不回改 D-32 Decision Log 既有條目(pre-registration 紀律:事後只記正確來源,不原地改寫歷史決策文字)。

---

## 2. 手動回填項

**無**。本 WP 的交付面全為離線分析管線(教練報告一鍵產出)與結果頁 additive 呈現(純資料呈現,非新遊玩機制),不涉及新的遊玩手感、視覺特效或輸入手感面,§1 全部驗收項皆有自動測試入口。T5 的「統計 = 匯出」不變式已由 E2E(`tests/e2e/full-drill.spec.ts`)在實機路徑上驗證,不需額外人工遊玩回填。

---

## 3. 已知限制

- **效度聲稱範圍**:單一匿名受試者 **P001**、**n=3 tick-integral session**(2026-08-07 09:18 / 09:24 / 09:37,同一台 240Hz 機器、同一 drill config)、非母體層級證據(KI-004-S1/README §R-7)。
- **WP-31 三指標全數未進結果頁與教練報告主表**(C-D3):SPARC/xcorr/Fitts 三構念在本樣本結構下的最高判定皆為研究向或 `blocked-by-data`,詳見 §1.1。
- **`gate-v1` 的上限條款**:三件組(circular-shift shuffle null / bootstrap CI / 奇偶半分)只證明「訊號非偶然 + 估計量穩定」,**不證明個體差異可靠度**;`coach_report` 分支在本樣本結構下由程式碼保證不可達。升級路徑 = 取得 ≥3 受試者後另立 `gate-v2` 重跑。
- **仍 open 的 OQ**:**OQ-S4-10**(`t_release` 在無 counter 事件時的 `release_inferred_no_counter` fallback,兩份真實 fixture 樣本數為 0,未驗證跨 peek 可比性)、**OQ-S4-11**(兩份真實 fixture 皆無 ADS-on / projectile 樣本,條件分層缺真實對照)、**OQ-S4-17**(REC-end 與 `t_detect` 存在系統性分歧,pooled median −78.1ms,根因待獨立驗證)、**OQ-S4-19**(Fitts 的 D 內生於上一 peek 過衝而非受控設計)、**OQ-S4-20**(xcorr 的 session 統計量為「逐 peek 對 65 個 lag 取最大 \|r\|」,屬最大化統計量,circular-shift null 在 5.6%/17.3% 抽樣中亦達觀測水準)。
- **`filter_degenerate` 在 TS 晉升面不存在**:TS 側不移植 Butterworth(僅供報告疊圖平滑,不參與 REC/MR/V 邊界),故無法產生此 flag;golden 對表逐 peek 比較 flags 集合時**刻意排除**此一項,其餘 flag 逐位相等(D-32.4)。
- **單 drill n ≈ 20 peeks**:phase 非退化約 59/60(pooled),單 drill ~19–20;結果頁強制顯示 `n` + `p50`/`mean`/`SD`,不呈現單一分數(D-32.8/OQ-S4-22)。
- **Fitts 09:24 判定於 T-exit 撰寫當日經 KI-008 修正**(見 §1.1 文件對帳註記),提醒後續讀者以本檔與 `analysis-advanced-diagnostics.md` 為準,不以 WP-32 progress.md 早期 T0 引用文字為權威數字來源。
