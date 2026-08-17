# WP-29 — Progress / Decision Log / Surprises / Open Questions

> Running log。Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)
> 寫入時機:每個 task 完成時與切片一起 stage(exec-plan/README.md §5)。

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-05 | 上游只引用、不重跑；`compute.ts` 五項基準、`counter` 條件性語意、`sync-v1` 三分支與 KI-004 使用界線已凍結；OQ-S4-12 關閉及 OQ-S4-10/11 已對帳至 stage4 |
| T1 逐 peek 時間軸 + 交叉驗證 | ✅ | 2026-08-05 | targeted `31 passed` + final metrics/purity `16 passed`;完整 `uv run pytest` **89 passed**;`npm run test:ci` **83 files / 644 Vitest + 19 Playwright passed**;三份 parity ≤1e-9;共享窗界與 t3 leading-ω 對帳完成 |
| T2 Sync 族 + 精度判定 | ✅ | 2026-08-05 | `sync-v1` 三指標 + flags + 三分支；targeted **35 passed**、完整 research **106 passed**、engine **644 Vitest + 19 Playwright passed**；三 fixture deterministic report 完成 |
| T3 additive key 事件(gated) | ✅（使用者 override 實作） | 2026-08-05 | **原 gate 判定：skipped**（09:39 兩量皆 `sufficient`，**未變更**）。使用者 override「skipped」→ 以 **additive observability / direct key-event evidence** 實作。commit `dcdafbd`；targeted **43 passed**、full research **118 passed**、engine `tsc` exit 0 / **651 Vitest** / **19 Playwright** 全綠；`sync-precision.json` 逐位未變。見下方 T3 Evidence + D-29.8~D-29.11、S-29.8~S-29.10 |
| T-exit 教練報告 v0 | ✅ | 2026-08-05 | 一鍵 `coach_report.py` → 單檔自足靜態 HTML;六量各帶 n/flags/版本/效度層級;三種 `--group-by` 綠且參數區塊逐位相同;四份 committed 範例 deterministic;targeted **64 passed**、完整 research **168 passed**、engine **83 files / 651 Vitest + 19 Playwright passed**;`analysis-peek-timeline.md` 定稿、OQ-S4-6 關閉 |

---

## 進場事實(2026-08-05 規劃期;非 task 產出,供 T0 引用)

上游:WP-28 T1 ✅(2026-08-04,ingest/`check_dt`/合成產生器)· **M14 🟡**(②於 2026-08-05 撤回,見 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / K-2;①③④⑤⑥ 維持)· 目前無其他 active WP,零檔案熱區競爭。

> **WP-29 的硬相依只有 WP-28 T1(ingest),不含 M14 ②** —— 本 WP 不消費 ε(t),故 M14 ② 撤回**不阻塞** WP-29。撤回阻塞的是 WP-30/31。

### 兩份真實 fixture(對照組)

| | 08:03(`...T08_03_45.617Z.json`) | 09:39(`...T09_39_06.031Z.json`) |
|---|---|---|
| 時長 / ticks | 27.390625s / 3,507(median dt 7.8125ms、gap 0) | 21.266s / 2,723 |
| `ticks[].keys` | 全 `[]`,鍵狀態轉換 **0 次** | `A` 617 / `D` 587 / `A+D` 33 / 空 1,486 |
| `counter` | **0** | **24**(`A` 12 / `D` 12;>20 表示部分 peek 內有多個) |
| `vx` / `max\|px\|` | 恆 0 / 0 | ±250(612 相異值)/ 169.25 |
| `visible` / `fire` | 20(L10/R10)/ 22(`firstShot` 20) | 20 / 22 |
| `counterReactionMs` | n = 0 | **n = 20**,median 427.2 ms |
| `fireTimingAlignmentMs` | n = 0 | **n = 20**,median 126.5 ms |
| `firstShotHitRate` | **90** | 90 |
| `meta.suspect` | false | **true**(KI-004,非效能/溢位) |
| 彈道 / ADS | hitscan(無 `meta.weapon.bullet`)/ `ads` 事件 0 | 同左 |

### 08:03 零位移的成因(已結案,2026-08-05)

排查結論:**不是引擎缺陷**,是該次 run 確實沒有鍵盤輸入。證據鏈:

