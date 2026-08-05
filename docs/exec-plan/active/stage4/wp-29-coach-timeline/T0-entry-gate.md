# T0 — entry gate(上游複驗 + 對表基準凍結 + 精度判準 pre-registration;無演算法碼)

> Part of [WP-29 coach-timeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | — (上游 = WP-28 T1;M14 亦已通過) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 僅本 WP 文件(README/checklist/progress);**零程式碼** |
| **狀態** | ⬜ |

## Objective

把 WP-29 的三個「事後不得改」的前提凍結成可稽核狀態:① 上游 exit-gate 引用;② `compute.ts` 對表基準清單與其**條件性缺事件語意**;③ **Sync 族量化精度判準的三分支與最小樣本數**——判準必須在看到任何真實 Sync 樣本之前凍結,否則 T3(動引擎 data 層)就變成看資料決定。

## In scope

- **上游複驗(只引用,不重跑)**:
  - WP-28 **T1 exit**(`load_export`/`check_dt`/合成產生器)為本 WP 的硬相依 → 引用 [wp-28 progress.md](../wp-28-research-foundation/progress.md) 對應段落。
  - M14 雖非本 WP 的 entry 條件,仍記錄可引用範圍:`seg-v1` 凍結、單樣本效度限制、一鍵 pipeline 入口(①③④⑤⑥)。**② ε parity 已撤回**([KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / K-2)→ progress 須明記「本 WP 不引用任何 ε(t) 產物」。
- **對表基準清單凍結**(逐條寫 progress,T1 據此寫測試):
  | 量 | `compute.ts` 權威語意(逐位重現) |
  |---|---|
  | `counterReactionMs` | 逐 peek `counter.t − visible.t`;`counter` = 窗 `[t_visible, nextVisible.t)` 內**第一個** counter 事件(不分鍵);缺席 → 該 peek 不進聚合 |
  | `fireTimingAlignmentMs` | 逐 peek `firstFire.t − counter.t`;**兩個錨點皆需存在** |
  | `firstShotHitRate` | `(命中的首發數 / **全部 visible 事件數**) × 100`;命中 = `fire.hit === true` **或** `fire.shotSeq ∈ hit 事件的 shotSeq 集合` |
  | `firstFire` 選取 | 窗內第一個滿足 `firstShot === true` **且**(`targetId` 缺席 **或** `=== visible.targetId`)的 fire |
  | `stat()` | `p50` = 線性插值分位數;`sd` = **母體**標準差(÷n);非有限值先過濾;空集合 → `{mean:0,p50:0,sd:0,n:0}` |
- **缺事件語意註記**:[SimLoop.ts](../../../../../src/loop/SimLoop.ts) `applyInput` 只在 `ev.down && !held(反向鍵) && vx 反號` 時寫 `counter` → 「已停住才開槍」「未 strafe」的 peek **本來就沒有** counter 事件。此為**常態語意**,不是資料缺陷;T1/T2 一律以 flag 表達。
- **精度判準 pre-registration(本 task 最重要的產出)**:
  - 量化誤差來源 = `t_release` 取自 `ticks[].keys`(±half tick);均勻量化 SD = `dt/√12`,128 Hz 下 = `7.8125/√12 ≈ 2.2551 ms`。`t_counter`/`t_fire` 為 input `timeStamp`(sub-tick),不受此限。
  - **判準(§2.4d 具體化,三分支)**,對 `release_to_fire_ms` 與 `counter_hold_ms` 各自判定:
    | 條件 | 判定 |
    |---|---|
    | 有效樣本 `n < min_samples` | **`blocked-by-data`** — 不得觸發 T3;必須等 OQ-S4-12 樣本 |
    | `n ≥ min_samples` 且 `quantization_sd ≥ sample_sd × sd_ratio_threshold` | **`insufficient`** — 觸發 T3 |
    | `n ≥ min_samples` 且 `quantization_sd < sample_sd × sd_ratio_threshold` | **`sufficient`** — T3 標 skipped |
  - **凍結值提案**(T0 拍板寫入 `SyncParams`,version = `sync-v1`):`min_samples = 10`、`sd_ratio_threshold = 1/3`(即樣本 SD ≤ 6.765 ms 判 insufficient)。
- **資料現況記錄**:把 [README §0](README.md) 的兩份真實匯出對照表抄入 progress 作為 T1/T2 的前置事實(08:03 = 零輸入邊界案例、09:39 = 主要效度樣本)。OQ-S4-12 **已於 2026-08-05 關閉**(09:39 補錄到位),本 task 只需記錄關閉證據;新開 **OQ-S4-10 / OQ-S4-11**。
- **KI-004 使用界線拍板(必須入 Decision Log)**:09:39 帶 `meta.suspect = true`,成因為 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) 的 corridor gate 單位域錯誤,**不是**效能/溢位/gate 失敗。須明文決議「本 WP 使用該 fixture 的理由與界線」:WP-29 全部指標只消費 `events` 與 `ticks[].keys`,**不觸及 `px/pz`**,故不受 KI-004 D2(離線 ε 原點)影響;若日後 WP-29 的任何指標開始消費 `px/pz`,此決議即失效並須重新評估。

## Out of scope

- 任何 `research/` 演算法碼與測試(T1 起)。
- 修改 `src/` 任何檔案(T3 若觸發才碰,且僅 data 層)。
- 調整 `seg-v1` 或任何 WP-28 已凍結參數。

## Steps

- [ ] 引用並記錄 WP-28 T1 exit 證據 + M14 可引用範圍(不重跑測試)。
- [ ] 把對表基準清單五列逐條抄入 progress(含 `firstShotHitRate` 分母與 `stat()` 定義)。
- [ ] 記錄 `counter` 事件條件性語意 + 出處行號。
- [ ] 拍板並凍結 `SyncParams` 提案值(`min_samples`/`sd_ratio_threshold`/`version`),寫入 progress Decision Log(`D-29.x`)。
- [ ] 記錄 OQ-S4-12 關閉證據;開 OQ-S4-10(t_release fallback)與 OQ-S4-11(條件分層無真實對照),填 owner/deadline,並在 [../README.md §8](../README.md) 對帳補列。
- [ ] Decision Log 記 KI-004 使用界線(為何 `suspect=true` 的 fixture 仍可用於本 WP,以及失效條件)。
- [ ] 更新 [../README.md §3](../README.md) WP-29 狀態 ⬜ → 🟡。

## Definition of Done

1. progress.md 含**對表基準清單五列**,每列註明 [compute.ts](../../../../../src/metrics/compute.ts) 的行號範圍。
2. progress.md 含 `counter` 事件條件性語意段落 + [SimLoop.ts](../../../../../src/loop/SimLoop.ts) 行號引用。
3. progress.md Decision Log 有一條凍結 `SyncParams`(三個欄位值 + version + 凍結時點),且明文寫「事後不得依真實資料調整,只能升版重跑」。
4. OQ-S4-12 關閉證據已記(09:39 fixture 路徑 + 政策符合性);OQ-S4-10 / OQ-S4-11 已建立且各有 owner 與 deadline;stage4 [../README.md §8](../README.md) 已同步。
5. Decision Log 有一條 KI-004 使用界線決議,含**失效條件**(WP-29 指標若開始消費 `px/pz` 即需重評)。
6. `git diff --stat` 證據:本 task 僅動 `docs/exec-plan/active/stage4/`(零 `src/` 變更)。

## Commit

`docs(wp-29): T0 entry gate — compute.ts 對表基準凍結 + Sync 精度判準 pre-registration(sync-v1)+ KI-004 使用界線`
