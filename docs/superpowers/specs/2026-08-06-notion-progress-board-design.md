# 設計 — Notion 專案進度工作台

> 日期:2026-08-06 · 狀態:待實作(C 階段)
> 目的:把本 repo 的專案進度呈現在 Notion,作為**個人日常工作台**。
> 文件語言:繁體中文(術語保留英文,決策 D4)。

---

## 1. 問題陳述

進度資料目前散在六種載體:

| 載體 | 內容 | 位置 |
|---|---|---|
| WP 狀態表 + 里程碑門控 | M1–M15 gate 條件與紅綠燈 | [exec-plan/README.md](../../exec-plan/README.md) §2/§3 |
| 全域決策帳本 | GD-1~GD-20 | [DECISIONS.md](../../exec-plan/DECISIONS.md) |
| per-WP running log | Progress / Decision Log / Surprises / Open Questions | 各 `wp-N-*/progress.md` |
| task 勾選盤 | T0→Tn→T-exit 的 Done box | 各 `wp-N-*/task-checklist.md` |
| bug 帳本 | KI-001~006 + BD-n 決策 | [known_issue/](../../known_issue/) |
| git / GitHub | commit 與 PR | remote `ziy900409/FPS_aim_analyst` |

四個具體痛點(使用者確認):

1. **看不到「現在該做什麼」** — task 散在多個 `task-checklist.md`,要開好幾個檔才拼得出 next action。
2. **阻塞鏈跟不住** — WP-30/31 被 KI-005/KI-006 卡住這件事只存在散文裡,沒有結構。
3. **Open Questions 會掉** — 待拍板決策分散在各 `progress.md` 的 OQ 段,無單一佇列。
4. **看不到全局進度感** — 難以一眼看出哪場仗打得久。

### 1.1 專案特性(影響設計的關鍵事實)

- **進度非線性**:M14 曾宣告全綠(2026-08-05)後**分兩次撤回**(② 因 KI-004、③④⑤ 因 KI-005/KI-006),其中 ② 已於 2026-08-06 重新宣告。任何「進度百分比」式的呈現在此專案會說謊。
- **KI 已長成 WP 的形狀**:`KI-004-S1/`、`KI-005-A/`、`KI-006-C/` 皆含 `README.md` + `task-checklist.md` + `progress.md` + `T0→Tn→T-exit`,與 WP 結構同構。
- **當前實際工作幾乎全在 KI 上**:近 15 個 commit 有 11 個屬 ki-004/005/006。
- **repo 的進度資料是給人讀的散文**:`exec-plan/README.md` §2 的「狀態」欄是整段敘事,非結構化 enum。
- **WP 狀態現存三份**:`exec-plan/README.md` §2、各 WP `README.md`、`MAP.md` §3.2。

---

## 2. 決策

| # | 決策 | 理由 |
|---|---|---|
| **N-1** | **repo 為單一真相,Notion 為單向衍生看板** | 不違反 CLAUDE.md §5 記憶分層(episodic = `progress.md` + git);Notion 只讀不寫,永不腐化成第二份真相 |
| **N-2** | **先手動同步(C)驗證版面,兩週後再投資自動化(B)** | 尚未驗證看板是否真被日常使用;先建 sync script 很可能精心解析出無人看的欄位 |
| **N-3** | **只同步 active + 未結案 KI 到 task 層;`completed/` 只到 WP 一列** | 這是工作台不是檔案館。約 36 Work Items + 40 Tasks,視圖不溢出。歷史查詢走 GitHub |
| **N-4** | **WP 與 KI 放同一張表** | 兩者結構同構,且當前工作幾乎全在 KI;分表會讓「今天該做什麼」需同時看兩個看板——正是痛點 1 |
| **N-5** | **Milestones 獨立成表,含「撤回」欄位** | M14 的宣告→撤回→分項重新宣告歷史目前只活在一格表格散文裡,查不了也追不動 |
| **N-10** | **Work Items 需要 `⚠️ 交付 caveated` 狀態 + 必填「保留原因」** | 本專案的交付常帶已入帳的保留(M7 caveated、M13 待手動回填、M14 部分撤回)。把這類壓成 `✅` 會讓人誤用作上游前提;壓成 `🟡` 又會讓「沒人在動它」的事實消失 |
| **N-6** | **不做 timeline / gantt** | repo 內的日期全是**實際交付日**而非計畫日;甘特圖會憑空生出不存在的計畫基準線 |
| **N-7** | **不做 commit 動能圖** | GitHub insights 已有;搬進 Notion 只是多一個會壞的東西 |
| **N-8** | **不把 GD-n / BD-n 決策帳本搬進 Notion** | `DECISIONS.md` 與 `BUGFIX-DECISIONS.md` 已足夠好用;以連結指回 repo(YAGNI) |
| **N-9** | **建在 workspace 頂層新頁面** | 乾淨、易刪、易分享;不與既有「待辦事項和專案規劃」耦合 |

