# T6 — 文件 / 帳本對帳 + M14 解除條件明文化

> 交付 **FR-A-13 / FR-A-14** · 上游:[A README §6](README.md) · 依賴:**T5 已 commit**。
> 性質:**零程式碼改動**。本 task 的產出是「下一個人打開文件時看到的是真的」。

**In scope**:`docs/operational/analysis-segments.md` · `docs/operational/schema.md` · `docs/known_issue/KI-005-*.md` · `docs/known_issue/BUGFIX-DECISIONS.md` · `docs/MAP.md` · `docs/exec-plan/README.md`。
**Out of scope**:**M14 ③④⑤ 的重新宣告**(需 A2 的新採樣,且 ④⑤ 另被 KI-006 擋住)· `seg-v2` 參數註冊(A2-T3)。

---

## ⚠️ 本 task 最容易犯的錯

把「儀器修好了」寫成「效度恢復了」。

A1 交付的是**量測儀器的正確性**;M14 ③④⑤ 的撤回理由是**證據力**,而證據力只能由**修法後的新匯出**恢復(KI-005 §7.4 已於 2026-08-06 更正:重跑舊匯出不可能讓寫死在檔案裡的假象變乾淨)。更何況 M14 ④⑤ 還被 [KI-006](../KI-006-m14-sample-no-counterstrafe.md) 以**完全獨立**的理由擋著(樣本無 counter-strafe 構念)。

本 task 只寫**解除條件**,不寫解除。

---

## Steps

### 1. `analysis-segments.md` —— ω 的唯一定義(C-5 / C-D4)

- [ ] 在 §Segment definition 的 `omega_deg_s` 段落改寫:
  - `omega_deg_s` 現回傳 `OmegaResult`(`values` + `source`)。
  - 兩個 source 的語意:`tick-integral`(來自 `ticks[].dYaw/dPitch`,tick 窗內依事件時間戳積分,**與 displayHz 無關**)· `aim-diff-legacy`(來自 `aim` 逐 tick 差分,**帶 KI-005 的 render/sim ZOH aliasing**,僅供讀取 pre-KI-005 匯出)。
  - **明記兩者是同一個構念、同一個數學核心**,只差 delta 從哪來(C-D4)。
- [ ] index 0 = `nan` 的既有段落補一行:`tick-integral` 下該樣本其實有定義,但契約維持 `nan`(D-A3 / TD-3),`seg-v2` 重掃時一併決定。
- [ ] §Frozen parameter registry 的 `seg-v1` 列加註:
  > `seg-v1` 的 SG window = 7 tick 是在**不含** KI-005 aliasing 的合成訊號上掃出來的(beat 週期 8 > window 7,數學上不可能濾除)。**A 落地後必須以新匯出重掃並升版 `seg-v2`**(D-28.7 不得原地調參)。在此之前,`seg-v1` 對真實資料的適用性未經驗證。
- [ ] §Real-export validation 段落(若存在)標明:所引用的 0.95 分段成功率來自帶 aliasing 的匯出,已隨 M14 ④ 撤回。

### 2. `schema.md`

- [ ] 新增 `ticks[].dYaw` / `ticks[].dPitch` 兩欄(T4):單位 rad、語意「本 tick 窗 `[tickStart, tickEnd)` 內依事件 `timeStamp` 積分的角位移」、`dPitch` **已含** ±`MAX_PITCH` 夾角效果(D-A2)、**缺席 ⇔ `meta.mouseIntegration` 缺席**。
- [ ] 複查 T2 已寫入的 `meta.fovDeg` / `meta.mouseIntegration` 段落與最終實作一致。
- [ ] 複查 T3 已寫入的 `bufferOverflow` 口徑變更註記。
- [ ] CSV 表頭的條件性(FM-7)在 §CSV 段落註明:`dYaw`/`dPitch` 兩欄**僅在匯出含該資料時出現**,舊匯出的 CSV 表頭逐位不變。

### 3. `KI-005-omega-render-sim-aliasing.md`

- [ ] 狀態列翻:`✅ **選項 A 已落地**(A1,YYYY-MM-DD);**A2(新採樣 + 複驗 + seg-v2)待排程**`。
- [ ] §6.2 的 `meta.fovDeg` 缺口標為已補(指向 T2)。
- [ ] §7 驗證計畫逐項標記:1(已完成)· 2/3(A1 已交付,指向 T4 的三個閘)· 4/5(**A2**,阻塞於新採樣)· 6(A1 已交付)。
- [ ] §8 OQ 表:`OQ-KI5-5` 維持未決;`OQ-KI5-6` 指向 [A2-blocked-plan.md](A2-blocked-plan.md)。
- [ ] 新增一段「A1 落地後的殘餘限制」:TD-1(仍 128 Hz)· TD-2(ADS 切換幀殘差)· **FM-1 的假設尚未證偽**(coalesced sum vs dispatched movement,須 A2-T2)。
- [ ] 補上 §2.4 的兩個新發現(pushMouse 無 lock 閘 · main.ts 未啟用 recordKeyEvents),註明由本計畫查碼發現並已處理 / 登錄。

