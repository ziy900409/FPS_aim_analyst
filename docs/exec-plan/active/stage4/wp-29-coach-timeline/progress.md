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

## 進場事實(2026-08-05 規劃期;非 task 產出,供 T0 引用)

上游:WP-28 T1 ✅(2026-08-04,ingest/`check_dt`/合成產生器)· M14 ✅(2026-08-05,六項全綠)· 目前無其他 active WP,零檔案熱區競爭。

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
| `firstShotHitRate` | 100 | 90 |
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
- **WP-30/31 受影響**(ε(t) 系列),須等 KI-004 拍板 —— 這是本 WP 之外的相依,已記入 KI-004 §3。

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
| S-29.0 | 規劃期發現當時唯一的真實匯出零位移、零 `counter` 事件、鍵狀態全程未變 | WP-29 兩個核心錨點在真實資料上無樣本;交叉驗證有假綠風險 | 已解:排查證實為「該次 run 無鍵盤輸入」,補錄 09:39 後三個對表量各 n=20。反 vacuous 斷言**保留為紀律**(見 T1 DoD ②),不因樣本到位而放寬 |
| S-29.1 | 排查 S-29.0 時,重現用的 09:39 匯出帶 `meta.suspect = true`,追出 **sim(source unit)/ world domain 混用** | corridor gate 緊 100× → 任何真實急停 run 皆被標 suspect;離線 ε(t) 的 `p_eye` 原點錯尺度 → WP-30/31 全部逐段指標受影響 | 開 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) + [BD-004](../../../../known_issue/BUGFIX-DECISIONS.md);WP-29 本身不受影響(不碰 `px/pz`),但 T0 須記使用界線 |
| S-29.2 | ε parity(M14 ②)**無法**捕捉 S-29.1:Python 忠實移植了 TS 的錯誤原點,兩側同錯故 ≤1e-9 恆綠 | 暴露 C-D4「TS 為既有構念權威」的固有盲區 —— 對表保證一致,不保證構念正確 | 記入 KI-004 §4;stage4 若要防同類問題,需要的是**已知答案的幾何 fixture**(而非對表),此需求已在 WP-28 T2 存在但未涵蓋「玩家橫移 + 固定目標」交叉情境 |

---

## Open Questions

| # | 問題 | 現況 | Owner | Deadline |
|---|---|---|---|---|
| ~~OQ-S4-9~~ | ~~缺「含真實 A/D strafe」的 counter-strafe 匯出~~ | ✅ **關閉(2026-08-05)**:09:39 已補錄並進 `research/fixtures/exports/`(21.27s、`P001`、PII-like 掃描無命中) | 使用者 | 2026-08-05 |
| OQ-S4-10 | `t_release` 無 counter 事件時的 fallback 是否可跨 peek 比較 | 🟡 open;先落 fallback + `release_inferred_no_counter` flag,聚合預設排除 | 研究者 | WP-29 T-exit |
| OQ-S4-11 | 兩份真實 fixture 皆無 `ads` 事件、皆為 hitscan → 條件分層無真實對照 | 🟡 open;`--group-by` 仍實作,以合成 fixture 驗證 | 研究者 | WP-29 T-exit |
| OQ-S4-6 | 教練報告載體(既有) | 🟡 open;本 WP T-exit 落靜態單檔 HTML 後關閉 | 使用者 | WP-29 T-exit |
| (外部) | KI-004 修法拍板(先決 = OQ-KI4-1 正規單位域) | 🔴 待拍板;**不阻塞 WP-29**,阻塞 WP-30/31 | 使用者 / 研究者 | WP-30 T0 前 |