---

## 3. 資料模型

四張互相 relation 的 Notion database,置於頂層頁 `FPS Aim Analyst · 工作台` 之下。

### 3.1 `Work Items`

一列 = 一個 WP 或一個 KI。

| 欄位 | 型別 | 說明 |
|---|---|---|
| Name | Title | `WP-28 research-foundation` / `KI-005-A ω aliasing` |
| Type | Select | `WP` / `KI` |
| Stage | Select | `stage1`…`stage5` / `muzzle-tracer` / `known-issue` |
| Status | Select | `⬜ 未開` / `🟡 進行中` / `⚠️ 交付 caveated` / `✅ 完成` / `🔴 阻塞` / `🗄 歸檔` |
| 保留原因 | Text | **僅 `⚠️` 時必填**;不填則此狀態退化成無內容的標籤 |
| Milestone | Relation → Milestones | 可空(非每個 WP 都掛里程碑) |
| Blocked by | Relation → Work Items(self) | 例:WP-30 ← KI-005, KI-006 |
| Repo | URL | 指向 GitHub blob 的 `README.md` |
| 交付日 | Date | 實際交付日,未交付留空 |
| 估時 | Text | 沿用 repo 的 `3.5–4.5` 字串,不轉數字 |

**`⚠️ 交付 caveated` 的判準**:自動閘已綠、切片已 commit,但存在**已知且已入帳**的保留——手動閘未回填、外部真值仍為 caveat、或下游里程碑因該 WP 的產出被撤回。它與 `🟡 進行中` 的差別是「沒有人正在動它」,與 `✅ 完成` 的差別是「不能拿它當上游前提而不讀保留原因」。

初始回填時套用此狀態者:

