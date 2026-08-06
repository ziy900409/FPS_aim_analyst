# KI-006 — M14 真實資料效度閘所用樣本不含 counter-strafe 構念

> 類型:研究效度 / 閘門設計缺陷。
> 狀態:🔴 **已確認,處置待拍板**(2026-08-06)。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-006。
>
> **與 [KI-004](KI-004-sim-world-unit-domain-mismatch.md) 的關係(重要)**:「08:03 匯出無鍵盤輸入 /
> 零位移」這個**原始事實**首見於 KI-004(其 §2 對照表已載明「08:03(**無**鍵盤輸入)」),當時是作為
> 排查 `meta.suspect` 反直覺行為的線索。KI-004 **未**就此事實對 M14 ④/⑤ 的**構念效度**作出結論。
> 本 KI 只處理那個未被追下去的結論,不重複 KI-004 的單位域診斷。

---

## 1. 症狀

M14 ④(真實資料分段成功率 + 疊圖)與 ⑤(`seg-v1` 參數凍結的真實資料佐證)所引用的唯一樣本
`counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json`,**通篇不含 counter-strafe 行為**:

| 檢驗 | 08:03(M14 引用) | 09:39(同日另一份) |
|---|---:|---:|
| tick 數 | 3,507 | 2,723 |
| `vx ≠ 0` 的 tick | **0** | 1,415 |
| `keys` 分布 | `[]` × 3,507(**全程未按任何鍵**) | `[]` 1,486 / `A` 617 / `D` 587 / `A,D` 33 |
| `counter` 事件 | **0** | **24** |
| `fire` / `visible` 事件 | 22 / 20 | 22 / 20 |

drill id 為 `counterstrafe_ad_v1`,但 08:03 那份實質上是**純 flick 資料**:受試者只用滑鼠瞄準與開火,
從未橫移、從未反向急停。

