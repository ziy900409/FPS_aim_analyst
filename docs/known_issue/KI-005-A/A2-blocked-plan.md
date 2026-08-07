# Stage A2 — 新採樣、複驗、`seg-v2`(**blocked**)

> 上游:[A README §4](README.md) · [KI-005 §7.4 / §7.5](../KI-005-omega-render-sim-aliasing.md) · [KI-006](../KI-006-m14-sample-no-counterstrafe.md)
> 狀態:⛔ **blocked on 研究者排程**。A1(T0–T-exit)已完成。**OQ-A-5/OQ-KI5-6、OQ-A-2/TD-5、OQ-KI6-4 三項前置決策已於 2026-08-07 拍板並全數落地**(見下「前置條件」,含 `recordKeyEvents` 的 `main.ts:355` 接線)。**所有決策與程式碼前置條件已滿足**,唯一剩下的是研究者實際排程執行採集。

---

## 為什麼必須分成兩個 stage

KI-005 §7.4 於 2026-08-06 **自我更正**:

> 初稿寫「以 09:39 匯出重跑 `run_pipeline.py`」是**錯的**:選項 A 改變的是**記錄什麼**,既有匯出的 `ticks[].aim` 已經帶著假象**寫死在檔案裡**,重跑分析不可能讓它變乾淨。

加上 OQ-KI5-3 拍板**不做選項 C**(不回溯清洗),結論是:**A1 交付的是量測儀器的正確性,不是效度的恢復**。效度只能由修法後的新匯出恢復,而那需要真人坐下來採一份資料。

把它切成獨立 stage 而非硬塞進 A1,是為了讓 A1 的 exit gate 保持**可客觀驗證**(全部是 `npm run test:ci` / `uv run pytest` 能判的條件),不被「等人採資料」拖成無限期未完成。

---

## 前置條件(全部滿足才可開 A2-T1)

