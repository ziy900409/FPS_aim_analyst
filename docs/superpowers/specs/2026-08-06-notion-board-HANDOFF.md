# HANDOFF — Notion 專案進度工作台

> 交接日:2026-08-06 · 給接手的 agent
> 設計 spec(source of truth):[`2026-08-06-notion-progress-board-design.md`](2026-08-06-notion-progress-board-design.md)
> **先讀 spec 再讀本檔。** 本檔只記「做到哪、卡在哪、下一步怎麼接」,不重述設計。

---

## 1. 一句話

把本 repo 的專案進度做成 Notion 個人日常工作台(四張 database + 五個 view),**repo 為單一真相,Notion 單向衍生**。

## 2. 現在的狀態

| 項目 | 狀態 |
|---|---|
| 需求釐清 | ✅ 完成(使用者確認:受眾=自己/工作台;四個痛點全中) |
| 設計 + 使用者核准 | ✅ 完成(含 `⚠️ 交付 caveated` 狀態,使用者要求後加入) |
| spec 落檔 | ✅ 已 commit(2026-08-06,`0e29f70 add notion plan`) |
| active 部分資料蒐集 | ✅ 完成(見 §6 附錄) |
| §6 資料對 repo 覆核 | ✅ 完成(2026-08-06 第二次接手;見 §6.0) |
| workspace 拍板 | ✅ 完成(見 §4) |
| 在 Notion 實際建立 | ✅ **已完成(2026-08-06 第三次接手)** — 阻塞已解除,見 §10 落地紀錄 |

**使用者最後一個範圍指示**:先建骨架 + active 部分(4 張 DB + active/KI 的 Work Items 及其 Tasks + 5 個 view),28 個已交付 WP 之後再補。

## 3. ~~⛔ 阻塞:Notion 寫入工具未載入~~ → ✅ 已解除(2026-08-06)

> **本節保留為歷史紀錄。** 第三次接手時 §3.2 的解除路徑已生效:`ToolSearch` 查得
> `notion-create-database` / `notion-create-pages` / `notion-update-page` /
> `notion-create-view` / `notion-update-view` / `notion-update-data-source` 全部可呼叫,
> 且 `fetch self` 仍回報全部 `available`。**未使用任何繞道方案**(無 CSV 匯入、
> 無 integration token、無瀏覽器點 UI),全程走 MCP,spec §6「C 階段不寫任何程式碼」維持。
> 落地結果見 §10。

**以下為阻塞期間的原始紀錄。**

用 `notion-fetch` 帶 `id: "self"` 查過,**Notion 端授權與方案完全沒問題**——`create_pages` / `create_database` / `update_page` / `create_view` / `update_view` / `update_data_source` / `move_pages` / `duplicate_page` 全部回報 `available`。

但 **session 的工具註冊只掛了讀取工具**。查不到寫入工具的 schema,因此無法呼叫。已可用的 Notion 工具僅:
`search` · `fetch` · `list-*` · `query-data-sources` · `query-database-view` · `create-attachment` · `create-file-upload` · `create-folder` · `download-attachment` · `get-comments` / `get-teams` / `get-users` / `get-async-task` / `search-agents`

### 3.1 已做過的複驗(2026-08-06 第二次接手)

**阻塞未解除。** 四種查法全部落空,不必再試同樣的:

| 查法 | 內容 | 結果 |
|---|---|---|
| `select:` 精確名稱 | `notion-create-database` / `notion-create-pages` / `notion-update-page` / `notion-create-view` / `notion-update-data-source` | ✗ |
| `select:` 替代拼法 | `create-pages` / `create-database` / `notion-create-page` / `notion-update-view` / `notion-move-pages` | ✗ |
| 關鍵字 | `notion create database page update`、`create a page in a workspace with database schema properties` | ✗ |
| 強制字首 | `+notion` | ✗(只回讀取工具) |

同時 `fetch self` 再次確認 Notion 端全部 `available`。**兩邊對不起來 ⇒ 這是 claude.ai 端 Notion connector 的權限範圍被設成唯讀,不是 Notion 帳號、方案或授權問題。**

