# 階段 L（stage12）— progress.md

> 階段索引：[README.md](README.md) · Task 狀態：[task-checklist.md](task-checklist.md)
>
> 本檔只記 **階段層** 的進度與跨 WP 決策；WP 內部的執行細節記在各 WP 自己的 `progress.md`。

## Progress

- **2026-09-04**：stage12 以 WP-56（micro-flick 三靶測試場景）開張；T0／T1 完成。
- **2026-09-07**：WP-56 T2～T4 完成（三靶 lifecycle、走廊場景與呈現、固定玩家命中與 HUD）；T5～T6 未開始。
- **2026-09-07**：**WP-57 — Spider Shot Wide Flick** 規劃完成（平行 session 產出），T0 未開始。
- **2026-09-07**：使用者提出 Session Plan 排程需求（選 drill／設次數／drill 間休息／家族間休息）。經 brainstorming 收斂後以 engineering-planning skill 產出 **WP-58 — Session Program Scheduler** 執行計畫，結構參照 [WP-50](../stage10/wp-50-3d-state-replay/README.md)。
- **2026-09-07**：建立 stage12 階段層文件（本檔 + [README.md](README.md) + [task-checklist.md](task-checklist.md)）；此前 stage12 只有 WP 資料夾、沒有階段層索引（stage10／stage11 皆有）。

## Decision Log

- **D-S12-1 / WP 編號**：session program 排程器取用 **WP-58**、全域決策取用 **GD-33**。WP-57（spider shot wide flick）與它在同日兩個平行 session 中規劃、一度都暫用 WP-57／GD-32；WP-57 資料夾先建立，依 [GD-15](../../DECISIONS.md)「先採納先得」保留原編號，排程器順延重編。WP-56 為進行中的 micro-flick 場景 WP，兩份新計畫皆不得覆寫。
- **D-S12-2 / 三 WP 關係**：WP-56、WP-57、WP-58 互不硬相依、可並行。WP-58 會把 stage12 產出的新 drill 登記為可排程，但依 FR-58.3 不授予其 Assessment 資格，WP-56／WP-57 的 practice-only 定位不變。
- **D-S12-3 / 里程碑**：stage12 暫不指派里程碑，三個 WP 各以 T-exit gate 為交付判定。下一個可用編號為 **M22**（M20／M21 已由 stage11 的 WP-54／WP-55 取用）。

## Surprises

- **2026-09-07**：兩個平行 session 在同一小時內各自規劃一個新 WP，兩份都暫用 WP-57／GD-32。GD-15 的「先採納先得」原本是為跨 stage 的編號競用寫的，這次證明它同樣適用於同日同 stage 的平行規劃；但也暴露出**暫用編號在寫入 DECISIONS.md 前無任何互斥機制**，撞號只能靠事後對帳發現。

## Open Items

- **OI-S12-1**：`docs/exec-plan/README.md` §2 尚無 stage12 段落與 WP-56／WP-57／WP-58 狀態列。**Owner 待定**——WP-56 的狀態敘述應由其執行者填寫，本計畫不代為宣告。列入各 WP 的 T-exit DoD。
- **OI-S12-2**：stage12 里程碑歸屬待 owner 決定（D-S12-3）。
- **OI-S12-3**：WP-57 的 GD-32 與 WP-58 的 GD-33 皆尚未寫入 [DECISIONS.md](../../DECISIONS.md)（各自 T0 的 DoD 項目）。**兩者需交叉確認編號不重複**。
- **OI-S12-4**：若 WP-57 的 `spider_shot_wide_flick_*` drill id 在 WP-58 T1 之後才定案，需回頭同步 WP-58 的 drill→family 對照表。
