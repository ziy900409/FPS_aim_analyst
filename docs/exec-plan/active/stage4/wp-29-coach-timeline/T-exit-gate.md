# T-exit — 教練報告 v0(時間軸 + Sync,條件可分層)+ WP-29 收斂

> Part of [WP-29 coach-timeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 全綠(T3 依 T2 判定,可為 skipped/deferred) |
| **Risk / Cplx** | — / Low |
| **Touches** | ADD `research/src/report/coach_report.py` + tests;ADD 範例報告至 `notebooks/*/outputs/`;MODIFY `docs/operational/analysis-peek-timeline.md`(定稿)、[../README.md](../README.md) §3/§8/§9、[exec-plan/README.md](../../../README.md) §2、[CONTEXT.md](../../../../../CONTEXT.md) 術語 |
| **狀態** | ⬜ |

## Objective

FR-D16 首版:把 T1 的時間軸與 T2 的 Sync 族收斂成**單一命令產出的靜態教練報告**,並關閉 OQ-S4-6(報告載體)。這是 WP-30/31 後續往報告 v1/v2 疊加的骨架,也是 WP-32 晉升清單的輸入。

## In scope

- **`coach_report.py`**(report 層,比照 D-28.11 的落點紀律 —— 寫檔與 print 在此合法):
  - 單一命令:`uv run python src/report/coach_report.py --export <path> [--group-by side|ads|weapon_mode] [--out <dir>]`;
  - 內容:① drill 摘要(peek 數、outcome 分布、`firstShotHitRate`)② 逐 peek 時間軸圖 ③ 三個交叉驗證量的統計 ④ Sync 族三指標 + 精度判定 ⑤ 每指標的 `n` + flags 計數 ⑥ 參數版本 metadata(`sync-v1`、`analysis-peek-timeline` version、`seg-v1`、來源檔名);
  - **載體 = 單檔靜態 HTML**(圖以 inline SVG/base64 內嵌,可直接寄送);
  - **條件分層**:`--group-by` 對 `side` / `ads` / `weapon_mode` 分組輸出,**分層不改任何參數**。
- **教練報告紅線落地(C-D3 / GD-20)**:報告內每個量標註來源與效度層級 —— 「與結果頁對表通過」(T1 三量)/「新構念,精度判定 = X」(Sync 族);未通過構念驗證者一律不進報告主表。
- **`analysis-peek-timeline.md` 定稿**:T1/T2 的定義 + flags 詞彙表 + 版本字串 + **已知限制**(±1 tick 量化、單一真實樣本且零 strafe、projectile 跨窗命中處置、無 kill/timeout 事件故由 fire/hit 推導)。
- **文件對帳**:
  - [../README.md](../README.md) §3 WP-29 狀態翻 ✅、§8 OQ-S4-6 關閉 + OQ-S4-12/10 現況更新、§9 對帳清單補 `analysis-peek-timeline.md`;
  - [exec-plan/README.md](../../../README.md) §2 階段 D 表 WP-29 狀態;
  - [CONTEXT.md](../../../../../CONTEXT.md):Release-to-Click Sync、peek 時間軸、`t_release`、outcome 詞彙、quality flags 隨本切片回寫;
  - 若 T1 期間發現與 `compute.ts` 的語意分歧 → 確認已入 [DECISIONS.md](../../../DECISIONS.md)。

## Out of scope

- WP-30/31 的任何指標(phase / 101pt / SPARC / xcorr / Fitts)。
- 互動式報告(OQ-S4-6 的升級觸發條件未達)。
- 驗收清單 D(WP-32 T-exit)。

## Steps

- [ ] `coach_report.py` + 測試(產出檔存在、內容含必要區塊、`--group-by` 三種分層各跑通、缺 Sync 樣本時報告不 crash 而是顯示 `n=0` + 判定)。
- [ ] 於合成 fixture 與真實 fixture 各產一份報告 → `notebooks/*/outputs/`。
- [ ] `analysis-peek-timeline.md` 定稿(定義 + 詞彙表 + version + 四項已知限制)。
- [ ] 文件對帳五處(WP README §3/§8/§9、exec-plan README §2、CONTEXT.md)。
- [ ] `uv run pytest` + `npm run test:ci` 兩份輸出貼 progress。
- [ ] [task-checklist.md](task-checklist.md) 全列翻 ✅;progress.md 收斂段落(Progress / Decision Log / Surprises / OQ)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **一鍵報告綠** | `uv run python src/report/coach_report.py --export <真實 fixture>` exit 0 且產出單一 HTML 檔;合成 fixture 同樣 exit 0 |
| ② | **條件分層可用** | `--group-by side` / `ads` / `weapon_mode` 三次執行皆 exit 0,報告內每組各自顯示 `n`;分層前後參數 metadata 逐位相同 |
| ③ | **每指標帶 n + flags + 版本** | 報告內六個量各自顯示 `n`、flags 計數與其來源版本字串(測試斷言區塊存在) |
| ④ | **紅線落地** | 報告內每個量標註效度層級;無任何未過驗證的量出現在主表(人工檢核 + 測試斷言標註欄非空) |
| ⑤ | **交叉驗證仍綠** | `npm run test:ci` exit 0(含 T1 的 `timeline-parity.test.ts` 與既有 `epsilon-parity.test.ts`) |
| ⑥ | **research 閘綠** | `uv run pytest` exit 0(輸出貼 progress) |
| ⑦ | **文件對帳完成** | 五處對帳各有 commit 內容;`analysis-peek-timeline.md` 含 version 與四項已知限制 |
| ⑧ | **T3 狀態明確** | T3 標記為 `executed` / `skipped` / `deferred` 三者之一,且附 T2 判定引用 |

## Commit

`docs(wp-29): T-exit — 教練報告 v0(時間軸 + Sync,條件分層)+ analysis-peek-timeline.md 定稿 + OQ-S4-6 關閉`