### 3.2 已定案的解除路徑(使用者 2026-08-06 拍板)

**使用者選擇:自己去 claude.ai 的 Notion connector 設定開啟寫入權限,然後重開 session。** 全程走 MCP,不碰 integration token,spec §6「C 階段不寫任何程式碼」得以維持。

**接手時請先做這件事**:

```
ToolSearch → select:mcp__<notion-server-id>__notion-create-database,mcp__<notion-server-id>__notion-create-pages
```

- **找得到** → 阻塞解除,直接跳 §5 開工。
- **找不到** → 不要嘗試繞道(不要用 `create-attachment` 塞 CSV、不要用瀏覽器工具點 Notion UI),也不要重跑 §3.1 那四種查法。直接回報使用者「connector 寫入權限尚未生效」。備案(integration token + script)使用者已知道但**已否決**,除非他主動改口才提。

## 4. ✅ 已答:建在哪個 workspace

**使用者 2026-08-06 確認:就建在目前連線的這個 workspace。**

- Workspace:**「Yang Hsin的空間」**(id `2e2585b8-d06c-8187-8fc0-00034e18c5be`)
- 帳號:`drinkingtower10296412@gmail.com`(與 Claude Code 登入信箱 `hsin.yh.yang@benq.com` 不同,**這是預期的**——個人 Notion 帳號放公司內容,該 workspace 內本來就有 `BenQ` database 與公司相關頁面)
- 位置:**workspace 頂層新頁面**,不掛在既有的「待辦事項和專案規劃」底下,也不進 `BenQ` database(spec N-9)
- 頁名:`FPS Aim Analyst · 工作台`

此題已結案,接手時不必再問。

## 5. 下一步(阻塞解除後照做)

照 spec §5.1 的七步。針對本次範圍(骨架 + active):

1. 建頂層頁 `FPS Aim Analyst · 工作台`(workspace 已拍板,見 §4,不必再問)。
2. 建四張 database,schema 照 spec §3。注意 `Work Items.保留原因` 是 `⚠️` 狀態的必填欄。
3. 匯入 §6 的 Work Items(10 列)與 Tasks(31 列)。
4. 匯入 Milestones(15 列)與 Open Questions(11 列)。
5. 補 relation:`Blocked by`、`Parent`、`Milestone`、`來源`。這些在 §6 是文字,建完後要轉成真正的 relation。
6. 建五個 view,filter 照 spec §4。**「🎯 今天」的 filter 是 `Parent.Status ∈ {🟡 進行中, ⚠️ 交付 caveated}` 且 `Done = false`** —— 現在跑出來應該是 `KI-005-A1 T4`。拿這個當驗收:建完後「今天」view 若不是顯示 KI-005-A1 的 T4/T5/T6/T-exit,relation 就接錯了。
7. 28 個已交付 WP(stage1 10 + stage2 9 + stage3 4 + stage5 4 + muzzle-tracer 1)**本次不建**,等使用者看過骨架再說。

## 6. 附錄:已蒐集的資料

> **這是衍生資料,不是真相。** 可從 repo 重產;若與 repo 不符,以 repo 為準。
> 原始 CSV 曾寫在 session scratchpad,已隨 session 失效,故在此保留內容。

### 6.0 覆核紀錄(2026-08-06 第二次接手)

**已逐項對 repo 覆核,§6 的資料正確,可直接拿來匯入。** 覆核了 §6.2 的五個 `task-checklist.md` 與 §6.3 的 `exec-plan/README.md` §3 里程碑表:

| 覆核項 | repo 實況 | 與 §6 一致 |
|---|---|---|
| WP-28 tasks | T0–T4 + T-exit,6 列全 ✅ | ✅ |
| KI-004-S1 tasks | T0–T6 + T-exit,8 列全 ✅ | ✅ |
| KI-005-A1 tasks | 8 列;T0–T3 ✅,T4/T5/T6/T-exit ⬜ | ✅ |
| KI-005-A2 tasks | A2-T1~T4,4 列全 ⛔ | ✅ |
| KI-006-C tasks | T0–T3 + T-exit,5 列全 ⬜ | ✅ |
| M1–M15 | M1–M6 / M8–M12 ✅;M7 ✅ caveated;M13 🟡;M14 🟡;M15 ⬜ | ✅ |

