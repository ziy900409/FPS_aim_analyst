# WP-66 — Progress

> Tech spec：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md)
>
> 每個 task 完成時更新本檔（Progress / Decision Log / Surprises / Open Questions），與程式切片一起 stage（協議 §3.4）。

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 | ⬜ 未開始 | — | — |
| T1 | ⬜ 未開始 | — | — |
| T2 | ⬜ 未開始 | — | — |
| T3 | ⬜ 未開始 | — | — |
| T4 | ⬜ 未開始 | — | — |
| T5 | ⬜ 未開始 | — | — |
| T-exit | ⬜ 未開始 | — | — |

---

## Decision Log

### 規劃期（2026-09-11）

| # | 決策 | 理由 |
|---|---|---|
| **D-66-P1** | 命中訊號走**獨立環形格** `targetHits`，不加在 `TargetState` | `TargetState` 是 sim 契約（44 callers）；render-only 訊號放進去會讓後續讀者以為它有 sim 語意。承 WP-25 `shotRays` 先例（README §2.3） |
| **D-66-P2** | 環形格**不帶時間戳** | 消除 sim clock ↔ wall clock 相減的結構性陷阱；render 的衰減一律以 rAF `now` 起算（README §2.2） |
| **D-66-P3** | 逐 mesh **material clone**，不用「換一顆 material」 | clone 的型別/defines 相同 ⇒ 同 WebGPU pipeline，執行期只改 uniform，避免首次命中才編 pipeline 的一次性卡頓（FM-6） |
| **D-66-P4** | 命中態以 `emissive` 呈現，不換 `color` | `MeshStandardMaterial.emissive` 預設即 `0x000000` ⇒ 未啟用時逐位不變；且保留目標原色身分（OQ-66.3） |
| **D-66-P5** | 啟用清單**逐字列名**，預設排除 `hold_track_v1` | 該 drill 屬 stage6 `protocolVersion = 1.0.0` 凍結範圍（GD-23）；改視覺＝改協定，需另開升版切片（OQ-66.1 / 風險 §3.1-2） |
| **D-66-P6** | `HIT_FEEDBACK_HOLD_MS` 預設 120 ms | 使用者語意為「命中才亮、沒中不亮」；tracking pilot 射速 ≈10 Hz（100 ms 間隔）⇒ 120 ms 使連續命中呈連續亮起、一次未命中在 ≤120 ms 內熄滅，最貼合該語意且不閃爍（OQ-66.2） |
| **D-66-P7** | GD-42 **本體於 T-exit 入帳**，規劃期只留草稿 | 承 [WP-63](../wp-63-micro-flick-v8-measurement-foundation/README.md) D-63-P6 先例：啟用清單與斷代日期要等 T0/T4 落地才有東西可入帳 |

### GD-42 草稿（本體 T-exit 入帳）

| # | 草稿內容 |
|---|---|
| **D-66-1** | 命中回饋走獨立環形格（`targetHits`），不放 `TargetState` |
| **D-66-2** | 環形格不帶時間戳，衰減一律以 render 的 rAF `now` 起算 |
| **D-66-3** | 回饋為 `DrillConfig.targets.hitFeedback?`，省略＝逐位不變且不寫 metadata |
| **D-66-4** | 啟用清單逐一列名（待 T0/T4 填入實際清單），排除已凍結的 assessment 協定；啟用即構成**效度斷代**，由 `meta.targets.hitFeedback` 逐 run 自述 |
| **D-66-5** | projectile 條件的回饋延遲（飛行時間）為已知且已接受的條件差異——使用者 2026-09-11 決定 |
| **D-66-6** | replay **先不同步**（使用者 2026-09-11 決定）；觸發補齊的條件 = replay 被用於向受試者回放 |

---

## Surprises

*（執行中填寫：與規劃假設不符的實況、讀碼後才發現的前提、被推翻的估算。）*

規劃期已知的待驗證前提：

1. **假設 #3**：`src/drill/schema.ts` 疑似以白名單重組 config 物件 ⇒ 未加入驗證的新欄位會被**靜默丟棄**而非報錯。若屬實，T3 必須同時改 type 與 schema。**T0 須讀碼確認。**
2. **WP-65 的 e2e arm helper 已於規劃期間落版本庫**：規劃開始時 `tests/e2e/support/` 尚為 untracked，撰寫本計畫期間由 WP-65 收尾 commit（HEAD 為 `692ce6a`，`tests/e2e/support/arm.ts` 已在版本庫）。T5 的新 spec 可直接沿用該 helper；**仍須於 T5 開工時確認路徑未改**。

---

## Open Questions

| OQ | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-66.1** | 哪些 drill 啟用命中回饋？（預設：`tracking_br_v1` 八 variant + WP-64 兩個 Tracking Pilot config，排除 `hold_track_v1`） | ⬜ 待 T0 收斂 | 使用者 | T0 |
| **OQ-66.2** | `HIT_FEEDBACK_HOLD_MS` 取值（預設 120 ms） | ⬜ 待 T0 收斂 | 使用者 | T0 |
| **OQ-66.3** | 命中態以 `emissive` 呈現（預設是） | ✅ 規劃期已定（D-66-P4） | 規劃者 | — |
| **OQ-66.4** | 是否需要 `meta` 層級的效度斷代版本標記（預設否；該工作屬 WP-65 T-exit 交接的獨立 WP） | ⬜ 待 T0 收斂 | 使用者 | T0 |
| **OQ-66.5** | replay 何時補上命中回饋？（技術債 §3.2；觸發條件 = replay 被用於**向受試者**回放而非研究者檢視） | ⬜ 開放（非阻塞） | 使用者 | 本 WP 之後 |