1. 現場 console 觀測 —— keydown 有到 `window`、`code=KeyA/KeyD`、`isTrusted=true`;`getEventListeners(window).keydown` 含 app 的 bubble-phase listener;無 `stopPropagation`(全 repo grep 零命中)。
2. 同 session 的 `__aimDebug.state.player.x = 0.32 ≠ 0` —— `player.x` 唯一寫入點是 [MovementController.ts:71](../../../../../src/sim/MovementController.ts#L71),證明 `held` 曾為 true,全鏈通暢。
3. 決定性證據 = **同 build、同機器、同流程重錄的 09:39 匯出**,鍵盤資料完整落盤。
4. 引擎側複核:`handleInput` 在 [SimLoop.ts:661](../../../../../src/loop/SimLoop.ts#L661) 綁死為 `applyInput`,無 phase/drill gate;`resetState` 是原地 `input.clear()`,不換 ring;`MovementController.step` 無條件執行。

**遺留的可觀測性缺口**:匯出檔無法區分「沒按鍵」與「按了但被丟掉」(`lateEventCount`/`bufferOverflow` 兩種情況皆為 0)。建議(未排程)在 `meta` 加 additive 輸入計數。

### 副產物:KI-004(比原問題更嚴重)

重現過程發現 09:39 的 `meta.suspect = true`,追出 sim/world 單位域混用 → [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / [BD-004](../../../../known_issue/BUGFIX-DECISIONS.md)。對本 WP 的影響:

- **WP-29 不受影響**:T1/T2 的指標只吃 `events` 與 `ticks[].keys`,不碰 `px/pz`。
- **09:39 仍可用**,但 T0 必須把「使用理由 + 失效條件」寫成 Decision Log 條目。
- **WP-30/31 受影響**(ε(t) 系列):修法方向已於 2026-08-05 拍板(K-1/K-2/K-3),但須待 **S1 落地並重新宣告 M14 ②** 才解除 entry blocker。

**後續實測更正(2026-08-05)**:D2 實為兩個獨立缺陷 —— D2a(遺漏 camera base offset `eyeZ`,**與 `px` 無關**)+ D2b(遺漏 `SIM_TO_WORLD`)。以引擎 `fire.offsetDeg` 為 ground truth 實測偏差:08:03 = 12.52°、09:39 = 67.11°。**M14 ② 因此撤回**(K-2)。

---

## T0 Entry Gate Evidence(2026-08-05)

### 上游 exit-gate 引用(不重跑)

| 上游 | 狀態 / 可引用範圍 | 證據 |
|---|---|---|
| WP-28 T1 | ✅ schema v2 `load_export` / `check_dt` / deterministic synthetic export 可直接作 WP-29 輸入地基 | [WP-28 progress](../wp-28-research-foundation/progress.md):T1 targeted `12 passed in 0.92s`;合成 fixture 48 ticks / 11 events且 round-trip 通過 |
| M14 可引用範圍 | 🟡 ①③④⑤⑥ 維持；WP-29 可引用 `seg-v1`、一鍵 pipeline 與單樣本效度限制。② ε parity 已撤回，且不是本 entry gate 的必要條件 | [WP-28 progress](../wp-28-research-foundation/progress.md)與 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md)；本 WP 不引用任何 ε(t) 產物 |
| T0 scope gate | ✅ `git diff --stat` 僅列 4 份文件 | 全部位於 `docs/exec-plan/active/stage4/`；`src/` 與 `research/` 變更數皆為 0 |

### `compute.ts` 對表基準清單(`compute-v1`,T1 逐位重現)

> 權威來源:[`src/metrics/compute.ts`](../../../../../src/metrics/compute.ts)。本清單於看到 T1 parity 結果前凍結；差異先視為 Python 重現問題，若證據指向 TS bug 或規格分歧，須入 DECISIONS / known issue 後才可變更。

| 量 / 契約 | 凍結語意 | 權威行號 |
|---|---|---|
| `counterReactionMs` | 每個 visible 建窗 `[t_visible,nextVisible.t)`；取窗內第一個 `counter`(不分鍵)，計 `counter.t - visible.t`；缺 `counter` 的 peek 不進聚合 | [`compute.ts:58–66`](../../../../../src/metrics/compute.ts#L58-L66),[`compute.ts:148–166`](../../../../../src/metrics/compute.ts#L148-L166) |
| `fireTimingAlignmentMs` | 僅在同一 peek 同時有 `counter` 與相容 `firstFire` 時，計 `firstFire.t - counter.t`；任一錨點缺席即不進聚合 | [`compute.ts:70–74`](../../../../../src/metrics/compute.ts#L70-L74),[`compute.ts:148–166`](../../../../../src/metrics/compute.ts#L148-L166) |
| `firstShotHitRate` | `(命中的首發數 / 全部 visible 事件數) × 100`；命中為 `fire.hit === true`，或 `fire.shotSeq` 存在於 `hit` 事件的 `shotSeq` 集合；無 visible 時為 0 | [`compute.ts:58–67`](../../../../../src/metrics/compute.ts#L58-L67),[`compute.ts:85–92`](../../../../../src/metrics/compute.ts#L85-L92),[`compute.ts:185–192`](../../../../../src/metrics/compute.ts#L185-L192) |
| `firstFire` 選取 | 窗內第一個 `firstShot === true` 且 `targetId` 缺席或等於該 visible `targetId` 的 fire | [`compute.ts:148–163`](../../../../../src/metrics/compute.ts#L148-L163) |
| `stat()` | 先濾除非有限值；空集合為 `{mean:0,p50:0,sd:0,n:0}`；`p50` 用排序後索引的線性插值；`sd` 為母體標準差(除以 n) | [`compute.ts:139–145`](../../../../../src/metrics/compute.ts#L139-L145),[`compute.ts:259–269`](../../../../../src/metrics/compute.ts#L259-L269) |

### `counter` 是條件性事件，不是必填資料

[`SimLoop.ts:66–78`](../../../../../src/loop/SimLoop.ts#L66-L78) 顯示 `applyInput` 只在新的反向按鍵 keydown 且當下 `vx` 與該鍵方向相反時記錄事件：`KeyD` 需 `ev.down && !held.right && vx < 0`；`KeyA` 需 `ev.down && !held.left && vx > 0`。因此未 strafe、已停住才開槍、或窗內沒有符合反向速度條件的 peek，本來就沒有 `counter`。T1/T2 必須以 flag 表達缺錨點並排除對應聚合，不得補 0 或吞成 NaN。

### Sync 量化精度 pre-registration(`sync-v1`)

- 量化來源:`t_release` 從 128 Hz `ticks[].keys` 推導，`dt = 7.8125 ms`；均勻量化誤差 SD = `dt / √12 ≈ 2.2551 ms`。`t_counter` / `t_fire` 為 input `timeStamp`，不套此量化誤差。
- 凍結參數:`SyncParams(min_samples=10, sd_ratio_threshold=1/3, version="sync-v1")`。
- `release_to_fire_ms` 與 `counter_hold_ms` 各自獨立判定；有效樣本先依旗標過濾。

| 條件 | 判定 | T3 行為 |
|---|---|---|
| `n < 10` | `blocked-by-data` | 不得觸發 T3；OQ-S4-12 已因 09:39 樣本到位而關閉，但未來任一輸入 n 不足仍走此分支 |
| `n ≥ 10` 且 `quantization_sd ≥ sample_sd × 1/3`(等價於 128 Hz 下 `sample_sd ≤ 約 6.765 ms`) | `insufficient` | 觸發 T3 additive key events |
| `n ≥ 10` 且 `quantization_sd < sample_sd × 1/3` | `sufficient` | T3 標記 skipped，保留 tick-derived release |

凍結時點:2026-08-05 11:43+02:00(原 T0 commit `4778c76`)，早於 09:39 fixture 進入 `main` 的 `c1440cb`(13:22+02:00)，且尚未產生 T2 precision 結果。不得依事後真實資料原地調整；若需變更，只能升 version 並重跑全鏈。

---

## T1 Evidence(2026-08-05)

### 三份 `compute-v1` parity(相對誤差 ≤1e-9)

| fixture | counterReactionMs(mean / p50 / sd / n) | fireTimingAlignmentMs(mean / p50 / sd / n) | firstShotHitRate | peeks / outcome |
|---|---|---|---:|---|
| 合成 `synthetic_timeline.json` | 39.0625 / 39.0625 / 0 / **3** | 54.6875 / 54.6875 / 0 / **3** | 75 | 4 / hit 3、timeout 1(含跨窗 projectile hit) |
| 真實 08:03 | 0 / 0 / 0 / **0** | 0 / 0 / 0 / **0** | **90** | 20 / hit 20(2 個首發 miss 後補槍命中) |
| 真實 09:39 | 600.0861250001471 / 427.21249999990687 / 875.3085613911904 / **20** | 152.04599999999627 / 126.5 / 189.24442747143772 / **20** | 90 | 20 / hit 20；4 窗 `multiple_counters` |

反 vacuous test 同時斷言合成與 09:39 的兩個 `n ≥ 2`，且相容 first-shot 集合都有 hit/miss。08:03 專責零輸入邊界，缺 counter/release 保持 `None` + flags，不補 0、不 crash。09:39 雖 `meta.suspect=true`，本 slice 未讀 `px/pz`，D-29.2 界線維持。

### 窗界消重與 leading-ω

- 舊公式與 `build_peek_windows.tick_slice` 在合成 2 窗、08:03 20 窗、09:39 20 窗的 tick index 集合逐位相同。
- 消重前後 `pipeline-summary.json` 的 `dtReport` / `segmentation` JSON 逐位相同；既有 pipeline tests 全綠。
- t3-sweep 09:39 的 21 列 segment `peek_index/kind/start/end/peak` 全部相同；套用 D-28.12 leading-ω 切尾後，`non_finite_interpolated` 污染由 **21 → 0**。
- `epsilon-synthetic_counterstrafe.json` 未修改；M14 ② 仍依 KI-004 撤回，本結果不引用 ε 數值作證據。

### Gates / scope

- Targeted:`31 passed in 2.61s`(metrics + epsilon fixture consistency + report pipeline + purity)。
- Research:`uv run pytest -q --basetemp .pytest_tmp_t1_full_final` → **89 passed in 6.41s**。
- Engine:`npm run test:ci` → `tsc --noEmit` exit 0、**83 files / 644 Vitest passed**、**19 Playwright passed**。
- 產物:合成/08:03 各一份 SVG timeline + drill summary CSV；algorithms 無寫檔/matplotlib，寫檔只在 notebook 邊界；`src/` 生產碼零修改。

---

## T2 Evidence(2026-08-05)

### `sync-v1` 三 fixture 結果

有效樣本規則 = 指標值有限且該列 `flags == ()`；任何 peek/Sync flag 都排除整列，故
`release_inferred_no_counter` 預設不進正式聚合。`counter_hold_ms` 若延伸出窗，以最後一個
窗內 held tick 回傳截斷值並標 `counter_hold_truncated`，保留可檢視性但不進判定。

| fixture | `release_to_fire_ms` n / mean / sample SD / verdict | `counter_hold_ms` n / mean / sample SD / verdict | `counter_to_fire_ms` n / mean / sample SD | flags 計數 |
|---|---|---|---|---|
| 合成 `synthetic_timeline.json` | **1** / 70.3125 / `None` / `blocked-by-data` | **1** / 15.625 / `None` / `blocked-by-data` | 1 / 54.6875 / `None` | `hit_outside_window` 1、`missing_counter` 1、`missing_release` 1、`no_counter` 1、`no_key_transition` 1、`release_inferred_no_counter` 1 |
| 真實 08:03 | **0** / `None` / `None` / `blocked-by-data` | **0** / `None` / `None` / `blocked-by-data` | 0 / `None` / `None` | `missing_counter` 20、`missing_release` 20、`no_counter` 20、`no_key_transition` 20 |
| 真實 09:39 | **13** / 137.80673076935972 / **46.044857876328535** / `sufficient` | **13** / 103.44076923066034 / **16.480640422417093** / `sufficient` | 13 / 144.49269230771236 / 45.731036307070696 | `multiple_counters` 4、`counter_hold_truncated` 3、`missing_release` 1、`no_key_transition` 1 |

08:03 的 `None` 值保持為合法缺錨點語意，無補 0 / NaN / crash。09:39 是唯一真實 precision
gate：兩個量均有 `n=13 >= 10`，量化 SD `2.255274489021976 ms` 分別小於樣本 SD 的
三分之一(`15.348285958776178 ms` / `5.493546807472364 ms`)；因此兩者都為
`sufficient`，**T3 觸發 = 否，狀態 = skipped**。本 slice 到此停止，未開 T3。

### Pre-registration / deterministic artifact

- `DEFAULT_SYNC_PARAMS == SyncParams(min_samples=10, sd_ratio_threshold=1/3, version="sync-v1")`，逐位符合 D-29.1；equality boundary test 釘死 `>=` 屬 `insufficient`。
- 128 Hz `tick = 7.8125 ms`；公式 `(1000/128)/sqrt(12)` 的精確結果為 **2.255274489021976 ms**，測試相對誤差 `<=1e-12`。
- committed report：`research/src/modules/metrics/notebooks/t2/outputs/sync-precision.json`；重產前後 SHA-256 均為 `4700A7D0C9E2CAE3632EABE14CD63114A9FBD0EA2CA29D5AD92279D39FA0D7C1`。
- 合成 fixture 由 `meta.weapon.bullet` 判為 projectile；兩份真實 fixture 判為 hitscan。兩份真實 fixture 仍無 ADS-on / projectile cell，OQ-S4-11 保持 open。

### Gates / scope

- Targeted：metrics + fixture consistency + algorithms purity → **35 passed in 3.47s**。
- Research：`uv run pytest -q -p no:cacheprovider --basetemp .pytest_tmp_t2_full` → **106 passed in 7.20s**。
- Engine：`npm run test:ci` → `tsc --noEmit` exit 0、**83 files / 644 Vitest passed**、**19 Playwright passed**。
- `algorithms/sync.py` 無寫檔、matplotlib 或 TS dependency；寫檔只在 `notebooks/t2/generate_sync_precision_report.py`。
- `src/` 生產碼零 diff；未修改 TS、既有真實 fixture、`synthetic_counterstrafe.json`、T1 parity 或 frozen `compute-v1` / `timeline-v1` / `seg-v1` 語意。
- WP-29 T2 新碼只讀 `events`、`ticks[].t/keys` 與 `meta.weapon.bullet`；**完全未讀 `px/pz`**，D-29.2 維持有效；09:39 `meta.suspect=true` 仍只歸因 KI-004。
- WP-29 worktree CodeGraph 仍未初始化；依規則未自行初始化。只讀 main index不含 T1 branch 新模組，未提供可用的 T2 symbol impact；graphify 顯示新 Sync 模組只接 `PeekWindow` / `Export` notebook 路徑，blast radius 為 research metrics/tests/docs 的 local additive slice。

---

## T3 Evidence(2026-08-05，使用者 override slice；commit `dcdafbd`)

### Gate override 如何記錄（未竄改 T2 sufficient verdict）

- T2 09:39 verdict 維持 `release_to_fire_ms` n=13 sample SD `46.044857876328535` `sufficient` / `counter_hold_ms` n=13 sample SD `16.480640422417093` `sufficient`（本頁 T2 Evidence 逐字未動）。
- `notebooks/t2/outputs/sync-precision.json` **未修改**（`git status` 未列該檔；`test_sync_fixture.py` 綠：n=13/sufficient/`t3Gate.status=skipped`）。
- override 帳本 = D-29.8~D-29.11、S-29.8~S-29.10；T3 doc 加 override addendum 使前提誠實。

### 修改檔案與主要設計

- **engine（opt-in、預設 OFF）**:`DataRecorder` 加 `key` variant `{type,code,down,t}` + `recordKeyEvents`（預設 `false`）；`SimLoop.applyInput` 在 A/D 分支旗標為真時並列 `counter` 寫 `key`（先 raw、後 derived；`state.held` 更新序與 counter 條件逐位不變）；`export.ts` 加 `key` CSV 分支（沿用 `key`/`down` 欄）。
- **schema/docs**:`schema.md` 加 `key` 事件表 + CSV 對帳 + additive/`schemaVersion=2` 政策；`analysis-peek-timeline.md` 加 additive `t_release_event`/`release_source`（不動 frozen `t_release`/`flags`）。
- **research ingest/consume**:`loader.py` 接受 `key` 事件（`code`→既有 `key` 欄，`EVENT_COLUMNS` 不變）；`peek.py` 加 additive `t_release_event`（in-window 原方向鍵 keyup 的 input timeStamp，sub-tick）+ `release_source`（`key_event`/`tick_keys`）。`sync.py` 未動 → `sync-v1` 逐位不變。

### 驗證

- **targeted**：peek/loader key + 既有 peek/sync/**sync_fixture**/loader → `43 passed`（`--basetemp .pytest_tmp_t3`）。
- **full research**：`uv run pytest` → **118 passed**（T2 期 106 + 新 12：peek key 8 + loader key 4）。
- **engine**：`tsc --noEmit` exit 0；`vitest run` **83 files / 651 passed**（644 + 新 7：SimLoop 3 + DataRecorder 2 + export 2）；`playwright test` **19 passed**（首跑無 flake）。
- **key event 測試涵蓋**：deterministic ordering（key 先於 counter、unordered 同結果）、keydown/keyup（僅 keyup 錨釋放）、跨 tick（sub-tick `t_release_event=1.6` vs tick-derived `t_release=1.0`）、跨 window（次窗 keyup 不回洩）、缺事件（fallback `tick_keys`）、unsupported counter key、no-counter fallback。
- **additive/backward-compat**：`schemaVersion` 仍 `2`；`EVENT_COLUMNS` 不變；預設 recorder 不發 key 事件 → 既有 determinism 契約 / golden / 真實+合成 fixture / `sync-precision.json` 逐位不變；full-drill E2E 匯出 shape 未變。
- **scope/紅線**：`git diff --check` 淨；`src/` diff 僅 data/event surface（DataRecorder/export/SimLoop + 測試）；research 零 TS import；**未新增 `px/pz` 消費**（D-29.2 維持）；未引用任何 ε 產物（M14 ② 撤回）；`algorithms/` 無寫檔/matplotlib。
- **worktree**:branch `wp-29-coach-timeline`、`dcdafbd`；主 worktree 未觸碰。

---

## T-exit Evidence(2026-08-05)

### 交付:教練報告 v0(`coach-report-v0`)

一道指令 `uv run python src/report/coach_report.py --export <path> [--group-by side|ads|weapon_mode] [--out <dir>]`
產出**單一自足靜態 HTML**:inline `<style>` + inline `<svg>`,全檔 `http` 出現次數 **0**,
無 `<script>`/`<link>`/`@import`/`url(`/`src=`(測試逐項斷言)。九個區塊 = drill 摘要 /
① 時間軸三量 / ② Sync 三量 / ③ 精度判定 / ④ 逐 peek 時間軸 SVG / ⑤ 逐 peek 明細 /
⑥ flags 計數 / ⑦ 條件分層 / ⑧ 凍結參數與版本 / ⑨ 效度紅線與已知限制。

### 六個指標的 n / flags / 版本 / 效度層級(09:39 主要真實 fixture)

| 指標 | 版本 | 效度層級 | n | 統計 | flags 計數(未入聚合者) |
|---|---|---|---:|---|---|
| `counterReactionMs` | `compute-v1` | 已驗證:與結果頁逐量 parity ≤1e-9 | 20 | mean 600.0861250001471 / p50 427.21249999990687 / sd 875.3085613911904 | — |
| `fireTimingAlignmentMs` | `compute-v1` | 同上 | 20 | mean 152.04599999999627 / p50 126.5 / sd 189.24442747143772 | — |
| `firstShotHitRate` | `compute-v1` | 同上 | 20(分母 = 全部 visible) | 90 %(18/20) | — |
| `release_to_fire_ms` | `sync-v1` | 新構念 + pre-registered 精度判定 | 13 | mean 137.80673076935972 / sample SD 46.044857876328535 | `counter_hold_truncated` 3 · `missing_release` 1 · `multiple_counters` 4 · `no_key_transition` 1 |
| `counter_hold_ms` | `sync-v1` | 同上 | 13 | mean 103.44076923066034 / sample SD 16.480640422417093 | 同上 |
| `counter_to_fire_ms` | `sync-v1` | 新構念;兩端 sub-tick,本版不判精度 | 13 | mean 144.49269230771236 / sample SD 45.731036307070696 | 同上 |

精度判定逐位沿用 T2 frozen 結果:兩個 tick-quantized 量 `n=13 ≥ 10`,量化 SD
`2.255274489021976 ms` 均小於樣本 SD 的三分之一 → 兩者皆 **`sufficient`**。報告只
**顯示**該判定,未重跑、未改寫。

### 三份 fixture 的報告結果

| fixture | peeks | outcome | firstShotHitRate | Sync n(三量) | 判定 |
|---|---:|---|---:|---:|---|
| 合成 `synthetic_timeline.json` | 4 | hit 3 / timeout 1 | 75 % | 1 / 1 / 1 | 兩量 `blocked-by-data` |
| 真實 08:03(零輸入邊界) | 20 | hit 20 | 90 % | 0 / 0 / 0 | 兩量 `blocked-by-data` |
| 真實 09:39(主要效度樣本) | 20 | hit 20 | 90 % | 13 / 13 / 13 | 兩量 `sufficient` |

**08:03 安全輸出**:三個 Sync 量 `n=0`、`mean`/`sampleSdMs` 皆為 `None`、判定
`blocked-by-data`,不 crash、不補 0、不吞成 NaN;測試另釘死報告內不得出現 `>NaN<`
與 `mean 0 · p50 0 · sd 0`(見 S-29.11)。

### 條件分層(三種 `--group-by` 皆 exit 0)

| group-by | 分組 | 逐組 Sync n(`release_to_fire_ms`) | 驗證 |
|---|---|---|---|
| `side` | `L` 10 peeks / `R` 10 peeks | 7 + 6 = 13 | 逐組 flags 相加 = drill 全域 flags |
| `ads` | 僅 `off`(20) | 13 | 真實資料無 ADS-on cell → OQ-S4-11 |
| `weapon_mode` | 僅 `hitscan`(20) | 13 | projectile cell 只有合成 fixture 有樣本 |

**分層不改參數**:`parameters` / `precisionVerdicts` / `syncMetrics` 三個區塊在分層前後
物件相等,且渲染後的 `<section id="parameters">` **字串逐位相同**(測試斷言)。

### Gates / scope

- Targeted:`src/report` → **64 passed**(新增 50:報告契約 46 + 層級純度 4)。
- Research:`uv run pytest -q -p no:cacheprovider` → **168 passed**(T3 期 118 + 新 50)。
- Engine:`npm run test:ci` → `tsc --noEmit` exit 0、**83 files / 651 Vitest passed**、
  **19 Playwright passed** —— 與 T3 基線逐數相同,證明本切片 TS 零改動。
- `git diff -- src/` **空**;`research/fixtures/`、T1 `notebooks/t1/outputs/`、T2
  `notebooks/t2/outputs/sync-precision.json` 皆零 diff。
- `algorithms/` 純度維持:寫檔只在 `src/report/coach_report.py` 與
  `notebooks/t-exit/generate_coach_reports.py`;`build_report`/`render_html` 為純函式,
  由測試在空 tmp 目錄斷言零檔案產出。C-D1 由既有
  `modules/kinematics/algorithms/tests/test_purity.py` 覆蓋(未重複實作,見 S-29.12)。
- **完全未讀 `px`/`pz`**:測試掃描 `coach_report.py` 原始碼確認零出現,D-29.2 界線維持;
  09:39 `meta.suspect=true` 在報告內明示歸因 KI-004 且聲明不消費位置欄。
- 未引用任何 ε 產物(M14 ② 撤回);報告不含 ε/phase/SPARC/xcorr/Fitts 任何數值。
- WP-29 worktree CodeGraph 仍未初始化(本 session 再次確認 `codegraph_explore` 回
  "isn't indexed"),依 AGENTS.md 停用並改用內建工具 + graphify;新模組 blast radius 為
  research report 層的 local additive slice,唯一跨檔改動是 `timeline.py` 的
  behaviour-preserving 公開化(D-29.12)。

---

## Decision Log

> 格式沿用 WP-28:`D-29.n | 決策 | 理由(含 Alternatives Considered) | 證據`。跨 WP/跨文件者改寫 [DECISIONS.md](../../../DECISIONS.md)。

| # | 決策 | 理由 | 證據 |
|---|---|---|---|
| D-29.0 | 凍結 `compute-v1` 五項 parity 基準：窗界/第一 counter、雙錨點 fire alignment、first-shot hit 分母與命中路徑、target-compatible firstFire、線性 p50 + 母體 SD | T1 必須逐位重現既有 TS 權威，避免看 parity 結果後改分母、窗界或統計定義。Alternatives Considered:只對最終 mean(拒絕:會漏掉 n/p50/sd 與個別窗界漂移)；把 Python 定為既有量權威(拒絕:C-D4) | `compute.ts:58–92,139–166,185–192,259–269`;本頁 T0 基準表 |
| D-29.1 | 凍結 `SyncParams(min_samples=10,sd_ratio_threshold=1/3,version="sync-v1")` 與 `blocked-by-data` / `insufficient` / `sufficient` 三分支；事後不得依真實資料調整，只能升版重跑 | `n<10` 時不以小樣本噪音決定引擎變更；1/3 將量化 SD 控制在樣本變異的明確比例。Alternatives Considered:`min_samples=2`(拒絕:SD 極不穩定)；n 不足直接判 insufficient(拒絕:讓缺資料錯誤觸發 T3)；看完真實資料再定門檻(拒絕:事後調參) | 2026-08-05 11:43+02:00 pre-registration(`4778c76`)；早於 09:39 fixture commit `c1440cb`；128 Hz `dt/√12 ≈ 2.2551 ms`，臨界 sample SD ≈ 6.765 ms |
| D-29.2 | 09:39 fixture 雖有 `meta.suspect=true`，仍可供 WP-29 T1/T2 使用；界線是本 WP 只消費 `events` 與 `ticks[].keys`，不得消費 `px/pz` | KI-004 的 suspect 成因是 corridor gate 單位域錯誤與 ε 原點缺陷，不是效能、overflow 或事件鏈失敗；counter 24 與鍵狀態可作本 WP 證據。若任何 WP-29 指標開始消費 `px/pz`，本決議立即失效並須重新評估。Alternatives Considered:整份 fixture 禁用(拒絕:會丟棄不受缺陷影響的事件/鍵資料)；忽略 suspect 不設界線(拒絕:可能讓未來指標誤用位置資料) | [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / K-1、K-2、K-3；09:39 fixture 21.27s、counter 24、三個對表量各 n=20 |
| D-29.3 | 更正 08:03 `firstShotHitRate` 為 **90**,並以 fixture + frozen `compute-v1` 為權威覆寫 README/T1/progress 的殘留 100 | TS parity 首跑在固定期望 100 時失敗，但 Python 與 `computeMetrics` 已一致為 90；逐窗稽核找到 peek 1/4 的相容首發 `hit=false` 且無 projectile hit，20 個首發命中 18 個。兩窗後續補槍命中，故 outcome 仍為 hit。Alternatives Considered:修改 fixture(拒絕:抹除真實事實)；改 Python/TS 分母或把補槍算首發(拒絕:違反 D-29.0 `compute-v1`)；標 TS bug(拒絕:實作符合 raw events) | `timeline-parity.test.ts` 的 100→90 紅/綠證據；fixture 首發 misses = `(peek 1,t1)`、`(peek 4,t4)` |
| D-29.4 | `build_peek_windows` 成為 research 唯一窗界；既有 consumer 只保留 tuple/presentation adapter，t3 在共享切片後切除 undefined leading ω 並把 indices +1 映回 tick frame | 單一 `[visible,nextVisible)` + 1e-9 tolerance 避免三份漂移；切尾落在 consumer 能保留 frozen `seg-v1`。Alternatives Considered:保留三份公式只加 tests(拒絕:仍可分叉)；改 `omega_deg_s` 首值契約(拒絕:跨模組且非 T1 scope)；改 `seg-v1` 處理 nan(拒絕:破壞 pre-registration) | 三 fixture tick indices 相同；pipeline summary 相同；t3 21 rows shape 相同、non-finite flags 21→0 |
| D-29.5 | `sync-v1` 正式聚合只納入「數值有限且整列零 flags」樣本；inferred / truncated 數字仍保留在逐列輸出 | T2 明定帶 flag 的列不進分母，並要求 `release_inferred_no_counter` 預設排除；整列規則比逐 metric 例外表更封閉、可稽核。Alternatives Considered:只排除直接影響該 metric 的 flags(拒絕:違反 T2 明文且讓分母依欄位漂移)；把 inferred / truncated 直接清成 `None`(拒絕:丟失可檢視證據) | 09:39 20 peeks 中 7 列帶 flag，兩個 precision metrics 各 `n=13`；flagged-row exclusion test 釘死 SD 不受極端值影響 |
| D-29.6 | `sync_metrics(peeks,ticks)` 保留兩參數預設介面，並以 optional keyword `weapon_mode` 接收 notebook 邊界從 `meta.weapon.bullet` 推導的分層值 | 純演算法不應隱式讀完整 Export/meta，但 T2 又要求逐列帶 weapon mode。Alternatives Considered:把 `Export` 整體傳入(拒絕:擴大耦合且偏離 README 介面)；在算法內固定 hitscan(拒絕:合成 projectile 分層錯誤) | deterministic report：合成 `projectile`、08:03/09:39 `hitscan`；單元測試覆蓋 explicit projectile keyword |
| D-29.7 | T3 組合 gate：09:39 任一 tick-quantized metric 為 `insufficient` → triggered/pending；兩者全為 `sufficient` → skipped；其餘含 `blocked-by-data` → deferred | T2 對兩個量各自判定，但 T3 是單一引擎變更，需把雙 verdict 收斂成唯一狀態。Alternatives Considered:只看 `release_to_fire_ms`(拒絕:忽略同樣 tick-quantized 的 counter hold)；多數決(拒絕:可能掩蓋單一失敗構念) | report generator 對 09:39 兩個 `sufficient` 產出 `t3Gate.status=skipped`；fixture test 釘死 |
| D-29.8 | **使用者 gate override**：在 09:39 兩個 precision verdict 皆 `sufficient`（D-29.7 判 skipped）下，使用者於 2026-08-05 明確要求仍實作 T3，定位改為 **additive observability / direct key-event evidence**，**非**修復已證足夠的量化精度。**不重跑/不改寫 T2 verdict（維持 `sufficient`）、不調整 `SyncParams`、不升 `sync-v1` 版**；frozen `compute-v1`/`timeline-v1`/`sync-v1`/`seg-v1` 全數維持。此 override 使 T3 doc 的硬性前提「相依 = T2 判定 insufficient」失效——見 S-29.8 與 T3 doc override addendum | 原 gate 邏輯正確且不被竄改（`sync-precision.json` 逐位未變、`t3Gate.status` 仍 `skipped`）；override 的研究理由 = 讓「鬆原方向鍵」的釋放時刻有 **input-timestamp（sub-tick）直接證據**，補足 tick-derived release 的 ±1 tick 量化，供未來教練報告在**有 key 事件的新錄製**上更精細標註（本 slice 不重錄 fixture）。Alternatives Considered:①遵原 gate 標 skipped 不做（拒絕:使用者明確 override）；②改寫 T2 為 insufficient 以「正常觸發」T3（拒絕:違事實、竄改凍結 verdict）；③升 `sync-v2` 把 key-event release 併入既有指標（拒絕:破壞 pre-registration 與 C-D4，且非本 override 意圖） | `test_sync_fixture.py` 仍綠（n=13/sufficient/`skipped` 未變）；本頁 T2 Evidence 未改 |
| D-29.9 | **key 事件記錄採 opt-in、預設 OFF**：`DataRecorder` 新增 optional `recordKeyEvents`（預設 `false`）；`applyInput` 僅在 `recorder?.recordKeyEvents` 為真時於 A/D 分支並列 `counter` 寫入 `key` 事件。既有所有 recorder 皆未帶此旗標 → **零既有測試/fixture/golden/決定性契約變動**（byte-for-byte） | 無條件記錄會讓 `src/loop/SimLoop.test.ts` 既有「整份 events 陣列」斷言（含 KeyA 輸入）新增 key 事件而破裂（S-29.10）。opt-in default-off 完全不動任何既有基準，符合 incremental-implementation 的 Safe Defaults / Feature Flag 紀律，並最大化尊重 override 的「既有決定性測試零修改全綠」硬要求。偏離 T3 doc「並列 counter 無條件寫入」的文字——記於 override addendum。Alternatives Considered:①無條件記錄 + 更新 `SimLoop.test.ts` 整份陣列字面（拒絕:動既有測試,雖有 `ads` 前例但 override 要求零改）；②在 `recordEvent` 內吞 key（拒絕:hot-path 仍配置事件物件,違 GC 紀律 §4）。旗標檢查在 `applyInput`，停用時零配置 | `applyInput`/`simStep` 簽章零變更（旗標讀自 recorder，不新增位置參數）；生產啟用 = 傳入 `recordKeyEvents:true` 的 recorder（本 slice 不接線，記 OQ-S4-13） |
| D-29.10 | **peek.py 以 additive 欄位承載 key-event release，不動 frozen `t_release`/`flags`**：新增 `PeekWindow.t_release_event`（input timeStamp，sub-tick，缺 key 事件 → `None`）與 `release_source`（`"key_event"`/`"tick_keys"`）。既有 `t_release`（tick-derived，`timeline-v1`）語意逐位不變；**不新增任何 flag** 到 `flags` tuple | T3 doc 原文要「以 flag 區分兩條路徑（release_from_key_event/release_from_tick_keys）」，但 `sync-v1` 聚合規則 = 整列零 flags 才入 `n`；若把來源塞進 `flags`，09:39 全 20 列都會帶新 flag → `n` 由 13→0，破壞 frozen T2 verdict 與 `test_sync_fixture.py`（S-29.9）。改用**獨立欄位** `release_source` 表達兩條路徑，達成「可辨識」而不污染凍結旗標詞彙。`sync.py` 完全不消費新欄位 → `release_to_fire_ms` 仍 = `t_first_shot − t_release`（tick-derived），`sync-v1` byte-for-byte 不變。Alternatives Considered:①把 `t_release` 改優先取 key 事件（拒絕:就地重定義 `timeline-v1` 且改 `sync-v1` 數值,違凍結）；②新增 flags（拒絕:破壞 sync-v1 分母,見 S-29.9） | `timeline_parity_payload` 只序列化具名欄位（非 `asdict(peek)`）→ timeline parity JSON 未變；`generate_sync_precision_report` 只讀 `sync_metrics` 輸出 → `sync-precision.json` 未變 |
| D-29.12 | **把逐 peek 首發命中指標公開為 `timeline.first_shot_hits`**,`_first_shot_hit_count` 改為其 `sum()`;報告的分層首發命中率一律走此單一實作 | 分層報告需要「該組的首發命中數」,但 `firstShotHitRate` 的命中判定(相容首發選取 + `hit`/`shotSeq` 兩條命中路徑)是 frozen `compute-v1` 語意。在 report 層自行重算等於替既有構念寫第二個定義,直接違反 C-D4;把同一段邏輯公開成逐 peek 布林則是 behaviour-preserving 的重構,權威仍只有一處。Alternatives Considered:①報告不顯示逐組首發命中率(拒絕:分層失去最重要的教練面指標);②在 `coach_report.py` 複製判定邏輯(拒絕:C-D4 第二定義);③把 `TimelineMetrics` 加欄位(拒絕:改 frozen dataclass 面,parity payload 要跟著動) | 重構後 `src/modules/metrics` **40 passed**、三份 timeline parity JSON 逐位未變、`timeline-parity.test.ts` 綠;`firstShotHitRate` 09:39 仍為 90、08:03 仍為 90 |
| D-29.13 | **pre-registered 精度判定維持 drill 層級,`--group-by` 不逐組重跑** | `sync-v1` 的 `min_samples=10` 與 1/3 門檻是對「一次 drill 的樣本」pre-register 的;逐組重判等於在看過資料後把一個判定拆成 N 個(09:39 分 side 後每組 n=7/6,全數會掉進 `blocked-by-data`),既是事後多重比較,也會讓同一份資料因分層方式不同而出現互相矛盾的 verdict。Alternatives Considered:①逐組重跑 `evaluate_release_precision`(拒絕:上述);②逐組顯示 drill 層 verdict(拒絕:會讓讀者以為該組已達判準) | 分層報告逐組只輸出 `n`/統計/flags;`precisionVerdicts` 區塊在分層前後物件相等,渲染後 `<section id="parameters">` 逐位相同 |
| D-29.14 | **committed 範例報告取四份**:合成、08:03、09:39,再加 09:39 `--group-by side` | T-exit 文件只要求「合成 + 真實各一份」,但 08:03 的零輸入輸出正是 DoD ④「不 crash、不補 0」唯一能**人工檢核**的載體,而分層版是條件分層唯一的靜態證據;四份合計 ~88 KB,且由 deterministic 測試釘死,腐化會在閘上變紅。Alternatives Considered:①只留兩份(拒絕:零輸入與分層退化成只有測試碼可證);②連三種分層都 commit(拒絕:ads/weapon_mode 在真實資料上退化成單組,資訊量重複) | `test_committed_example_reports_match_a_fresh_run` 逐檔 byte 比對;`notebooks/t-exit/generate_coach_reports.py` 為唯一產生器 |
| D-29.15 | **空聚合在報告上顯示為「—」而非 `compute-v1` 的 `{mean:0,p50:0,sd:0}`**;模型層仍逐位保留該零值 | frozen `stat()` 對空集合回傳零是對的(TS 逐位一致,不得改),但把「mean 0」印在教練眼前、旁邊只有一個小小的 `n 0`,正是 C-D3 要防的「會說錯話的指標」。分離「模型保真」與「呈現不誤導」可兩者兼得。Alternatives Considered:①原樣印 0(拒絕:誤導);②改 `stat()` 回傳 `None`(拒絕:破壞 frozen `compute-v1` 與 parity) | 08:03 報告的兩個時間軸量顯示「—」+ `n 0`;測試斷言 `"mean 0 · p50 0 · sd 0" not in html`;parity JSON 未變 |
| D-29.11 | **key 事件 JSON 欄位 = `code`（canonical `A`/`D`），CSV/loader 沿用既有 `key`/`down` 欄不新增欄**：`DrillEvent` variant = `{ type:'key'; code:string; down:boolean; t:number }`（依 T3 doc 契約）；`applyInput` 由 `KeyD`/`KeyA` 映射為 canonical `D`/`A`（對齊 `ticks[].keys`，不引入第二套鍵名）。CSV events 列以 `key` 欄承載 `code`、`down` 欄承載 `down`；Python loader 把 JSON `code` 映入既有 `key` DataFrame 欄，`EVENT_COLUMNS` 不變 | T3 doc「以不新增欄為優先」。`EVENT_COLUMNS` 不變 → `test_peek.py`/`test_sync.py` 的 `reindex(columns=EVENT_COLUMNS)` 不受影響。Alternatives Considered:①新增 `code` CSV/loader 欄（拒絕:違「不新增欄為優先」且動 `EVENT_COLUMNS` 面）；②JSON 欄改名 `key`（拒絕:偏離 T3 doc 契約 `code`） | schema.md 已補 `key` 事件表 + CSV 對帳；peek.py 依 `type=='key'` 過濾後讀 `key` 欄,與 counter 無碰撞 |

---

## Surprises

| # | 意外 | 影響 | 處置 |
|---|---|---|---|
| S-29.0 | 規劃期發現當時唯一的真實匯出零位移、零 `counter` 事件、鍵狀態全程未變 | WP-29 兩個核心錨點在真實資料上無樣本;交叉驗證有假綠風險 | 已解:排查證實為「該次 run 無鍵盤輸入」,補錄 09:39 後三個對表量各 n=20。反 vacuous 斷言**保留為紀律**(見 T1 DoD ②),不因樣本到位而放寬 |
| S-29.1 | 排查 S-29.0 時,重現用的 09:39 匯出帶 `meta.suspect = true`,追出 **sim(source unit)/ world domain 混用** | corridor gate 緊 100× → 任何真實急停 run 皆被標 suspect;離線 ε(t) 的 `p_eye` 原點錯尺度 → WP-30/31 全部逐段指標受影響 | 開 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) + [BD-004](../../../../known_issue/BUGFIX-DECISIONS.md);WP-29 本身不受影響(不碰 `px/pz`),但 T0 須記使用界線 |
| S-29.2 | ε parity(M14 ②)**無法**捕捉 S-29.1:Python 忠實移植了 TS 的錯誤原點,兩側同錯故 ≤1e-9 恆綠 | 暴露 C-D4「TS 為既有構念權威」的固有盲區 —— 對表保證一致,不保證構念正確 | 記入 KI-004 §4;stage4 若要防同類問題,需要的是**已知答案的幾何 fixture**(而非對表),此需求已在 WP-28 T2 存在但未涵蓋「玩家橫移 + 固定目標」交叉情境 |
| S-29.3 | T1 parity 固定期望首次揭露 README/T1/progress 把 08:03 首發率誤記為 100；raw events 與兩側實作皆為 90 | 若照文件硬改演算法會破壞 frozen `compute-v1` 並掩蓋兩個真實首發 miss | 依 DoD ④暫停 PASS、逐窗稽核後作 D-29.3 文件更正；不動 TS 生產碼與真實 fixture |
| S-29.4 | t3-sweep 基線有 21/21 segment rows 帶 `non_finite_interpolated`，比 WP-28 S-28.10 當時記錄的 19/19 多 2 列 | 數量隨 09:39 fixture/分段結果演進，但缺陷機制相同；不影響 segment 邊界，只污染品質 flags | 套 D-28.12 切尾 + indices 映回；21 列 shape 逐位相同、污染 21→0，OQ-S4-9 關閉 |
| S-29.5 | 最終 `test:ci` 複跑一次出現 3 個既有 Playwright app-ready/backend 5s timeout，該 run 仍有 644/644 Vitest 與 16/19 E2E 通過 | 失敗不在 T1 路徑且先前同命令 19/19；不可為環境 flake 修改無關 E2E/生產碼 | 原命令立即重跑後 **644/644 + 19/19** 全綠；保留 flake 證據但不擴 scope |
| S-29.6 | 任務文字把 `7.8125/sqrt(12)` 約寫成 `2.2551 ms`，實際公式值為 `2.255274489021976 ms` | 若把近似文字當常數會違反 DoD 的公式與 `<=1e-12` 測試；本次分支判定不受此小差異影響 | 以凍結公式為權威，不硬編碼近似；artifact 與 boundary test 都記精確計算值 |
| S-29.7 | 09:39 雖有 20 個 raw Sync anchor 組合，嚴格零-flags 聚合後只有 13 列，而非 planning 期的 `n≈20` | 4 列 `multiple_counters` + 3 列 `counter_hold_truncated` 被排除；仍高於 `min_samples=10`，不是 blocked-by-data 假綠 | 保留全部 20 列與 flag 計數於 artifact；precision 只用 13 列並得到兩個明確 `sufficient` verdict |
| S-29.8 | T3 doc 的硬性前提「相依 = T2 判定 `insufficient`（唯一觸發條件）」與使用者 override 直接矛盾——實際 T2 = `sufficient`，且 override 明令不得改寫為 insufficient | 照字面 T3 不該展開；但使用者明確 override | 依 override 指示先誠實化狀態：T3 doc 加 override addendum，把 T3 重定位為 additive observability（非 gate 正常觸發），Steps 中「重跑 T2 判定 / 以 flag 改 `t_release`」被 superseded（見 D-29.8/D-29.10）；progress 明記 override 非 precision 觸發 |
| S-29.9 | 若照 T3 doc 把兩條 release 路徑塞進 `flags`（`release_from_*`），`sync-v1` 的「整列零 flags 才入 `n`」規則會把 09:39 全部列排除 → `n` 13→0，破壞 frozen T2 verdict 與 `test_sync_fixture.py` | 直接以 flag 表達來源會污染凍結聚合分母、竄改已凍結證據 | 改用獨立欄位 `PeekWindow.release_source`（`key_event`/`tick_keys`）＋ `t_release_event`，不動 `flags`/`t_release`；`sync.py` 不消費新欄位 → `sync-v1` 逐位不變（D-29.10） |
| S-29.10 | 無條件記錄 key 事件會讓 `src/loop/SimLoop.test.ts` 既有「整份 events 陣列」斷言（該 test 於 t=101 推 KeyA）新增 key 事件而破裂，與 override「既有決定性測試零修改全綠」衝突 | 需在「無條件記錄（有 `ads` 前例）」與「零動既有測試」間取捨 | 採 opt-in default-off（D-29.9）：既有 recorder 不帶旗標 → 完全不發 key 事件 → `SimLoop.test.ts`、determinism 契約、golden、真實/合成 fixture 全數 byte-for-byte 不變；新行為由新測試以 `recordKeyEvents:true` 覆蓋 |
| S-29.11 | 08:03 報告首版把 frozen `compute-v1` 空聚合的 `{mean:0,p50:0,sd:0}` 原樣印出,和旁邊的 `n=0` 併排後讀起來像「急停反應 0 ms」 | 這是**呈現層**的誤導,不是資料錯誤;但正是 C-D3 紅線要擋的那種「會說錯話的指標」 | 以 D-29.15 分離模型與呈現:模型逐位保留零值供 parity,報告在 `n=0` 時顯示「—」;測試釘死 `mean 0 · p50 0 · sd 0` 不得出現在 HTML |
| S-29.12 | 新寫的 report 層純度測試與既有 `modules/kinematics/algorithms/tests/test_purity.py::test_research_python_has_no_typescript_dependencies` 重複,且該既有測試以 AST 掃描**所有** research `.py` 的字串常數、禁止任何 TS 副檔名字面 —— `coach_report.py` 的 docstring 與報告表格寫了引擎 compute 模組的完整檔名,直接把既有閘掃紅 | 若照抄一份新的 C-D1 測試,等於同一條硬約束有兩個實作(C-D4 的同型問題),且真正的違規沒被修掉 | 刪掉重複測試、改在檔案 docstring 指回既有閘;`coach_report.py` 兩處字串改寫為「引擎 src/metrics 的 TS 權威實作」,既有閘恢復綠。**額外收穫**:證明既有 C-D1 閘是活的,不是裝飾 |
| S-29.13 | 進場時 branch HEAD 為 `58ab62e`(T3 的兩個 commit)而非交辦文字假設的 `1d46023`,且交辦要求「T3 維持 skipped」與 repo 事實(T3 已於使用者 override 下實作並標 ✅)直接衝突 | 若照字面把 T-exit 文件寫成「T3 skipped」,會讓帳本與 git history 說相反的話,破壞可稽核性 | 依證據落帳:T-exit **不做任何 T3 工作**(未碰 gate、未改 `DataRecorder`、未改寫 T2 verdict),但文件一律記錄真實狀態「原 gate 判定 skipped → 使用者 override 實作完成」;衝突本身記於此並於回報中明示 |
| S-29.14 | T-exit 文件的已知限制清單仍寫「單一真實樣本且零 strafe」,該描述已被 09:39 fixture 推翻 | 若原樣寫入定稿文件,會把過期事實凍進 `timeline-v1` 契約 | 定稿改寫為「兩份真實 fixture,分工為零輸入邊界(08:03)與主要效度樣本(09:39)」,並明記先前說法已被推翻;限制數由 3 補到 5(補上「schema v2 無 kill/timeout 事件故 outcome 由 fire/hit 推導」與「inferred fallback 未驗證」) |

---

## Open Questions

| # | 問題 | 現況 | Owner | Deadline |
|---|---|---|---|---|
| ~~OQ-S4-12~~ | ~~缺「含真實 A/D strafe」的 counter-strafe 匯出~~ | ✅ **關閉(2026-08-05)**:09:39 已補錄並進 `research/fixtures/exports/`(21.27s、`P001`、PII-like 掃描無命中) | 使用者 | 2026-08-05 |
| ~~OQ-S4-9~~ | ~~research presentation 窗界切片三份實作 + t3 leading-ω 污染~~ | ✅ **關閉(2026-08-05,T1)**:`build_peek_windows` 單一實作；三 fixture tick indices 相同；pipeline summary 不漂移；t3 non-finite flags 21→0 | WP-29 | 2026-08-05 |
| OQ-S4-10 | `t_release` 無 counter 事件時的 fallback 是否可跨 peek 比較 | 🟡 **維持 open(T-exit 已依證據複核)**:兩份真實 fixture 的 `release_inferred_no_counter` 樣本數為 **0**(09:39 有 release 的 peek 都有 counter;08:03 兩者皆無),故沒有任何真實樣本可驗證跨 peek 可比性。**沒有充分證據 → 不假裝關閉**;fallback + flag 保留,聚合**預設排除不變** | 研究者 | 有 inferred 樣本的真實錄製後 |
| OQ-S4-11 | 兩份真實 fixture 皆無 `ads` 事件、皆為 hitscan → 條件分層無真實對照 | 🟡 **維持 open**:三種 `--group-by` 已實作並由測試釘死;實測 09:39 `ads` → 只有 `off` 一組、`weapon_mode` → 只有 `hitscan` 一組,projectile cell 僅合成 fixture 有樣本。仍缺 ADS-on / projectile 真實對照 | 研究者 | WP-30 或補錄後 |
| ~~OQ-S4-6~~ | ~~教練報告載體(既有)~~ | ✅ **關閉(2026-08-05,T-exit)**:`coach_report.py` 一鍵產出單檔自足靜態 HTML(inline CSS + inline SVG、零外部資源、可直接寄送),四份 committed 範例 deterministic。升級為互動式的觸發條件(教練需互動篩選)未達 | 使用者 | 2026-08-05 |
| OQ-S4-13 | T3 key 事件記錄採 opt-in default-off（D-29.9），本 slice 未接生產（app `createDataRecorder` 未傳 `recordKeyEvents:true`），故現有匯出流程仍不發 key 事件 | 🟡 **維持 open**;生產啟用需一行 app 接線 + 重錄一份帶 key 事件的 fixture 才有真實 sub-tick release 證據。T-exit 已把此缺口做成**可觀測**:報告的「release 來源」欄在兩份真實 fixture 上皆顯示 `tick_keys 20`,一旦生產接線即可直接在報告上看出差異 | 使用者 / 研究者 | 後續(不阻塞 WP-29 收斂) |
| (外部) | KI-004 修法落地(K-1 雙域 / K-2 M14 ② 撤回 / K-3 自由位移已拍板) | 🟡 待 S1 落地(計畫已於 main `8e6e442` 落 `docs/known_issue/KI-004-S1/`);**不阻塞 WP-29**,阻塞 WP-30/31 | 使用者 / 研究者 | WP-30 T0 前 |
---

## Outcomes & Retrospective(WP-29 收斂,2026-08-05)

### 交付了什麼

教練拿到的第一層可用產物 = **一道指令 → 一個可寄送的 HTML 檔**,裡面六個數字每一個都
自帶「n / flags / 版本 / 為什麼可以相信它」。這是 stage4 第一次把「指標」變成「可以拿給
人看的東西」,也是 WP-30/31 疊加報告 v1/v2 與 WP-32 晉升清單的骨架。

| 產出 | 落點 |
|---|---|
| `timeline-v1` 窗界 + 五錨點 + outcome + 封閉 flags 詞彙表 | `metrics/algorithms/peek.py` · [analysis-peek-timeline.md](../../../../operational/analysis-peek-timeline.md) |
| `compute-v1` 逐量交叉驗證閘(≤1e-9,含反 vacuous) | `metrics/algorithms/timeline.py` · `tests/golden/research/timeline-parity.test.ts` |
| `sync-v1` 三指標 + pre-registered 三分支精度判定 | `metrics/algorithms/sync.py` · `notebooks/t2/outputs/sync-precision.json` |
| additive key 事件(opt-in,使用者 override) | `src/data/DataRecorder.ts` · `peek.py` 的 `t_release_event`/`release_source` |
| 教練報告 v0(單檔靜態 HTML,條件分層) | `src/report/coach_report.py` · `notebooks/t-exit/outputs/`(四份) |

### 四件值得記住的事

1. **對表閘保證一致,不保證正確**(S-29.2)。ε parity 兩側同錯仍恆綠,是 M14 ② 撤回的
   根因。本 WP 因此在 parity 之外一律要求「反 vacuous」斷言 —— 閘必須證明自己有東西可比。
2. **凍結的價值在於它擋得住你自己**。`sync-v1` 在看到 09:39 之前就定案,所以 `sufficient`
   是一個有意義的結果而不是事後合理化;同理 D-29.13 拒絕逐組重跑判定。
3. **缺資料是資料**。08:03 的 `n=0` 一路從 flag → 聚合規則 → 報告呈現都沒有被補成 0,
   最後一哩(S-29.11 的 `mean 0`)是呈現層才發現的,說明紅線要一路守到像素為止。
4. **既有的閘會在你不注意時救你一次**(S-29.12)。C-D1 的 AST 掃描抓到了新模組的違規,
   而我原本正打算再寫一份重複的同款測試。

### 遺留(不阻塞本 WP 收斂)

- **OQ-S4-10 / OQ-S4-11 / OQ-S4-13 維持 open**,三者都缺同一件東西:**新的真實錄製**
  (帶 inferred release 樣本 / 帶 ADS-on 或 projectile 條件 / 帶 key 事件)。本 WP 明令不
  重錄 fixture,故三者一併留待後續,並已在報告與文件上做成可觀測。
- **KI-004 S1 尚未落地**;WP-29 不受影響(全程未讀 `px`/`pz`),但 WP-30/31 的 entry
  blocker 仍在。
- **stage4/exec-plan 的 M14 ② 敘述仍互相矛盾**(exec-plan README 寫「六項全綠」vs stage4
  README 寫「② 撤回」)。此矛盾已由 main 的 `8e6e442` 記為 S-S1.1 並指派給 **KI-004-S1
  T6**,不屬 WP-29 scope,本切片刻意未動。
