# WP-29 — Progress / Decision Log / Surprises / Open Questions

> Running log。Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)
> 寫入時機:每個 task 完成時與切片一起 stage(exec-plan/README.md §5)。

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ⬜ | — | — |
| T1 逐 peek 時間軸 + 交叉驗證 | ⬜ | — | — |
| T2 Sync 族 + 精度判定 | ⬜ | — | — |
| T3 additive key 事件(gated) | ⬜ gated | — | 觸發條件 = T2 判定 `insufficient` |
| T-exit 教練報告 v0 | ⬜ | — | — |

---

## 進場事實(2026-08-05 規劃期讀資料;非 task 產出,供 T0 引用)

上游:WP-28 T1 ✅(2026-08-04,ingest/`check_dt`/合成產生器)· M14 ✅(2026-08-05,六項全綠)· 目前無其他 active WP,零檔案熱區競爭。

**唯一真實匯出** `research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json` 的實測欄位分布:

| 項目 | 值 |
|---|---|
| ticks | 3,507(27.390625s、median dt 7.8125ms、gap 0) |
| events | `fire` 22(其中 `firstShot` 20、`hit=true` 20)、`visible` 20(L10/R10);**`counter` 0、`ads` 0、`hit` 事件 0** |
| `ticks[].keys` | 3,507 tick 全為 `[]`,鍵狀態轉換 **0 次** |
| `ticks[].vx` | 恆 `0`(全程無 strafe) |
| `meta.weapon` | `{id: ak47, ads:{fovDeg:40, sensitivityRatio:1}}`,**無 `bullet`** → hitscan 路徑 |
| peek 面 | visible 間隔中位數 500 ms;首發延遲(`t_first_shot − t_visible`)中位數 ≈ 482 ms;`firstShotHitRate` = 100 |

**判讀**:這份匯出是**純瞄準 run**,不是 counter-strafe 行為樣本(drill id 叫 `counterstrafe_ad_v1` 只反映 drill config)。因此:

1. `counterReactionMs` / `fireTimingAlignmentMs` 在真實資料上 **n = 0** → FR-D8 對表若只跑真實 fixture 會**假綠**(T1 反 vacuous 條款的由來)。
2. `t_release` 在真實資料上**不可量測**(無鍵轉換)→ Sync 族三指標 n = 0 → T2 精度判定預期落 `blocked-by-data`(T0 必須先凍結此分支)。
3. `t_hit` 只有 hitscan 路徑有真實證據;projectile / `shotSeq` 關聯與跨窗命中只能靠合成 fixture 驗證。

---

## Decision Log

> 格式沿用 WP-28:`D-29.n | 決策 | 理由(含 Alternatives Considered) | 證據`。跨 WP/跨文件者改寫 [DECISIONS.md](../../../DECISIONS.md)。

| # | 決策 | 理由 | 證據 |
|---|---|---|---|
| — | (待 T0 填入:`compute.ts` 對表基準凍結、`SyncParams` = `sync-v1` 凍結) | | |

---

## Surprises

| # | 意外 | 影響 | 處置 |
|---|---|---|---|
| S-29.0 | 規劃期發現唯一真實匯出零位移、零 `counter` 事件、鍵狀態全程未變 | WP-29 兩個核心錨點(t_counter/t_release)在真實資料上無樣本;交叉驗證有假綠風險 | 寫入 [README §0](README.md) 並轉成三項機制:T1 反 vacuous 斷言、T2 `blocked-by-data` 分支、OQ-S4-9 補樣本需求 |

---

## Open Questions

| # | 問題 | 現況 | Owner | Deadline |
|---|---|---|---|---|
| OQ-S4-9 | 缺「含真實 A/D strafe」的 counter-strafe 匯出 | 🟡 open;不阻塞 T1/T2 演算法(合成 fixture 可驗),但阻塞 Sync 族真實效度與 T3 觸發 | 使用者 / 研究者 | T2 精度評估前 |
| OQ-S4-10 | `t_release` 無 counter 事件時的 fallback 是否可跨 peek 比較 | 🟡 open;先落 fallback + `release_inferred_no_counter` flag,聚合預設排除 | 研究者 | WP-29 T-exit |
| OQ-S4-6 | 教練報告載體(既有) | 🟡 open;本 WP T-exit 落靜態單檔 HTML 後關閉 | 使用者 | WP-29 T-exit |
