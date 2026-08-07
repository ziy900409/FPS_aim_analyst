# KI-006 — M14 真實資料效度閘所用樣本不含 counter-strafe 構念

> 類型:研究效度 / 閘門設計缺陷。
> 狀態:✅ **CLOSED(2026-08-07)**。**C(construct presence gate)已落地**(2026-08-06 計畫拍板、2026-08-07 [KI-006-C/](KI-006-C/README.md) T0–T3 落地);**B(重新採樣)已完成**([A2-T1](KI-005-A/A2-blocked-plan.md),三個 counter-strafe session,§6 B-1~B-5 驗收清單全數滿足,見 [A2-T4 判定](KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07))。**M14 ④⑤ 已隨 A2-T4 重新宣告**。
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

### 選項 B — 重新採樣(**A 出局後的唯一路徑**)✅ **已完成(2026-08-07)**

KI-005 選項 A 落地後重新採集,並在採集前明確要求受試者執行完整 counter-strafe 動作。
同時取得未受 beat 汙染的 ω(t)(1000 Hz 原始滑鼠軌跡選項 B 部分延後,見 [KI-005 §6.1 OQ-KI5-2](KI-005-omega-render-sim-aliasing.md))。

> **執行結果**:[KI-005-A / A2-T1](KI-005-A/A2-blocked-plan.md) 於同一台 240 Hz 機器實際採集 3 個 `counterstrafe_ad_v1` session(09:18/09:24/09:37,2026-08-07)。[KI-006-C/README.md §6](KI-006-C/README.md) B-1~B-5 驗收清單逐項核對全數滿足(B-1「採集前明確要求」由採集者本人於 A2-T4 覆核時確認,記入 [KI-005-A/progress.md A2-S5](KI-005-A/progress.md))。**選項 B 完成 ⇒ 本 KI 的撤回理由解除,M14 ④⑤ 隨 [A2-T4](KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 重新宣告**。

### 選項 C — 新增 construct presence gate(**結構性修補,建議無論 A/B 都做**)✅ **已落地(2026-08-07)**

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

> **選項 C 的可執行計畫**:[KI-006-C/](KI-006-C/README.md)(tech spec + T0–T3 + T-exit;task 索引
> [task-checklist.md](KI-006-C/task-checklist.md))。**尚未動任何程式碼。** 2026-08-06 拍板三項設計取捨:
> ① 構念宣告落 **Python registry**(`research/src/modules/ingest/algorithms/construct.py`,凍結為
> `construct-v1`),**不**做引擎 `DrillConfig` / `meta.construct` 自我描述欄 —— 換取零引擎改動,且閘
> **可回溯套用到既有匯出**(最需要被擋下的正是既有的 08:03);② 閘紅 = session 級 flag +
> `run_pipeline` 專屬非零 exit code,**不**在 `load_export` 拋錯 —— 資料仍可載入診斷,受限的是**用途**
> (C-D3);③ **選項 B(重新採樣)不在該計畫內**,委派 [KI-005-A / A2-T1](KI-005-A/A2-blocked-plan.md)
> (兩個 KI 的採集已收斂為同一次),該計畫只交付 A2 直接引用的驗收清單(其 §6 B-1~B-5)。
>
> 計畫階段查碼另發現兩件事:① committed 合成 fixture 的 `drillId` 是 `synthetic_counterstrafe_v2`,
> **不以 `counterstrafe` 開頭** —— 天真的前綴比對會讓閘在 `run_pipeline` 的預設路徑上失效且測試仍綠;
> ② 上表三個家族中,`tracking_*`(目標 motion)與 `detection_*`(宣告 peek 數)的判準值**不在 `meta` 內**
> ⇒ 本輪只實作 `counterstrafe_*`,另兩家族誠實回 `construct_unknown`(而非靜默通過)。
>
> ⚠️ **C 落地不解除任何 M14 撤回** —— 它單獨交付的是「下次不會再量錯對象」,不是「這次量對了」。**M14 ④⑤ 的解除須待 B(重新採樣)一併完成,見下方 §5/§6 —— B 已於 2026-08-07 隨 [A2-T1](KI-005-A/A2-blocked-plan.md) 完成,兩者合計已解除本 KI 的撤回理由**。

## 5. 影響面

| 對象 | 影響 |
|---|---|
| **M14 ④ / ⑤** | 原**撤回**(獨立於 KI-005 的撤回理由);**已於 [A2-T4](KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07)(2026-08-07)隨本 KI CLOSED 重新宣告** |
| **M14 ①**(ingest + dt 報告) | **維持**。ingest/dt 是 schema 與取樣層的檢核,與行為內容無關;3,507 ticks / gap 0 / uniform 仍是有效證據 |
| **M14 ②③⑥** | 不受本 KI 影響(② 已由 KI-004/S1 恢復;③ 已由 A2-T4 恢復;⑥ 為 pytest 綠燈) |
| [analysis-segments.md](../../docs/operational/analysis-segments.md) 的 “Real-export validation” 段 | 已加註:所述樣本(08:03/09:39)不含 counter-strafe;A2-T1 三份新匯出構念存在 |
| **WP-30 / WP-31 entry** | 原 blocker 維持(KI-004 / KI-005 已各有一條獨立理由,本 KI 為第三條);**三條理由已於 A2-T4(2026-08-07)全數解除,entry blocker 已解除** |
| 引擎程式碼 | **零影響**。本 KI 純屬樣本選取與閘門設計問題,`counter` 事件的記錄邏輯正確 |

## 6. 遺留 Open Questions

| OQ | 問題 | 待決者 |
|---|---|---|
| ~~**OQ-KI6-1**~~ | ~~採選項 A(換 09:39)、B(重採)或兩者併行~~ → **A 已於 2026-08-06 隨 [KI-005](KI-005-omega-render-sim-aliasing.md) 「不做選項 C」的拍板自動出局**(§4)。**剩 B(重新採樣)為唯一路徑**。 | ✅ **關閉(2026-08-07)**:B 已隨 [A2-T1](KI-005-A/A2-blocked-plan.md) 完成(3 個 session,09:18/09:24/09:37),[KI-006-C/README.md §6](KI-006-C/README.md) B-1~B-5 驗收清單經 [A2-T4](KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 逐項核對全數滿足。KI-006 **CLOSED** |
| ~~**OQ-KI6-2**~~ | ~~construct presence gate(選項 C)是否納入本輪,或另開 WP-28 追加 task~~ | ✅ **關閉(2026-08-06)**:納入本輪,計畫見 [KI-006-C/](KI-006-C/README.md)(T0–T3 已落地 2026-08-07) |
| ~~**OQ-KI6-3**~~ | ~~構念存在性的量化門檻(如「橫移 tick 佔比下限」)如何 pre-register,避免事後調參~~ | ✅ **關閉(2026-08-07)**:以 `construct-v1` 凍結(`min_counter_events=1`、`min_moving_tick_ratio=0.05`);pre-register 證據(四份 fixture 實測、門檻落在數量級空隙)見 [KI-006-C/README.md §2.3](KI-006-C/README.md) |
| ~~**OQ-KI6-4**~~ | ~~M14 的真實資料項是否應要求 **n ≥ 2 個 session**,以免單一 session 的行為特異性再次成為單點故障~~ | ✅ **關閉(2026-08-07)**:**n > 2**(至少 3 個 session),嚴於原建議的 n ≥ 2。見 [KI-006-C/README.md §6 B-4](KI-006-C/README.md) |