### 4. `BUGFIX-DECISIONS.md`

- [ ] §1 索引的 KI-005 列狀態改為「🟡 A1 已落地,A2 待新採樣」。
- [ ] BD-005 條目補「**A1 落地**」段:
  - 實作形狀(tick 窗積分 + 三個閘)與**實測前後數字**(修法前 240 Hz 組的 0.533/1.067/12.5% → 修法後四節奏逐位相同)。
  - **兩個計畫階段的新發現**(§2.4 ①②)及其處置。
  - **偏離協議**:T4+T5 是否合併為單一 commit(比照 BD-001);OQ-A-1/A-2 的拍板。
  - **明確未交付**:M14 ③④⑤ 未重新宣告;WP-30/31 entry blocker **未解除**(三條理由:KI-005 的 A2、KI-006、以及 KI-004 已解除的那條)。
- [ ] 若 T3 的 `bufferOverflow` 口徑變更被判定為跨計畫影響,一併入帳。

### 5. `MAP.md` / `exec-plan/README.md` 的 M14 對帳

- [ ] [MAP.md](../../MAP.md):KI-005 條目狀態同步。
- [ ] [exec-plan/README.md](../../exec-plan/README.md) §3 的 M14 列:
  - ③④⑤ 維持**撤回**狀態,但把「解除條件」寫清楚:
    - **③** 需以修法後的新匯出重跑合成 fixture 邊界誤差閘(A2-T2)。
    - **④** 需 ①新匯出 + ②`counter` 事件存在(KI-006)兩者同時滿足。
    - **⑤** 需 `seg-v2` 於新匯出上重掃並凍結(A2-T3)。
  - 複查 KI-004 T6 已修正的「M14 ✅ 六項全綠」敘述未回退。
- [ ] `stage4/README.md` 與 WP-28 `progress.md` 若有對應敘述,一併對帳(**只對帳,不宣告**)。

---

## Definition of Done

- [ ] `analysis-segments.md` 的 ω 定義段記載兩個 source、明記同一構念同一核心(C-D4),且 `seg-v1` 列已加註「未經真實資料驗證,須 `seg-v2` 重掃」。
- [ ] `schema.md` 含 `ticks[].dYaw/dPitch`、`meta.fovDeg`、`meta.mouseIntegration`、`bufferOverflow` 口徑註記、CSV 條件表頭說明,五處與實作一致。
- [ ] KI-005 狀態 = 「✅ 選項 A 已落地(A1);A2 待排程」,§7 逐項標記 A1/A2 歸屬,且**殘餘限制段**含 TD-1/TD-2/**FM-1 未證偽**。
- [ ] BD-005 補 A1 落地段,含實測前後數字、兩個新發現、偏離協議、**明確未交付項**。
- [ ] MAP.md / exec-plan README / stage4 三處對帳一致,M14 ③④⑤ **仍為撤回**且**解除條件逐條寫明**。
- [ ] **全文複查:沒有任何一處把「儀器修好」寫成「效度恢復」或「M14 已恢復」。**
- [ ] `git diff` 只有 `docs/` 下的檔案。

## Commit message

```
docs(ki-005): A1 對帳 — ω 雙 source 定義 / schema 新欄 / M14 解除條件明文化

KI-005 / A(FR-A-13/14)。analysis-segments.md 記載 omega_deg_s 的兩個 source
(tick-integral / aim-diff-legacy)並明記兩者是同一構念、同一數學核心,只差
delta 從哪來(C-D4:既有構念不得有第二定義);seg-v1 加註「SG window 7 <
beat 週期 8,是在不含此假象的合成訊號上掃出來的,對真實資料的適用性未經驗證」。

schema.md 補 ticks[].dYaw/dPitch、meta.fovDeg、meta.mouseIntegration、
bufferOverflow 口徑變更、CSV 條件表頭五處。

M14 ③④⑤ **維持撤回**,只寫解除條件:A1 交付的是量測儀器的正確性,證據力只能
由修法後的新匯出恢復(KI-005 §7.4),且 ④⑤ 另被 KI-006 以獨立理由擋著。
WP-30/31 entry blocker **未解除**。
```