`counter` 事件的產生條件為「按下反向鍵 **且** 當下 `vx` 方向相反」([SimLoop.ts:76](../../src/loop/SimLoop.ts#L76))。
`vx ≡ 0` ⇒ 條件恆不成立 ⇒ 零事件。這是正確行為,不是記錄缺陷。

## 2. 為何這使 M14 ④/⑤ 的證據失效

`counterstrafe_ad_v1` 的研究構念是「**橫移 → 反向急停 → 停穩瞬間首發**」。與之綁定的量
——`t_counter`、`t_stop`、`residualSpeed`、首發時機、以及急停期間的視角修正行為——**在該樣本中
全部不存在或退化**。

因此:

- **M14 ④** 宣告的「20 peeks / 19 primary flick / 成功率 0.95 / 20 張疊圖人工檢核」,量到的是
  **靜止站樁下的純 flick**。分段器在「有橫移 + 急停 + 身體晃動疊加視角修正」的真實條件下表現如何,
  **從未被驗證**。
- **M14 ⑤** 據此保留 `seg-v1` 不調參的結論,同樣只有靜止站樁的佐證。
- 兩者的失效理由與 [KI-005](KI-005-omega-render-sim-aliasing.md) **相互獨立**:KI-005 是訊號被儀器
  假象汙染,本 KI 是**樣本裡根本沒有要驗的那個東西**。即使 KI-005 完全修好,以 08:03 重跑仍不構成
  counter-strafe drill 的效度證據。

## 3. 為何沒被更早抓到

1. **既有閘門全部不檢查「構念是否存在」**。`load_export` 驗 schema 與有限值、`check_dt` 驗 tick 均勻性、
   純度測試驗 `algorithms/` 無 I/O —— 沒有任何一關會問「這份 counter-strafe 匯出裡有 counter 嗎」。
2. **`meta.suspect = false` 給了錯誤的安心感**。而依 [KI-004](KI-004-sim-world-unit-domain-mismatch.md)
   的診斷,`suspect` 當時恰恰是**反的**:corridor gate 的單位域錯誤使「有做急停」的 09:39 被標 suspect、
   「完全不動」的 08:03 反而乾淨。挑樣本時的「乾淨」訊號因此**系統性地偏好了構念缺席的那一份**。
3. **人工檢核看的是波形合理性,不是行為內容**。20 張疊圖上的 ω burst 形狀確實合理 —— 站樁 flick
   本來就會產生漂亮的單峰。疊圖不顯示 `vx` 或 `keys`,檢核者無從察覺受試者沒在動。

## 4. 處置選項(待拍板)

### 選項 A — 改用 09:39 重跑並重新宣告 —— **❌ 已失效(2026-08-06)**

> **失效理由(邏輯後果,非獨立決策)**:[KI-005](KI-005-omega-render-sim-aliasing.md) 於 2026-08-06 拍板
> **不做過渡期選項 C**(不回溯清洗既有匯出),且選項 A 的修法改變的是「**記錄什麼**」——
> 09:39 檔案裡的 `ticks[].aim` 已把 beat 假象寫死,**未來也不會變乾淨**。
> 故本選項無法產出有效的 ω(t) 證據,自動出局。

`counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json` 含 1,415 個橫移 tick 與 24 個 `counter` 事件,
**構念完整**——這一點仍然成立,故該檔仍可用於**不依賴 ω 的**分析(counter 時序、`t_stop`、
`residualSpeed`、首發時機)。僅「作為 M14 ④/⑤ 分段效度樣本」這個用途出局。

### 選項 B — 重新採樣(**A 出局後的唯一路徑**)

KI-005 選項 A/B 落地後重新採集,並在採集前明確要求受試者執行完整 counter-strafe 動作。
同時取得未受 beat 汙染的 ω(t) 與(若 KI-005-B 落地)1000 Hz 原始滑鼠軌跡。

### 選項 C — 新增 construct presence gate(**結構性修補,建議無論 A/B 都做**)

在 `research/src/modules/ingest/` 增加一道**構念存在性檢查**:由 drill 宣告其核心構念,ingest 時斷言
該構念在資料中確實出現,否則產出明確的 session 級 flag(如 `construct_absent:counter`)。

初版可極簡:

| drill 家族 | 必要條件 |
|---|---|
| `counterstrafe_*` | `count(events.counter) > 0` 且 `count(ticks.vx ≠ 0) / len(ticks) > 下限` |
| `tracking_*` | 存在具足夠 `age` 的移動目標 |
| `detection_*` | `visible` 事件數 ≥ 宣告 peek 數 |

此閘若早存在,08:03 第一天就會被擋下。它補的是與 [KI-004 §「架構層結論」](KI-004-sim-world-unit-domain-mismatch.md)
同一類的缺口:**一致性閘與目視檢核無法發現「量錯了對象」**。

## 5. 影響面

| 對象 | 影響 |
|---|---|
| **M14 ④ / ⑤** | 真實資料效度證據**撤回**(獨立於 KI-005 的撤回理由) |
| **M14 ①**(ingest + dt 報告) | **維持**。ingest/dt 是 schema 與取樣層的檢核,與行為內容無關;3,507 ticks / gap 0 / uniform 仍是有效證據 |
| **M14 ②③⑥** | 不受本 KI 影響(② 已由 KI-004 撤回;③ 為合成 fixture;⑥ 為 pytest 綠燈) |
| [analysis-segments.md](../../docs/operational/analysis-segments.md) 的 “Real-export validation” 段 | 需加註:所述樣本不含 counter-strafe |
| **WP-30 / WP-31 entry** | blocker 維持(KI-004 / KI-005 已各有一條獨立理由,本 KI 為第三條) |
| 引擎程式碼 | **零影響**。本 KI 純屬樣本選取與閘門設計問題,`counter` 事件的記錄邏輯正確 |

## 6. 遺留 Open Questions

| OQ | 問題 | 待決者 |
|---|---|---|
| **OQ-KI6-1** | ~~採選項 A(換 09:39)、B(重採)或兩者併行~~ → **A 已於 2026-08-06 隨 [KI-005](KI-005-omega-render-sim-aliasing.md) 「不做選項 C」的拍板自動出局**(§4)。**剩 B(重新採樣)為唯一路徑**,待確認採集時機與規模(與 OQ-KI5-6 同一件事) | 使用者 |
| **OQ-KI6-2** | construct presence gate(選項 C)是否納入本輪,或另開 WP-28 追加 task | 使用者 |
| **OQ-KI6-3** | 構念存在性的量化門檻(如「橫移 tick 佔比下限」)如何 pre-register,避免事後調參 | 使用者 |
| **OQ-KI6-4** | M14 的真實資料項是否應要求 **n ≥ 2 個 session**,以免單一 session 的行為特異性再次成為單點故障 | 使用者 |
