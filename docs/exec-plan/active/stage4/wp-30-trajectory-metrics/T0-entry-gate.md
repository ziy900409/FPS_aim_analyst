# T0 — entry gate(M14 複驗 + fixture roster 凍結 + suspect 使用界線 + phase/curve pre-registration;無演算法碼)

> Part of [WP-30 trajectory-metrics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | **[KI-005-A / A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-345-重新宣告) 必須先落地**(M14 ③④⑤ 重新宣告);上游 = WP-28 全部 + WP-29 T1 |
| **Risk / Cplx** | Low / Low |
| **Touches** | 僅本 WP 文件(README/checklist/progress)+ [../README.md](../README.md) §3/§6/§8 對帳;**零程式碼** |
| **狀態** | ✅ 完成(2026-08-07) |

## Objective

把 WP-30「事後不得改」的四個前提凍結成可稽核狀態:① M14 六項(含剛重新宣告的 ③④⑤)確實綠燈;② **fixture roster** —— 哪幾份匯出可以作為本 WP 的效度證據,以及這條界線如何機械化;③ 三份新 fixture 的 **`suspect` 使用界線**(D-29.2 已失效,必須重立);④ `phase-v1` / `curve-v1` 的 **pre-registration 骨架** —— 判準必須在看到任何 phase/曲線結果之前寫下,否則就變成看資料決定參數(`seg-v1` 的教訓)。

## In scope

- **上游複驗(只引用,不重跑)**:
  - **M14 六項逐項確認**,特別是 ③④⑤ 的重新宣告文字與其效度限制範圍(A2-T4 產出)。任一項未綠 → **本 task 停手**,不得以「技術上已修好」代替帳本狀態。
  - WP-28 T-exit(一鍵 pipeline)、WP-29 T1(`build_peek_windows` = 唯一窗界來源)、`seg-v2` 凍結值([analysis-segments.md](../../../operational/analysis-segments.md) Frozen parameter registry)。
  - 三條 entry blocker 理由的解除證據各引一處([README.md §0.1](README.md))。
- **fixture roster 凍結**(逐份寫 progress,含 ω source / eye origin / key 事件數 / peek 數 / L-R 分佈):
  | fixture | 角色 |
  |---|---|
  | 09:18 / 09:24 / 09:37 | **真實效度樣本**(唯一;3 sessions × 20 peeks) |
  | `synthetic_counterstrafe.json` | 演算法邊界 + **短窗退化案例**(48 ticks / 2 peeks) |
  | 08:03 / 09:39 | **禁用於本 WP**;僅可作為「strict 閘必定拋錯」的負向測試輸入 |
- **strict 閘的機械化決議**:WP-30 所有 notebook 入口一律 `omega_deg_s(..., strict=True)` 與 `resolve_eye_origin(meta, strict=True)`;legacy 匯出當場拋錯。此決議須寫成 Decision Log 一條,T1–T3 的測試據此寫負向案例。
- **`suspect` 使用界線重立(必須入 Decision Log)**:
  - 逐份記錄 `meta.suspect` 與 `meta.validity`(09:18/09:24 = suspect true、09:37 = false;三份 `corridorExceeded` 皆 true → corridor 與 suspect 已於 KI-004/S1 解耦,09:37 為反證)。
  - 查清觸發源(A2-T1 記為 `experimentSession.suspect` / fullscreen 中途退出;[KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 修法在這三份**錄製之後**)。
  - 明文決議:**本 WP 消費 `px/pz`(ε 的射線原點),故 [D-29.2](../wp-29-coach-timeline/progress.md) 的界線不適用**;新界線須寫出「為何仍可用」與**失效條件**。
  - 若 A2-T1 遺留的「是否確有中途退出」仍未回 → 以 **OQ-S4-16** 帶著走,不得靜默當作乾淨資料。
- **`phase-v1` / `curve-v1` pre-registration 骨架**(數值於 T2/T3 掃參後凍結,但**規則與通過條件在此刻寫死**):
  - **phase 邊界來源:主體已於 2026-08-07 拍板(D-30.1),本 task 不重開** —— `MR = seg-v2 primary_flick` 起訖、`REC = [t_visible, MR.start)`、`V = [MR.end, t_first_shot]`,Butterworth 只作報告用平滑。T0 只需把決策與理由抄入 Decision Log。
  - **唯一待本 task 以真實資料拍板的子問題(D-30.1b)**:一個 peek 切出**多個 segment** 時 MR 取哪一段。
    - 證據:對三份真實匯出跑既有 [run_pipeline.py](../../../../../research/src/report/run_pipeline.py)(`seg-v2` 自動選版),取 `peek-segments.csv` / `peek-quality.csv` 的**逐 peek segment 數分佈**、`has_primary_flick` 比例、`merged_adjacent_peaks` 比例,並看 T3-sweep 既有疊圖。
    - 候選:① 第一個 `primary_flick`(現行 `seg-v2` 語意) ② peak ω 最大的 segment ③ 首個 `primary_flick` 起點到最後一個 `micro_adjustment` 終點的合併區間。
    - 判準先寫後看:**先**寫下「多段 peek 佔比 ≤ X% 就取候選 ①」之類的規則,**再**看數字,避免看完資料挑一個好看的。
    - 三候選皆無法一致對應「主運動期」時(如多數 peek 為甩過頭再修回的雙峰),才回頭重開「是否需要獨立偵測器」——屬**新決策**,須入 [DECISIONS.md](../../../DECISIONS.md),不得由 T2 自行裁量。
  - **掃參紀律(避免重演 `seg-v1`)**:凍結前必須同時通過 ① 合成 fixture 的已知邊界誤差條件 ② 三份真實匯出的第二評分維度。**單靠合成資料凍結一律不接受。**
  - `curve-v1`:`points = 101`、窗 = `[t_visible, t_first_shot]`(OQ-S4-5 已決)、插值法、`band` 取 IQR 或 mean±SD、`min_ticks` 下限、納入規則(沿用 D-29.5 的「整列零 flags」)。
  - 兩者的 flags 封閉詞彙表草案(T2/T3 落地時只能收斂,不得擴張成開放集合)。
- **反 vacuous 條款預告**:T1 的 t_detect parity 與 T2 的一致性檢查各自需要非零樣本;最小樣本數在此刻寫死(建議 `detected` 樣本 ≥ 10,與 `sync-v1` 的 `min_samples` 同量級),不足一律 `blocked-by-data`。

## Out of scope

- 任何 `research/` 演算法碼與測試(T1 起)。
- 修改 `src/` 任何檔案(本 WP 全程零 `src/` 生產碼變更)。
- 執行 A2-T4 本身(屬 [KI-005-A](../../../../known_issue/KI-005-A/README.md);協議 §6:entry-gate 的職責是**驗**上游 exit-gate,不是代辦)。
- 調整 `seg-v2` / `sync-v1` / `timeline-v1` / `construct-v1` 任何凍結值。

## Steps

- [x] 驗 A2-T4 已落地且 M14 ③④⑤ 已重新宣告;逐項抄錄宣告文字與效度限制進 progress(§1)。
- [x] 引用 WP-28 T-exit / WP-29 T1 / `seg-v2` 凍結證據(不重跑)。
- [x] 逐份記錄六個 fixture 的 ω source / eye origin / key 事件 / peek 數 / L-R 分佈,凍結 roster 表(progress §0.2 + §2)。
- [x] Decision Log 記 strict 閘機械化(`omega_deg_s(strict=True)` + `resolve_eye_origin(strict=True)`);獨立跑負向測試證實 08:03/09:39 兩處皆拋錯(D-30.2)。
- [x] 查清三份新 fixture 的 `suspect` 觸發源;Decision Log 記使用界線 + 失效條件(D-30.3);OQ-S4-16 已查明並關閉(引 KI-007 §5)。
- [x] 抄錄 D-30.1(phase 邊界複用 `seg-v2`,已拍板)進 Decision Log;**先寫下 D-30.1b 的判準**(多段佔比 ≤15% 取候選①),再跑 `run_pipeline.py` 取三份真實匯出的逐 peek segment 數分佈(58/60 單段、1/60 零段、1/60 雙段),依判準拍板取候選①。
- [x] 寫下 `phase-v1` / `curve-v1` 的 pre-registration 骨架(規則 + 通過條件 + 最小樣本數 + flags 草案,progress §3),明文標「事後不得依結果調整,只能升版重跑」。
- [x] 於 [../README.md §6](../README.md) 補記 WP-30 的 task 拆解偏離(插入 T1)與估時上修;§8 補列 OQ-S4-14/15/16。
- [x] 更新 [../README.md §3](../README.md) WP-30 狀態 ⬜ → 🟡。

## Definition of Done

1. progress.md 含 **M14 六項逐項狀態**,③④⑤ 附 A2-T4 的宣告出處;任一項非綠則本 task 不得標完成。
2. progress.md 含**凍結的 fixture roster 表**(六份逐列,含禁用理由),且 Decision Log 有一條 strict 閘決議。
3. Decision Log 有一條 **`suspect` 使用界線**決議,明文寫出 D-29.2 不適用的理由(消費 `px/pz`)與本 WP 的失效條件。
4. Decision Log 含 **D-30.1**(phase 邊界複用 `seg-v2`,抄錄已拍板決策 + Alternatives Considered)與 **D-30.1b**(多段 peek 的 MR 取法),且 D-30.1b 的**判準寫在數字之前**(progress 上兩者的先後可稽核),含三份真實匯出的 segment 數分佈證據。
5. progress.md 含 `phase-v1` / `curve-v1` **pre-registration 骨架**:規則、雙維度通過條件(合成 + 真實)、最小樣本數、flags 草案、version 字串,並明文「事後不得調整」。
6. OQ-S4-14/15/16 已建立,各有 owner 與 deadline;[../README.md §8](../README.md) 已同步。
7. `git diff --stat` 證據:本 task 僅動 `docs/exec-plan/active/stage4/`(零 `src/`、零 `research/` 變更)。

## Commit

`docs(wp-30): T0 entry gate — M14 複驗 + fixture roster 凍結 + suspect 使用界線 + phase-v1/curve-v1 pre-registration`