- [x] A1 的 [T-exit-gate](T-exit-gate.md) 八道硬閘全綠。
- [x] **OQ-A-5**(= OQ-KI5-6)採樣時機與規模已定:✅ 2026-08-07 拍板,與 KI-006 選項 B **合併為同一次採集**。
- [x] **OQ-A-2 / TD-5** 決定:✅ 2026-08-07 拍板,採樣時**開啟** `recordKeyEvents`。
- [x] **`recordKeyEvents` 程式碼接線**(TD-5 落地,2026-08-07):[main.ts:355](../../src/main.ts#L355) 的 `createDataRecorder(...)` 已傳入 `recordKeyEvents: true`;`tests/e2e/input-sampler.spec.ts` 新增驗證案(`__aimDebug.recorder.recordKeyEvents === true`)。回歸:`tsc --noEmit` exit 0、`npm run test:ci` Vitest 89 files/739 tests 不變 + Playwright 21/21(新增 1 案)、`uv run pytest` 221 passed 不變。
- [x] **KI-006 的採集條件已滿足**:construct presence gate(選項 C)已落地([KI-006-C/](../KI-006-C/README.md),OQ-KI6-2/3 已關閉),B(重新採樣)的 KI-006 條件見 [KI-006-C/README.md §6](../KI-006-C/README.md) **B-1~B-5**(不在本檔重複列出)。
- [x] **OQ-KI6-4**(= [KI-006-C/README.md §6 B-4](../KI-006-C/README.md))決定:✅ 2026-08-07 拍板,**n > 2**(至少 3 個 session),嚴於原建議的 n ≥ 2。

> **兩個 KI 的重新宣告路徑收斂為同一次採集**(KI-005 §6.1 連帶結論)。採之前沒把 KI-006 的條件想清楚,就得採第二次。
>
> **決策與接線全數落地於 2026-08-07**,詳見 [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-005「A2-T1 前置決策」段與 [KI-005-A/progress.md A-D10/A-D11](progress.md)。**A2-T1 唯一剩下的是研究者實際排程執行採集**,不再有任何決策性或程式碼性的阻塞。

---

## A2-T1 — 新採樣

**執行者**:研究者(非 agent 可代勞)。

- [ ] 同一台 **240 Hz** 機器(使 §3.1 的凹口偵測器與 T0 的基線可直接對照)。
- [ ] drill 必須實際含 **counter-strafe 構念**:`vx` 非恆零、`keys` 非全空、`counter` 事件 > 0(KI-006 的撤回理由)。
- [ ] 匯出必須含 `meta.mouseIntegration` + `ticks[].dYaw/dPitch`(A1 的 FR-A-7 保證);**採完立即檢查,沒有就是 A1 沒真的啟用**。
- [ ] **`recordKeyEvents` 已開啟**(OQ-A-2/TD-5,2026-08-07 拍板):採集**前**於瀏覽器 console 確認 `__aimDebug.recorder.recordKeyEvents === true`;採完立即檢查匯出 `events` 是否含 `type === 'key'` 的項目,沒有就代表接線沒真的生效(比照 FR-A-7 `mouseIntegration` 的同一檢查紀律)。
- [ ] 記錄採集條件:受試者、螢幕型號/刷新率、sensitivity/FOV、drill config、session 數。
- [ ] session 數 **n > 2**(至少 3 個,OQ-KI6-4 已於 2026-08-07 拍板)。
- [ ] **採完立即**跑 construct presence gate(`run_pipeline` 消費新匯出);`constructPresence.present == false` 即**當場重採**,不得事後才發現構念缺席([KI-006-C/README.md §6 B-3](../KI-006-C/README.md))。

**DoD**:新匯出通過 `load_export` 且 `omega_deg_s(..., strict=True)` **不拋錯**(即 `source == "tick-integral"`);`counter` 事件數 > 0;`events` 含至少一筆 `type === 'key'`(證明 `recordKeyEvents` 接線生效,OQ-A-2/TD-5);`run_pipeline` 對每一份新匯出 exit 0 且 `constructPresence.present == true`(KI-006-C §6 B-2/B-3);session 數 n > 2。

---

## A2-T2 — 四項複驗(KI-005 §7.4)

| # | 檢查 | 基線(舊匯出) | 期望 |
|---|---|---|---|
| ① | 凹口偵測器(T0 的腳本,口徑逐字沿用) | 08:03 → 27 個 · 09:39 → 34 個,間距全為 8 的倍數 | **回傳 0** |
| ② | `merged_adjacent_peaks` 比例 | **15 / 19(79%)** | 顯著下降 |
| ③ | 未 flag 樣本數(`duration_ms`/`peak_omega_deg_s`/`mean_epsilon_deg`) | **n = 4**(n_flagged = 15) | 顯著上升 |
| ④ | **守恆(關閉 FM-1)**:`Σ dYaw` vs `aim.yaw` 淨變化 | — | 一致 ⇒ 證明修的是**歸屬**而非量值,**且** `getCoalescedEvents()` 的分量總和 == dispatched `movementX/Y` |

- [ ] ④ 是 **A1 內無法證偽的唯一假設**(FM-1 / R-2)。
- [ ] ⚠️ **若 ④ 不成立** ⇒ render 與量測看到的是不同的輸入流 ⇒ **立即把選項 B 提前**(raw sample stream 是唯一能仲裁的資料),並回頭修 KI-005 的修法段與 BD-005。
- [ ] ②③ 的「顯著」門檻應在**跑之前**先寫下(避免事後調口徑;比照 OQ-KI6-3 的 pre-register 精神)。

**DoD**:四項各有數字與對照基線,寫入 `progress.md` 與 BD-005;④ 的結論明確(成立 / 不成立 → 觸發選項 B)。

---

## A2-T3 — `seg-v2` 重掃與凍結

- [ ] 以**修法後的新匯出**重新掃參(**不得原地調 `seg-v1`**,D-28.7)。
- [ ] 重點:SG window 不再受「beat 週期 8」的約束 ⇒ 掃參空間與 `seg-v1` 的結論可能完全不同。
- [ ] 一併決定 **TD-3**:`tick-integral` 下 `omega[0]` 已有定義,是否改 `omega_deg_s` 的 index 0 = `nan` 契約與 D-28.12(`omega[1:]`)。
- [ ] 於 [analysis-segments.md](../../operational/analysis-segments.md) §Frozen parameter registry 新增 `seg-v2` 列,並註明掃參所用匯出的識別。
- [ ] 全鏈重跑(`run_pipeline.py` + 疊圖)。

**DoD**:`seg-v2` 已註冊;`seg-v1` 列保留但標為「僅適用於帶 aliasing 的 pre-KI-005 匯出」;全鏈重跑產物可重現。

---

## A2-T4 — M14 ③④⑤ 重新宣告

> **三項的解除條件不同,必須逐項判**。

| 項 | 撤回理由 | 解除條件 | 阻塞 |
|---|---|---|---|
| **③** 合成 fixture 邊界誤差 ≤ 2 tick | 結論成立但**證據力失效**(合成訊號不含此假象,無法保證真實資料行為) | 以新匯出跑同一閘 | A2-T2 |
| **④** 真實資料分段成功率 0.95 | ①aliasing(KI-005)②**樣本無 counter-strafe 構念**(KI-006,**獨立理由**) | 兩者**同時**滿足 | A2-T2 **且** KI-006 解除 |
| **⑤** `seg-v1` 參數凍結 | SG window 7 < beat 8,凍結值在真實資料上不適用 | `seg-v2` 於新匯出上重掃並凍結 | A2-T3 |

- [ ] 重新宣告的措辭必須沿用 WP-28 既有的**效度限制**(樣本數、匿名單一受試者等);不得因為儀器修好就擴大效度聲稱(比照 [KI-004 R-7](../KI-004-S1/README.md) 的同一紀律)。
- [ ] 對帳:[exec-plan/README.md](../../exec-plan/README.md) §3 M14 列 · `stage4/README.md` · [MAP.md](../../MAP.md) · WP-28 `progress.md`。
- [ ] **WP-30 / WP-31 entry blocker** 只有在三條理由全綠時才解除:

  | 理由 | 出處 | 解除於 |
  |---|---|---|
  | ε(t) 量測原點錯誤 | KI-004 / S1 | ✅ 已解除 |
  | ω(t) render/sim aliasing | KI-005 | A2-T2 / A2-T3 |
  | 樣本無 counter-strafe 構念 | KI-006 | KI-006 自身 |

**DoD**:三項逐項判定並記錄;WP-30/31 blocker 狀態明確(解除 / 仍擋,附理由)。

---

## Commit message(各 task 落地時)

```
docs(ki-005): A2-Tn — <任務摘要>
```
