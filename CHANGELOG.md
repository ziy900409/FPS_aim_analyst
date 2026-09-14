# CHANGELOG

本檔以 **stage / WP / 里程碑**為單位記錄版本。逐 task 的 episodic 記錄仍在各 WP 的
`progress.md` 與 git history；**WP 狀態的現行權威是
[docs/exec-plan/README.md](docs/exec-plan/README.md)**，本檔只做版本切面的索引。

版本號語意：本專案是研究用量測工具。`0.x` 表示**量測協定與指標語意尚未對外凍結**
（`protocolVersion`、指標 registry 版本字串仍可能升版）。`1.0.0` 保留給協定與指標
registry 正式凍結、且 M13／M18 人工閘收斂的那一版。

---

## [0.1.0] — 2026-09-14

**首次定版**（tag `v0.1.0`；此前 885 個 commit 無任何 tag）。涵蓋從空場景到
「可排程並執行完整選手評測 session、產出教練報告與趨勢」的全鏈路。

### 已交付範圍

| 階段 | WP | 交付內容 | 里程碑 |
|---|---|---|---|
| A（`completed/stage1/`） | WP-0 ~ 9 | 三迴圈骨架 + `SharedState`、Pointer Lock 原始輸入、`TargetManager`／`t_visible`、`HitDetector` + 簡化 counter-strafe、資料驅動 `DrillConfig`、`DataRecorder` arena + JSON/CSV 匯出、即時 HUD | **M1–M4**（2026-07-03） |
| B（`completed/stage2/`） | WP-10 ~ 18 | CS2 後座力數學核心（彈道表 + punch + inaccuracy）、`WeaponConfig`／開火／彈匣、感度換算與射線注入、movement physics + velocity gate、軌跡校準、匯出 schema v2 + 壓槍指標、F5 移動 drill + 目標 sub-tick 命中內插 | **M5–M8**（2026-07-09） |
| C（`completed/stage3/`） | WP-19 ~ 22 | 場景系統（`SceneConfig` + GLTF 管線 + 淨空驗證 + 雜亂度階層場景）、解析度模式／fullscreen／資格閘／frame-time log、seeded spawn + pop-in 偵測 drill 與 `t_detect` 離線推導 | **M9–M10**（2026-07-10） |
| E（`completed/stage5/`） | WP-23 ~ 26 | BR 遠距跟槍模組：目標 hitbox 單一來源（含 sphere）、ADS、projectile 彈道 + render-only tracer | **M11–M12**（M13 待研究者實機手動回填，#32） |
| D（`completed/stage4/`） | WP-28 ~ 32 | 選手表現分析管線 `research/` 層（`seg-v2`／`phase-v1`／`curve-v1`／`sync-v1`）、SPARC／xcorr／Fitts 三份判定、`coach-report-v2`、golden parity 晉升進 `src/metrics/` | **M14–M15**（2026-08-17） |
| F（`completed/stage6/`） | WP-33 ~ 39 | 個人瞄準能力測試框架 v1（`protocolVersion=1.0.0` 暫定凍結） | **M16**（2026-08-25） |
| G（`completed/stage7/`） | WP-40 ~ 42 | 選手測試流程前端優化 | **M17**（2026-08-25） |
| H（`active/stage8/`） | WP-43 | session entry restructure（T-exit 完成，採納／歸檔延後） | — |
| I（`active/stage9/`） | WP-44 ~ 47 | additive drill／UI（WP-45／46／47 ✅；WP-44 🟡） | — |
| J（`active/stage10/`） | WP-48 ~ 51 | 本機 session history／3D state replay／trends；automated gate ✅ | **M18 🟡**（manual／owner 閘待收斂） |
| K（`active/stage11/`） | WP-52 ~ 55 | 正式 `peek_click_transfer_v1` assessment（WP-52／53）＋ tracking pilot 與 on-target 觀測（WP-54／55） | **M19**（2026-09-02） |
| L（`active/stage12/`） | WP-56 ~ 58 | micro flick 三靶走廊、Spider Shot 大幅度拉槍、Session Program 排程層（`compileSessionProgram()` + `SessionRunner`） | —（T-exit 即交付，2026-09-07 ~ 09-09） |
| M（`active/stage13/`） | WP-60、62 ~ 66 | 逐筆原始滑鼠取樣匯出（opt-in）、Session Plan 每列武器、tracking pilot drills 入排程、drill 待命閘 + 3 秒倒數 + Pointer Lock 效度旗標、命中視覺回饋 | —（T-exit 即交付，2026-09-09 ~ 09-12） |

### 尚未納入本版

- **WP-59**（micro flick v8 替補間距）、**WP-63**（v8 量測基礎層）、**WP-67**（`meta.opening` 匯出標記）：規劃完成、未開工。
- **WP-61**（感測器離地判準驗證）：T1 儀器已交付，T2 待真人標註 cohort。
- **WP-44**：🟡 進行中。
- **`active/stage14/`**：草案，尚未升格為正式 WP；不在本版交付範圍內。
- **M13 / M18**：兩個里程碑的人工閘（研究者實機回填、manual walkthrough／owner 收斂）尚未宣告。

### 已知問題

13 個 KI 仍為 🔴 未修，完整清單見 [`docs/known_issue/`](docs/known_issue/)。其中**直接影響量測效度**的四項需在使用本版資料前先讀：

- [KI-031](docs/known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) — aim 更新慢於 sim 時 sustained-tick 偵測失效。
- [KI-034](docs/known_issue/KI-034-prestimulus-baseline-overlaps-prior-engagement.md) — 500 ms 前刺激基線窗會吃進前一次拉槍。
- [KI-035](docs/known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md) — 改感度／FOV 後 mouse gain 未更新（silent data corruption）。
- [KI-037](docs/known_issue/KI-037-valid-duration-includes-countdown.md) — valid duration 含倒數時間。

### 授權

本版起採 **Apache-2.0**。場景資產授權與出處見 [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)；
NVlabs/FPSci（CC BY-NC-SA 4.0）的程式碼與 config 從未進入本 repo，僅參考方法學與
schema 欄位語意（[CLAUDE.md](CLAUDE.md) §4 GD-11）。
