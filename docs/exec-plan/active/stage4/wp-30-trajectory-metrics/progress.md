# WP-30 — Progress / Decision Log / Surprises / Open Questions

> Spec:[README.md](README.md) · Task 索引:[task-checklist.md](task-checklist.md)
> 每個 task 完成時與切片一起 stage。Decision 編號 `D-30.n`、Surprise 編號 `S-30.n`。
> 跨 WP / 跨文件的決策入 [DECISIONS.md](../../../DECISIONS.md);修 bug 決策入 [BUGFIX-DECISIONS.md](../../../../known_issue/BUGFIX-DECISIONS.md)。

## Progress

| 日期 | Task | 狀態 | 摘要 |
|---|---|---|---|
| 2026-08-07 | (規劃) | 📋 | WP-30 計畫與 task 清單建立(T0/T1/T2/T3/T-exit);規劃當下 entry blocker 未解除 |
| 2026-08-07 | (規劃) | 📋 | 使用者拍板三項規劃期決策:**D-30.1** phase 邊界複用 `seg-v2`(剩多段取法 D-30.1b 待真實資料)、**D-30.0** t_detect 獨立 task + parity 閘、**WP-30 等 A2-T4 完成後才開工** |
| 2026-08-07 | (對帳) | ✅ | [KI-005-A / A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 已落地:M14 ③④⑤ 重新宣告,KI-006 CLOSED,**entry blocker 三條理由全數解除**。WP-30 仍**未開工**——本行只更新阻塞狀態,T0 本身仍待執行(不得跳過自行覆核) |

---

## 進場事實(2026-08-07 規劃期讀碼 + 讀資料;非 task 產出,供 T0 引用與覆核)

> 以下三段是規劃期查證的結果,**T0 必須自行覆核而非照抄**(A2-T2 的教訓:提交的產物要獨立重跑)。

### 1. entry blocker 現況:已於 A2-T4 解除(2026-08-07)

KI-005-A 的 A2-T1(三份新採樣)、A2-T2(四項複驗;FM-1 守恆檢查殘差 ≤ 5.6e-16,以機器精度關閉)、A2-T3(`seg-v2` 凍結,`sg_window=11 / peak_sigma_k=0.75 / peak_floor=60 / low=0.1 / stop=0.2`)、**A2-T4(M14 ③④⑤ 重新宣告 + KI-006 解除判定)皆已完成(2026-08-07)**。M14 帳本已更新為③④⑤ 重新宣告,**entry blocker 三條理由全數解除**;WP-30 T0 仍須自行覆核上游 exit-gate 的實際證據(不得只信任帳本文字)後才可開 T1。

### 2. fixture roster(規劃期實測)

| fixture | ticks | ω source | `meta.scene.eye` / `simToWorld` | `key` 事件 | `counter` | visible | `meta.suspect` | `validity.corridorExceeded` |
|---|---:|---|---|---:|---:|---:|---|---|
| 08:03 | 3,507 | `aim-diff-legacy` | ❌ / ❌ | 0 | 0 | 20 | false | — |
| 09:39 | 2,723 | `aim-diff-legacy` | ❌ / ❌ | 0 | 24 | 20 | true(KI-004 corridor) | — |
| **09:18** | 2,038 | `tick-integral` | ✅ `(0,1.6,4)` / 0.01 | 86 | 23 | 20(L10/R10) | **true** | true |
| **09:24** | — | `tick-integral` | ✅ / 0.01 | 84 | 25 | 20 | **true** | true |
| **09:37** | 1,904 | `tick-integral` | ✅ / 0.01 | 78 | 20 | 20 | **false** | true |
| `synthetic_counterstrafe.json` | 48 | `tick-integral` | ✅ / 0.01 | 0 | 2 | 2 | — | — |

三份新匯出的 `meta.mouseIntegration` 皆為 `tick-window-integral`(`radPerCount = 3.8397e-4`),`meta.display.refreshEstimateHz = 240`、`meta.targets.hitbox = {1,2,1}`、`meta.weapon.id = ak47`(hitscan,`bullet` 缺席)、`meta.session.participantId = P001`。

### 3. `suspect` 來源辨識(WP-30 必須重立使用界線)

- 三份新匯出的 `meta.validity` **只有** `corridorExceeded: true`,`perfFloor` / `recorderOverflow` / `bufferOverflow` 全為 false。
- **09:37 是反證**:`corridorExceeded: true` 但 `suspect: false` ⇒ KI-004/S1 的 NFR-S1-2b(corridor 不得單獨拉 suspect)確實生效。
- 故 09:18 / 09:24 的 `suspect: true` 另有來源;A2-T1 記為 `experimentSession.suspect`(session 中途退出 fullscreen)。該判定的 false positive 已由 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 於 commit `1d6e874` 修正,但**這三份是修法前錄的** → T0 須查清並拍板(見 OQ-S4-16)。
- **[D-29.2](../wp-29-coach-timeline/progress.md) 在本 WP 自動失效**:該決議的成立條件是「不消費 `px/pz`」,而 ε(t) 的射線原點為 `eye_origin.base + (px,0,pz) * simToWorld` → 本 WP 必然消費。T0 必須重立界線與失效條件。

---

## Decision Log

> 格式沿用 WP-29:每條含決策、理由(含 **Alternatives Considered** 與拒絕理由)、證據。

| # | 決策 | 理由 | 證據 |
|---|---|---|---|
| **D-30.0** | **偏離 [stage4 §6](../README.md) 的 WP-30 task 拆解**:插入 **T1 = t_detect Python 推導 + 對表閘**,原 T1(phase)/T2(101pt)順延為 T2/T3;估時 2–3d 上修為 2.5–3.25d。✅ **使用者於 2026-08-07 拍板採此案** | FR-D11 要求「REC 邊界與 t_detect 推導一致性檢查」,而 Python 側無 t_detect;`t_detect` 是**既有構念**(TS 權威 = [detectionDerivation.ts](../../../../../src/metrics/detectionDerivation.ts)),依 C-D4 不得在 Python 另立定義 → 必須有對表閘,而對表閘是獨立的垂直切片。Alternatives Considered:① 折進 phase task 且不設 parity 閘(拒絕:等於讓既有構念多一個未對表定義,正是 C-D4 要防的,且 `analysis-t-detect.md` 自稱 provisional、與程式碼可能已分歧,無閘則永遠不會發現);② 本 WP 不做一致性檢查、降級為 OQ(拒絕:FR-D11 未完整交付,REC 邊界失去唯一的外部效度檢核,且 WP-32 晉升時仍須補) | 本檔規劃期記錄;[README.md §4](README.md) 偏離說明;T0 落地時回寫 [../README.md §6](../README.md) |
| **D-30.1** | ✅ **phase 邊界複用 `seg-v2`**(2026-08-07 使用者拍板,關閉 OQ-S4-14 主體):`MR = primary_flick` 起訖、`REC = [t_visible, MR.start)`、`V = [MR.end, t_first_shot]`;**Butterworth 降為報告用平滑,不產生第二套運動起點**。此結構為定案,T2 不得改動 | 「動作何時開始」在 repo 內已有唯一權威(`seg-v2`,2026-08-07 剛以合成 + 三份真實雙維度重掃凍結);再建一套 Butterworth 偵測器必然在部分 peek 給出不同 tick,教練報告會出現分段圖與 phase 表互相矛盾而無人可仲裁 —— 正是 C-D4 要防的。且獨立偵測器須自帶參數並重跑一次雙維度掃參,等於把 A2-T3 剛做完的工作再做一次。Alternatives Considered:① 獨立 Butterworth 偵測器(拒絕:C-D4 第二定義 + 重複校參成本;FR-D11 要交付的是三段時長與一致性檢查,Butterworth 只是原論文的實作手段,非需求本身);② 兩者併行取交集(拒絕:交集為空的 peek 無處置,等於第三種定義) | [analysis-segments.md](../../../operational/analysis-segments.md) `seg-v2` frozen registry;[KI-005-A / A2-T3](../../../../known_issue/KI-005-A/A2-blocked-plan.md) 掃參證據 |
| **D-30.1b** | *(待 T0 以真實資料拍板)* 一個 peek 切出**多個 segment** 時 MR 取哪一段:① 第一個 `primary_flick`(現行 `seg-v2` 語意) ② peak ω 最大的 segment ③ 首個 `primary_flick` 起點到最後一個 `micro_adjustment` 終點的合併區間 | 使用者 2026-08-07 指示「剩下等到真實資料再拍板」。判準 = 三份真實匯出的逐 peek segment 數分佈 + 疊圖目視;三候選皆無法一致對應「主運動期」時(如多數 peek 為甩過頭再修回的雙峰),才回頭重開「是否需要獨立偵測器」,且屬**新決策**須入 [DECISIONS.md](../../../DECISIONS.md),不得由 T2 自行裁量 | — |
| **D-30.2** | *(待 T0 拍板)* fixture roster 凍結 + `strict=True` 機械閘 | — | — |
| **D-30.3** | *(待 T0 拍板)* 三份新 fixture 的 `suspect` 使用界線與失效條件(D-29.2 不適用) | — | — |
| **D-30.4** | *(待 T0 拍板)* `phase-v1` / `curve-v1` pre-registration:規則、雙維度通過條件、最小樣本數、flags 草案 | — | — |

## Surprises

| # | 內容 | 影響 |
|---|---|---|
| **S-30.1** | 規劃期發現 WP-29 的三份 fixture 分工(合成 / 08:03 零輸入 / 09:39 主要效度)在 WP-30 **完全不適用** —— 兩份舊真實匯出皆為 `aim-diff-legacy` 且缺 `meta.scene.eye`,ω 與 ε 兩條路都走不通 | 真實證據整組換成 09:18/09:24/09:37;此界線寫成 strict 機械閘而非文件自律(T0) |
| **S-30.2** | 三份新匯出的 `validity.corridorExceeded` 全為 `true`,但 09:37 的 `suspect` 為 `false` —— 這正好是 KI-004/S1 解耦生效的反證,也說明 09:18/09:24 的 suspect 來自別處(KI-007 領域) | T0 的使用界線決議不能沿用 KI-004 的推理,須另立(OQ-S4-16) |
| **S-30.3** | 合成 fixture 只有 **48 ticks / 2 peeks**,而 `butter_filter` 對 `樣本數 ≤ 3*max(len(b),len(a))` 直接拋 `ValueError` → 合成資料在 phase 濾波路徑上是**必然退化**的 | 短窗退化必須是「flag + fallback」的必跑回歸案例,不能列為「已知不支援」(T2 DoD ③) |

## Open Questions

> 本 WP 新增 OQ-S4-14/15/16;既有 OQ-S4-* 見 [../README.md §8](../README.md)。

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-S4-14** | phase 邊界複用 `seg-v2` primary_flick,或獨立 Butterworth 偵測器(FR-D11 字面) | 🟡 T0 拍板;建議複用 | 使用者 / 研究者 | WP-30 T0 |
| **OQ-S4-15** | `t_detect` 在 counter-strafe drill 上是否有足夠 `detected` 樣本支撐 REC 一致性檢查 | 🟡 T1 以資料判定;不足即 `blocked-by-data` | 研究者 | WP-30 T1 |
| **OQ-S4-16** | 09:18 / 09:24 的 `suspect = true` 是否為 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 的 false positive,抑或 session 中途真的退出 fullscreen | 🟡 T0 查清 + 拍板使用界線 | 使用者 / 研究者 | WP-30 T0 |