**唯一要改的措辭**:§6.1 的 WP-28 `保留原因` 請改用 spec §3.1 的版本——

> task 全數完成(2026-08-05);M14 **①⑥ 維持、② 已於 KI-004 S1 落地後重新宣告(2026-08-06)**、③④⑤ 因 KI-005/KI-006 撤回且兩者尚未落地。`seg-v1` 已被真實資料否證(SG window 7 < beat 週期 8),依 D-28.7 須升版 `seg-v2` 重跑全鏈,不得原地調參。

事實與原文相同(①②⑥ 現在都維持),但這版把「② 撤回過又重新宣告」的歷史保住了——正是 spec N-5 設 Milestones 撤回欄位的理由,`保留原因` 不該把它抹平。`exec-plan/README.md` §3 的 M14 列即為此寫法。

### 6.1 Work Items(10 列)

| Name | Type | Stage | Status | Milestone | Blocked by | 交付日 | 估時 |
|---|---|---|---|---|---|---|---|
| WP-28 research-foundation | WP | stage4 | ⚠️ 交付 caveated | M14 | — | 2026-08-05 | 3.5–4.5 |
| WP-29 coach-timeline | WP | stage4 | ✅ 完成 | — | — | 2026-08-05 | 1.5–2.5 |
| WP-30 trajectory-metrics | WP | stage4 | 🔴 阻塞 | M14 | KI-005-A1; KI-006-C | — | 2–3 |
| WP-31 advanced-diagnostics | WP | stage4 | 🔴 阻塞 | M14 | KI-005-A1; KI-006-C | — | 2–3 |
| WP-32 dashboard-integration | WP | stage4 | ⬜ 未開 | M15 | WP-30 | — | 2–3 |
| KI-004-S1 sim/world 單位域錯配 | KI | known-issue | ✅ 完成 | — | — | 2026-08-06 | — |
| KI-004 S2/S3 逐 tick eye pose | KI | known-issue | ⬜ 未開 | — | — | — | — |
| KI-005-A1 ω(t) aliasing 選項 A | KI | known-issue | 🟡 進行中 | — | — | — | — |
| KI-005-A2 新採樣 + 複驗 + seg-v2 | KI | known-issue | 🔴 阻塞 | M14 | KI-005-A1; KI-006-C | — | — |
| KI-006-C construct presence gate | KI | known-issue | ⬜ 未開 | — | — | — | — |

**`保留原因`(僅 `⚠️` 需填)** — WP-28:
> task 全數完成(2026-08-05);M14 ①②⑥ 維持、③④⑤ 因 KI-005/KI-006 撤回且兩者尚未落地。`seg-v1` 已被真實資料否證(SG window 7 < beat 週期 8),依 D-28.7 須升版 `seg-v2` 重跑全鏈,不得原地調參。

**兩列是設計時沒預期、蒐集資料才發現的**,不要刪掉:
- `KI-004 S2/S3` — KI-004-S1 已交付,但母題 S2/S3 仍待辦;只建 S1 一列的話這塊會從看板消失。
- `KI-005-A2` 獨立於 A1 — A1 現在可做(🟡),A2 卡在實機採樣(🔴)。混成一列會讓 A1 的 🟡 蓋掉 A2 的 🔴。

`Repo` 欄一律 `https://github.com/ziy900409/FPS_aim_analyst/blob/main/<檔案在 repo 的路徑>`。

### 6.2 Tasks(31 列)

**機械式取自各 `task-checklist.md` 的表格**,直接重讀這五個檔即可重產:

| Parent | 來源檔 | 列數 | Done 狀態 |
|---|---|---|---|
| WP-28 | `docs/exec-plan/active/stage4/wp-28-research-foundation/task-checklist.md` | 6 | T0–T4 + T-exit 全 ✅ |
| KI-004-S1 | `docs/known_issue/KI-004-S1/task-checklist.md` | 8 | T0–T6 + T-exit 全 ✅ |
| KI-005-A1 | `docs/known_issue/KI-005-A/task-checklist.md`(Stage A1 表) | 8 | T0–T3 ✅;**T4 / T5 / T6 / T-exit ⬜** |
| KI-005-A2 | `docs/known_issue/KI-005-A/task-checklist.md`(Stage A2 表) | 4 | 全 ⛔(記為 Done=false) |
| KI-006-C | `docs/known_issue/KI-006-C/task-checklist.md` | 5 | 全 ⬜ |

