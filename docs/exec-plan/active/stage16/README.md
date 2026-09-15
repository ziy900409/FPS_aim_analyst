# Stage 16 — 條件失效的效力單位與恢復

> 上層索引：[`docs/exec-plan/README.md`](../../README.md) · 全域決策：`GD-47`（預約，WP-70 T0 重查）
> 來源：[KI-040](../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)

本 stage 處理 [stage15](../stage15/README.md)（WP-69，attempt 級 pause/restart）交付後，**在實際操作中
才暴露出來**的一個不對稱：WP-69 讓 Pointer Lock 遺失成為 attempt 級、可由 restart 復原的失效，但
fullscreen 退出仍是 session 級、**沒有任何復原路徑**的失效。一次 `Esc` 同時觸發兩者，操作員因此
卡在「怎麼按重新測試都無效」的狀態。

Stage 15 解的是「暫停後這一輪還能不能被採納」；本 stage 解的是「**失效到底附著在什麼單位上**」，
以及「條件壞掉之後有沒有路走回來」。

| WP | 目標 | 相依 | 估時 | 狀態 |
|---|---|---|---:|---|
| **WP-70** | [`wp-70-run-scoped-condition-validity/`](wp-70-run-scoped-condition-validity/README.md)：`meta.suspect` 的 fullscreen 成分改為 run 級（與已是 run 級的 perf 成分對齊）；protocol 路徑補上錄製窗判準；橫幅改由真值驅動；新增不重啟 plan 的恢復條件入口 | WP-69 ✅ | 6–9.5 d | 🟡 **T0 ✅（2026-09-15）**，T1 未開工 |

本 stage 暫無獨立 milestone；WP-70 的 `T-exit` 即交付判定。編號依
[GD-15](../../DECISIONS.md)「正式進 §2 索引才算採納」取得；
✅ **WP-70 / GD-47 已於 T0（2026-09-15）重查確認可用**（本案以外最大採納 WP-69、`DECISIONS.md` 最大 GD-46、`### GD-47 ` 零命中）；
stage14 的未採納候選依「先採納先得」已順延為 `WP-71`／`WP-72`／`WP-73`。

## Stage 級不變式

1. 效力單位是**單次 run**：一個 run 的條件中斷不得污染另一個 run。
2. 同一個構念只有一套判準：錄製窗（KI-007）在 session plan 與 protocol 兩條路徑上必須是同一個值（C-D4）。
3. 恢復條件**不等於**恢復資料：恢復入口讓操作員回到全螢幕並 restart 本項，已中斷的那一次不會變有效
   （WP-69 的 disposition 語意不變）。
4. 放寬與收緊必須分別記帳：本 stage 對跨 run 放寬、對 protocol 路徑收緊，兩個方向都要有證據。
5. 不改 KI-007 的錄製窗**定義**、不改 eligibility gate 的**門檻**、不碰 sim。
