# T-exit — 教練報告 v1(phase + L/R 曲線)+ `analysis-phase-curves.md` 定稿 + WP-30 收斂

> Part of [WP-30 trajectory-metrics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2 + T3 全綠(T1 為 T2 的前置,已含) |
| **Risk / Cplx** | — / Low |
| **Touches** | MODIFY `research/src/report/coach_report.py` + tests;ADD 範例報告至 `notebooks/t-exit/outputs/`;MODIFY `docs/operational/analysis-phase-curves.md`(定稿)、[../README.md](../README.md) §3/§8/§9、[exec-plan/README.md](../../../README.md) §2、[CONTEXT.md](../../../../../CONTEXT.md) |
| **狀態** | ✅ 完成(2026-08-10) |

## Objective

FR-D16 第二版:把 T2 的三段分解與 T3 的 L/R 曲線疊進**同一個一鍵靜態報告**,並保住 v0 建立的三條紀律 —— 單檔自足、deterministic、每個量帶 `n` / flags / version / 效度層級。這是 WP-32 晉升清單(OQ-S4-4)的直接輸入。

## In scope

- **`coach_report.py` → `coach-report-v1`**:
  - 沿用既有 CLI:`uv run python src/report/coach_report.py --export <path> [--group-by side|ads|weapon_mode] [--out <dir>]`;**新增區塊**:① REC/MR/V 三段(逐 side 與整體的 n + 分佈)② `rec_minus_detect_ms` 一致性摘要 ③ L/R 101 點曲線(inline SVG)+ n(L)/n(R) + 排除計數。
  - **v0 的六個量與其版本字串逐位不變**;新增量各自帶 `phase-v1` / `curve-v1` / `detect-v1` 與效度層級標註。
  - **deterministic 不得破壞**:無 wall-clock、無隨機 id、穩定排序;單檔自足(inline CSS/SVG、零外部資源)。
  - **`--group-by` 只分割既算好的列**,參數區塊逐位相同;**不得**逐組重跑任何 pre-registered 判定(沿用 v0 對 `sync-v1` 的紀律,避免事後多重比較)。
  - **教練報告紅線(C-D3 / GD-20)**:新增量若在 T2/T3 被判 `blocked-by-data` 或系統性分歧未解,一律標「研究向」或不進主表。
- **報告的效度限制段**(必寫,沿用 KI-004 R-7 紀律):三份真實樣本為**同一受試者 P001、同一台 240 Hz 機器、同一 drill config、同日三 session**;不支持族群推論;`--group-by ads` / `weapon_mode` 在真實資料上仍退化成單格(OQ-S4-11)。
- **`analysis-phase-curves.md` 定稿**:`phase-v1` + `curve-v1` 的定義、frozen parameter registry、封閉 flags 詞彙表、報告載體契約、**已知限制**(單受試者、t_detect 一致性結論、短窗/濾波退化、L/R 樣本數、跨 session 不併池)。
- **文件對帳**:
  - [../README.md](../README.md) §3 WP-30 狀態翻 ✅、§6 task 拆解與估時對帳、§8 OQ-S4-14/15/16 現況更新、§9 對帳清單補 `analysis-phase-curves.md`;
  - [exec-plan/README.md](../../../README.md) §2 階段 D 表 WP-30 狀態;
  - [CONTEXT.md](../../../../../CONTEXT.md):REC/MR/V phase、101 點正規化曲線、動作簽名、`t_detect`(research 側)隨本切片回寫(stage4 §9 已列為待辦);
  - 與 `compute.ts` / TS 推導的任何語意分歧確認已入 [DECISIONS.md](../../../DECISIONS.md)。

## Out of scope

- WP-31 的 SPARC / xcorr / Fitts;WP-32 的 TS 晉升與結果頁、驗收清單 D。
- 互動式報告(OQ-S4-6 升級觸發條件未達)。
- 重新採樣或擴充樣本(A2-T1 已收斂;新錄製屬 OQ-S4-11 觸發條件)。

## Steps

- [x] `coach_report.py` 擴充三個區塊 + 測試(區塊存在、n/flags/version 標註非空、`--group-by` 三種皆 exit 0、無樣本時顯示 `n=0` 而非 crash)。
- [x] 三份真實 + 合成 fixture 各產一份報告 → `notebooks/t-exit/outputs/`(committed、deterministic)。
- [x] 既有四份 v0 範例報告重跑:差異須逐項可解釋(資料或凍結契約改變),否則視為 determinism 破損。
- [x] `analysis-phase-curves.md` 定稿(定義 + registry + 詞彙表 + 載體契約 + 已知限制)。
- [x] 文件對帳四處(WP README §3/§6/§8/§9、exec-plan README §2、CONTEXT.md、DECISIONS 確認)。
- [x] `uv run pytest` + `npm run test:ci` 兩份輸出貼 progress。
- [x] [task-checklist.md](task-checklist.md) 全列翻 ✅;progress.md 收斂段落(Progress / Decision Log / Surprises / OQ)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **一鍵報告綠** | 三份真實 fixture + 合成 fixture 各 exit 0 且產出單一自足 HTML |
| ② | **v0 契約未破** | 既有六個量的值與版本字串逐位不變;既有 `test_coach_report*.py` 全綠(必要修改僅為新增區塊斷言) |
| ③ | **新增量帶完整標註** | phase 三段、`rec_minus_detect_ms`、L/R 曲線各顯示 `n`、flags 計數、version(`phase-v1`/`curve-v1`/`detect-v1`)與效度層級(測試斷言標註欄非空) |
| ④ | **deterministic** | 同一輸入連跑兩次 byte-for-byte 相同;committed 範例報告的任何 diff 皆有解釋 |
| ⑤ | **分層不改參數** | `--group-by` 三種執行的參數區塊逐位相同;無任何 pre-registered 判定被逐組重跑(測試斷言) |
| ⑥ | **紅線落地** | 被判 `blocked-by-data` 或分歧未解的量不出現在主表(人工檢核 + 測試斷言) |
| ⑦ | **效度限制段存在** | 報告與 `analysis-phase-curves.md` 各含單受試者/單機器/三 session 的限制文字 |
| ⑧ | **兩閘綠** | `uv run pytest` exit 0 且 `npm run test:ci` exit 0(含 T1 的 `detect-parity.test.ts` 與既有 parity 測試) |
| ⑨ | **文件對帳完成** | 四處對帳各有 commit 內容;`analysis-phase-curves.md` 含 version 與已知限制清單 |
| ⑩ | **零 `src/` 變更** | 全 WP 累計 `git diff --stat` 對 `src/` 為空(T1 只新增 `tests/golden/research/`) |

## Commit

`docs(wp-30): T-exit — 教練報告 v1(phase + L/R 曲線)+ analysis-phase-curves.md 定稿 + 文件對帳`