`Kind` 判定:`T0` → `entry-gate`;`T-exit` → `exit-gate`;其餘 → `task`。
`Name` 格式:`<Parent 短碼> <T編號> <task 標題>`,例:`KI-005-A1 T4 tick 窗積分 ticks[].dYaw/dPitch + 三個閘`。
WP-29 的 task **不建**(已完成,對工作台無用)。

### 6.3 Milestones(15 列)

M1–M15,內容取自 `docs/exec-plan/README.md` §3 的里程碑門控表。三列需要特別處理:

- **M7 校準效度** — Status `⚠️ 交付 caveated`,宣告日 2026-07-07。撤回原因欄填:`非 cl_showpos 實錄——外部實錄行為級真值仍為 caveat(GD-14)`。
- **M13 階段 E 交付** — Status `🟡 部分`,宣告日 2026-07-14(自動閘)。備註:自動項 E-1~E-10 全綠且 `test:ci` exit 0;清單 E §2 手動視覺/手感回填為阻塞項,待研究者實機(issue #32)。
- **M14 research 地基** — Status `🟡 部分`,宣告日 2026-08-05,撤回日 2026-08-06。撤回原因欄(這格是整張表的重點,要完整寫):
  > ② 因 KI-004(ε 量測原點錯尺度,實測偏差 12.52°/67.11°)於 2026-08-05 撤回,已於 2026-08-06 KI-004 S1 落地後重新宣告;③④⑤ 因 KI-005(ω render/sim aliasing)+ KI-006(真實樣本無 counter-strafe 構念)於 2026-08-06 撤回,兩者尚未落地。①②⑥ 維持。WP-30/31 entry blocker 仍維持。

M1–M6、M8–M12 全 `✅ 達成`;M15 `⬜ 未達`。

### 6.4 Open Questions(11 列)

取自各 `progress.md` 的 Open Questions 表,只收 🟡 未決者。**依提出日最舊優先排序**(spec §4 的刻意設計)。

| OQ | 來源 | 負責人 | 備註 |
|---|---|---|---|
| **OQ-A-5** 新採樣時機與規模(= OQ-KI5-6) | KI-005-A1 | 研究者 | **最高優先,見下方** |
| OQ-C-2 是否要求 n ≥ 2 session(= OQ-KI6-4) | KI-006-C | 研究者 | A2-T1 前須有結論 |
| OQ-C-1 tracking/detection 家族條件 | KI-006-C | 研究者 | 需 meta 補宣告值或改寫條件 |
| OQ-C-4 exit code 編號慣例 | KI-006-C | 實作者 | T2 實作時定案 |
| OQ-C-5 構念缺席時是否拒絕輸出 segments CSV | KI-006-C | 實作者 | 建議不拒絕 |
| OQ-C-3 構念判定是否進 coach_report | KI-006-C | 研究者 | 建議延後 |
| OQ-A-6 守恆閘在 ADS 樣本上的容差 | KI-005-A1 | 實作者→研究者 | A1 只宣告 hip-only exact |
| OQ-A-4 `beat_period_ticks` 進 `meta.display.gate`(= OQ-KI5-5) | KI-005-A1 | 使用者 | 不阻塞 A1 |
| OQ-A-3 dPitch 夾角情形是否需 quality flag | KI-005-A1 | 研究者 | 建議先不加 |
| OQ-S1-6 `meta.validity` 上線後 `suspect` 是否仍為主要旗標 | KI-004 S2/S3 | 研究者 | S3 前 |
| OQ-S1-7 `leadDerivation.ts` `interpolateState` 待複查 | KI-004 S2/S3 | 實作者 | `src/metrics/leadDerivation.ts:134-138` |

提出日多為 2026-08-06(KI-005-A / KI-006-C 建立日);OQ-S1-6/7 為 2026-08-05~06。**日期是推得的,不是逐條查證的**——若要精確,回各 `progress.md` 核對。

## 7. 蒐集資料時發現的事(值得轉達使用者)

**OQ-A-5 是整個專案的拱心石。** 阻塞鏈:

```
OQ-A-5(新採樣時機與規模,待研究者拍板)
  └→ KI-005-A2-T1 新採樣
       └→ A2-T2 複驗 → A2-T3 seg-v2 → A2-T4 M14 ③④⑤ 重新宣告
            └→ M14
                 ├→ WP-30 → WP-32 → M15
                 └→ WP-31
```

**一題未拍板的排程問題,擋住五個 WP 和兩個里程碑。** 這條鏈完整存在於 repo,但要跨 4 個檔案才拼得出來。已向使用者說明。若這個看板只做成一件事,做成這件就值了。

## 8. 不要做的事

- **不要讓 Notion 回寫 repo**,任何方向皆然(spec N-1)。
- **不要在 repo 建 sync script / front-matter**。那是 B 階段,觸發條件寫在 spec §5.3,現在還沒到。
- **不要 commit**。使用者明確指示 spec 先不 commit;且工作區有 KI-005-A 的未完成變更(`src/input/InputSampler.ts` 等),不要一起 stage。若真要 commit,先開分支。
- **不要做 timeline / gantt、不要做 commit 動能圖、不要把 GD-n / BD-n 搬進 Notion**(spec N-6/N-7/N-8)。
- **不要用 CSV 匯入當替代方案**,除非使用者明確同意。已評估並否決:匯入後型別/relation 要手動修,且無法更新(重匯會產生重複列),等於建一個從第二天起就失準的看板。

## 9. 對話中已定案、spec 未必寫全的細節

- 使用者要求加入 `⚠️ 交付 caveated`(spec N-10)。「保留原因」必填欄是**我加的**,理由:單獨一個 ⚠️ 標籤沒有內容,三個月後還是得回翻 repo。使用者未反對。
- spec §5.3「兩週後沒真的用就刪掉」這條硬條款,使用者明確回覆「接受」。**不要軟化它。**
- 沒有跑 `writing-plans` 產獨立實作計畫,因為 spec §5.1 本身就是可執行步驟清單。已向使用者說明。

---

## 10. 落地紀錄(2026-08-06 第三次接手)

### 10.1 已建立什麼

Workspace「Yang Hsin的空間」頂層新頁 **`FPS Aim Analyst · 工作台`**(§4 拍板位置,未掛既有頁、未進 `BenQ` database)。

| 物件 | 數量 | 備註 |
|---|---|---|
| 四張 database | 4 | schema 照 spec §3 |
| Work Items | 10 | 照 §6.1(含 §6.0 指定的 WP-28 `保留原因` 措辭) |
| Tasks | 31 | 照 §6.2 五個 `task-checklist.md` 機械式取出 |
| Milestones | 15 | 照 §6.3,M7/M13/M14 的宣告/撤回欄位完整填入 |
| Open Questions | 11 | 照 §6.4,最舊優先 |
| linked views | 5 | 照 spec §4 |

**Relation 全部接妥**:`Milestone`、`Parent`、`來源`、`Blocked by`(self-relation,附 `Blocks` 反向欄)。
`Blocked by`:WP-30 ← KI-005-A1 + KI-006-C;WP-31 ← 同;WP-32 ← WP-30;KI-005-A2 ← KI-005-A1 + KI-006-C。

### 10.2 §5 步驟 6 的驗收 — ✅ 通過

「🎯 今天」view 實際查詢結果 = **KI-005-A1 的 T4 / T5 / T6 / T-exit**,與 §5 指定的驗收標準逐項相符 ⇒ relation 接線正確。

### 10.3 偏離 spec 之處(四項,均已入帳)

| # | 偏離 | 原因 | 影響 / 待辦 |
|---|---|---|---|
| **N-C1** | 「🎯 今天」的 filter **不是** `Parent.Status ∈ {…}`,而是 Tasks 上新增的 checkbox **`父項在動`** | MCP 的 view DSL **無法過濾 relation 與 rollup**——寫進去會被靜默丟成空 filter group(實測:`IN`、`CONTAINS`、rollup、relation `CONTAINS <page-id>` 全部落空;只有 relation `IS NOT EMPTY` 有效)。跨 database 的 formula 也被 API 以 `Type error with formula` 拒絕 | **這是去正規化欄位,會漂移。** 同步 repo 時必須一併更新。旁邊保留 `Parent Status` rollup 作為真值可對照。若要改回 spec 原意,在 Notion UI 手動把 filter 改成 rollup 條件即可(UI 支援,MCP 不支援) |
| **N-C2** | `Milestones.Status` 多一個 `⚠️ 達成 caveated` 選項(spec §3.3 只列三個) | §6.3 要求 M7 為 caveated 狀態,但 spec §3.3 的 enum 沒有這個值。壓成 `✅ 達成` 會犯 N-10 明文反對的錯誤(把帶保留的交付當作可直接引用的上游前提) | 命名用 `達成` 而非 `交付` 以對齊 Milestones 語彙;M7 的 `撤回原因` 欄同時填入 GD-14 caveat |
| **N-C3** | WP-30 / WP-31 / WP-32 的 `Repo` 指向 `active/stage4/README.md` | 這三個 WP 的資料夾**尚未存在**(stage4 目前只有 `wp-28-*` 與 `wp-29-*`) | 等資料夾建立後改指各自 `README.md`,否則是死連結 |
| **N-C4** | Open Questions 的 `提出日` 為推得值 | §6.4 已自陳「日期是推得的,不是逐條查證的」 | 若要精確,回各 `progress.md` 核對 |

### 10.4 一個必須記住的教訓 — repo 讀取請先 `git fetch`

第三次接手時本地分支 **落後 `origin/main` 4 個 commit**,導致一度誤判 §6.2 的 KI-005-A1 資料有錯(本地 checklist 只有 T0 ✅,§6 說 T0–T3 ✅)。
**§6 是對的,錯的是沒同步的工作區。** 那 4 個 commit 正好含 `feat(ki-005): meta.fovDeg / meta.mouseIntegration`(T2)與 `fix(ki-005): pointermove 入 ring 補 pointer-lock 閘`(T3)。
已 fast-forward 到 `0e29f70` 後修正 Notion 的 T1/T2/T3 Done box。

> **下次同步 Notion 前,先 `git fetch origin main` 再讀 checklist。** 否則會把陳舊狀態寫進看板。

### 10.5 資料完整性複核

建立過程中因 unicode escape 失誤,曾把 `閘` 寫成 `闘`(U+9598 → U+95D8)、`椎` 寫成 `椽`(U+690E → U+693D),共 10 處。**已全數修正並複核**:把 Notion 側所有 CJK 字元與 repo 全部 `*.md` 的字元集做差集,剩餘僅 `壁`/`拱`/`擱` 三字,分別來自本次新寫的欄位說明與 spec/HANDOFF 本身的用語(「隔壁」「拱心石」「擱最久」),非錯字。

### 10.6 未做的事(維持 §8 的紅線)

- 28 個已交付 WP(stage1/2/3/5 + muzzle-tracer)**未建** — 依 §2 使用者範圍指示,等看過骨架再說。
- 未建任何 sync script / front-matter / CI / webhook(spec §5.3 的 B 階段觸發條件尚未到)。
- Notion **未回寫 repo**,本次對 repo 的唯一改動就是這份 HANDOFF 的落地紀錄。
- 未做 timeline / gantt、未做 commit 動能圖、未把 GD-n / BD-n 搬進 Notion。

### 10.7 ⏰ 兩週後的硬條款(spec §5.3,使用者已明確接受)

**2026-08-20 前後複查:若使用者沒有真的用「🎯 今天」view 決定過當天要做什麼(不只是打開看過)→ 刪掉整個 Notion 工作台。**
留一個沒人看又不同步的看板比沒有更糟:它會讓人誤以為進度有被追蹤。**這條不要軟化。**