| WP | 保留原因 |
|---|---|
| WP-15 | M7 caveated:速度曲線為 theory surrogate 對表而非 `cl_showpos` 實錄;外部實錄行為級真值仍為 caveat(GD-14) |
| WP-26 | 自動閘 E-1~E-10 + `test:ci` exit 0 全綠;清單 E §2 手動視覺/手感回填為 M13 阻塞項,待研究者實機(#32) |
| WP-28 | task 全數完成(2026-08-05);M14 ①⑥ 維持、② 已於 KI-004 S1 落地後重新宣告(2026-08-06)、③④⑤ 因 KI-005/KI-006 撤回且兩者尚未落地 |

### 3.2 `Tasks`

一列 = 一個 `T0` / `Tn` / `T-exit`。

| 欄位 | 型別 | 說明 |
|---|---|---|
| Name | Title | `T3 SG + submovement 分段` |
| Done | Checkbox | 對應 `task-checklist.md` 的 Done box |
| Parent | Relation → Work Items | |
| Kind | Select | `entry-gate` / `task` / `exit-gate` |
| Repo | URL | 指向該 task 檔 |

### 3.3 `Milestones`

一列 = M1–M15 其中一個。

| 欄位 | 型別 | 說明 |
|---|---|---|
| Name | Title | `M14 research 地基` |
| Status | Select | `⬜ 未達` / `🟡 部分` / `✅ 達成` |
| 完成條件 | Text | 摘要,細節連回 repo |
| 宣告日 | Date | |
| 撤回日 | Date | 可空 |
| 撤回原因 | Text | 例:`② 因 KI-004 ε(t) 量測原點錯誤;③④⑤ 因 KI-005/KI-006` |
| Work Items | Relation → Work Items | |

### 3.4 `Open Questions`

一列 = 一個待拍板決策。

| 欄位 | 型別 | 說明 |
|---|---|---|
| Name | Title | `OQ-S4-6 …` |
| 狀態 | Select | `待拍板` / `已關閉` |
| 來源 | Relation → Work Items | |
| 提出日 | Date | |
| Repo | URL | 指向該 `progress.md` |

---

## 4. 版面(views)

主頁 `FPS Aim Analyst · 工作台` 內嵌五個 linked view,全部由上述四表過濾而來,**不重複存資料**。

| View | 資料來源與過濾 | 解掉的痛點 |
|---|---|---|
| 🎯 **今天** | Tasks:`Done = false` 且 `Parent.Status ∈ {🟡 進行中, ⚠️ 交付 caveated}`;group by Parent,依 task 編號排序 | 1 |
| 🚧 **阻塞鏈** | Work Items:`Blocked by` 非空;顯示 `Blocked by` 欄 | 2 |
| ❓ **待拍板** | Open Questions:`狀態 = 待拍板`;**依提出日最舊排最前** | 3 |
| 🚩 **里程碑** | Milestones board by Status;只顯示未結案(M13 / M14 / M15) | 撤回歷史可追 |
| 🗺 **全局** | Work Items board,group by Stage;每欄顯示 ✅ / 總數 | 4 |

「待拍板」刻意用**最舊優先**而非最新優先:會掉的 OQ 正是那些擱最久的。

---

## 5. C 階段執行計畫

### 5.1 首次建立(一次性)

1. 建頂層頁 `FPS Aim Analyst · 工作台`。
2. 建四張 database(§3 schema)。
3. 回填 Work Items:
   - **含 task 層**:`active/stage4` 的 WP-28~32、`known_issue/` 的 KI-004-S1 / KI-005-A / KI-006-C。
   - **僅 WP 一列(靜態,建完不再更新)**:stage1(WP-0~9)、stage2(WP-10~18)、stage3(WP-19~22)、stage5(WP-23~26)、muzzle-tracer(WP-27)。
4. 回填 Milestones:M1–M15,其中 M13 / M14 / M15 填完整的宣告/撤回欄位。
5. 回填 Blocked by:WP-30 ← KI-005-A, KI-006-C;WP-31 ← KI-005-A, KI-006-C;WP-32 ← WP-30。
6. 掃各 `progress.md` 的 Open Questions 段,建初始 OQ 佇列。
7. 建五個 linked view。

預估規模:約 36 個 Work Item、40 個 Task。

### 5.2 日常更新

使用者說「同步 Notion」→ 讀 repo 自上次同步以來的變動,更新受影響的列。無排程、無自動觸發。

### 5.3 轉 B 的判準(兩週後,即 2026-08-20 前後)

- **若使用者實際用「🎯 今天」view 決定過當天要做什麼**(不只是打開看過)→ 投資 B:
  - 在各 `wp-N-*/task-checklist.md` 與 `KI-NNN-*/README.md` 加 YAML front-matter(`status` / `milestone` / `blocked_by` / `delivered_at`),散文正文不動。
  - 在 CLAUDE.md §3 執行協議加一條:翻 Done box 時同步 front-matter。
  - 寫 `scripts/notion-sync.ts`,只讀 front-matter 與 checklist 的 `- [x]`,不解析散文表格。
  - 附帶收益:把「WP 狀態散在三處」收斂成單一來源。
- **若否** → **刪除整個 Notion 工作台**。留一個沒人看又不同步的看板比沒有更糟:它會讓人誤以為進度有被追蹤。

---

## 6. 明確不做的事

- 不做 timeline / gantt(N-6)。
- 不做 commit 動能圖(N-7)。
- 不把 GD-n / BD-n 搬進 Notion(N-8)。
- 不同步 `completed/` 的 task 層(N-3)。
- Notion 不回寫 repo,任何方向皆然(N-1)。
- C 階段不寫任何程式碼——不建 script、不設 CI、不接 webhook。
