# KI-004 / S1 — Progress log

> running log:每個 task 完成時與切片一起 stage。tech spec:[README.md](README.md) · 索引:[task-checklist.md](task-checklist.md)
> 最新在下(時序閱讀)。決策若跨計畫或偏離協議 → 同步寫 [BD-004](../BUGFIX-DECISIONS.md)。

---

## 1. Progress

| 日期 | Task | 結果 | 證據 / 備註 |
|---|---|---|---|
| 2026-08-05 | 計畫 | ✅ S1 tech spec + T0–T6 + T-exit 產出 | 本資料夾;上游 [KI-004 §5.1](../KI-004-sim-world-unit-domain-mismatch.md) / [BD-004](../BUGFIX-DECISIONS.md) K-1/K-2/K-3 |
| 2026-08-05 | 計畫修訂 | ✅ **OQ-S1-1 + OQ-S1-2 拍板前拉** → 新增 T2(匯出自我描述),T2–T5 順延編號 | 使用者裁示;R-2 / R-6 / FM-5 消除,TD-1 縮為「逐 tick eye pose」 |
| 2026-08-06 | T0 | ✅ 基線量測 + 受影響面盤點完成(§2/§3 已填) | 三條基線指令 exit 0;閘 ① 偏差重現於 scratchpad(未進 repo);見 §5 S-S1.2/S-S1.3 |
| | T1 | ⬜ | |
| | T2 | ⬜ | |
| | T3 | ⬜ | |
| | T4+T5 | ⬜ | 合併 commit |
| | T6 | ⬜ | |
| | T-exit | ⬜ | |

---

## 2. 基線(T0 回填)

| 項目 | 基線值(KI-004 §1.2) | 實測(2026-08-06) |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | ✅ exit 0 |
| `npm run test:ci` | 82 files / 641 tests + 19 e2e | ✅ **83 files / 651 tests**(vitest)+ **19/19**(playwright)全綠;檔數/案數比計畫文件略多(既有開發持續累積測試,非本次改動),已記錄為對照基準 |
| `uv run pytest` | 74 passed | ✅ **168 passed**(見 S-S1.3 環境註記) |
| 08:03 `\|ε_現行 − offsetDeg\|` | median 12.52° / max 12.73° | 見 S-S1.2(N=20 全 firstShot fire):median 12.26° / **max 12.73°**(與基線 max 完全吻合) |
| 08:03 `\|ε_正確 − offsetDeg\|` | median 0.21° | median 0.04° / max 0.23°(同組) |
| 09:39 `\|ε_現行 − offsetDeg\|` | median 67.11° / max 88.55° | median 68.10° / max 93.53°(同組) |
| 09:39 `\|ε_正確 − offsetDeg\|` | median 0.14° | median 0.03° / max 0.23°(同組) |

> 基線值取自 [KI-004 §1.2](../KI-004-sim-world-unit-domain-mismatch.md)。獨立重現詳見 S-S1.2 —— **量級與方向完全吻合**(現行公式偏差 8~93°,正確公式收斂至 <0.25°),08:03 的 max 更是逐位吻合;median 的小數點差異歸因於 tick 選取口徑尚未拍板(OQ-S1-3),不影響「bug 存在且修法有效」的診斷結論,不視為 stop 條件。

---

## 3. 受影響測試清單(T0 回填,FM-2 歸因表)

| 測試 | 預期 | 現值 → 新值 | 歸因(D2a / D2b / 兩者 / 不變) |
|---|---|---|---|
| `src/metrics/trackingDerivation.test.ts`(9 案) | **不變** | 全部合成 fixture 的 `px=0, pz=0`,且 aim origin 手動建構為 `(0, EYE_HEIGHT, 0)`(檔內常數,z 分量 = 0);修法後 `legacy-default` 的 base 仍是 `(0, eyeHeight, 0)` z=0 —— 逐位相同 | 不變(fixture 未觸及 D2a/D2b 任一分支) |
| `src/metrics/detectionDerivation.test.ts`(8 案) | **不變** | 同上:所有 tick `px=0, pz=0`,`TARGET.z=-4` 未搭配非零 base | 不變 |
| `tests/golden/research/epsilon-parity.test.ts`(1 案) | **必變**(T5 重產) | `synthetic_counterstrafe.json` 的 `meta.scene.sceneId = 'placeholder-room'`(`eyeZ` 省略 → base.z = depth/2−standoff = 3/2−1 = **0.5**,非 0)且 `px` 範圍 [-7.8, 5.9](非 0);parity fixture 的 `options` 目前只有 `{eyeHeight:1.6, hitbox}`,未含 z offset 與 SIM_TO_WORLD 縮放 → T4 落地後此測試必紅,T5 重產 fixture 後轉綠(README §4 已定為 T4+T5 合併 commit) | **D2a + D2b 兩者皆命中**(base.z≠0 且 px≠0) |
| `tests/e2e/br-tracking.spec.ts`(2 案,經 `trackingMetricsFromExport` 呼叫 `deriveTrackingMetrics(payload)` 不傳 options,[fpsTestHarness.ts:544](../../../src/testharness/fpsTestHarness.ts#L544)) | **需重新確認**(非必然變動) | br-field 場景 `eyeZ:0`([br-field.ts:26](../../../src/scene/scenes/br-field.ts#L26))→ base.z 修法前後皆為 0,**D2a 不觸發**;但 br 協定含真實 A/D 橫移,px≠0 → **D2b 觸發**(現行公式缺 ×0.01)。斷言皆為門檻式(`tAcquireMs<=16`、`totPercent>=99`、`rmsEpsilonDeg<0.1`)而非精確值比對,且 mode 為 `'autoAim'`(sim 內部以正確 world 幾何驅動 aim,非離線推導自身），故**可能仍綠**,但數值分佈會改變,必須在 T4 落地後實跑確認,不得預先假設不變 | D2b(px 縮放) |
| `research/.../algorithms/tests/test_angular.py`(9 案) | **必變**(簽名破壞性變更) | 現行呼叫全部用位置參數形式 `epsilon_deg(ticks, meta)` / `epsilon_deg(ticks, {}, fallback_target=...)`,依賴預設 `eye_height=1.6`;T5 把第三位置參數改為 keyword-only `eye_origin`(README §2.4),呼叫端必須顯式改寫。數值上:現有 fixture 的 ticks 多為 `px=0`(見 `_ticks()` helper),故**數值本身多數不變**,但**呼叫簽名 100% 需改**,不改會直接 TypeError | 簽名變動(非 D2a/D2b 數值,是 API 破壞性變更) |
| `research/.../algorithms/tests/test_parity_fixture.py`(2 案)·`test_purity.py`(2 案) | `test_parity_fixture.py` 隨 T5 重產的 parity fixture **必變**;`test_purity.py` 為靜態 import 檢查,**不變** | | `test_parity_fixture.py` 同 epsilon-parity.test.ts 的歸因;`test_purity.py` 不變 |
| `src/data/metadata.test.ts`(24 案)· `src/data/export.test.ts`(9 案) | 增案(T2 新欄位驗證);既有案的 `suspect` 期望值**必須不變** | 目前無案測試 `simToWorld`/`scene.eye`/`validity`(T2 前尚未存在此欄位),故現有 24+9 案應逐位綠;T2 新增獨立案覆蓋三個新區塊 | 不變(既有案)+ 新增(新案) |
| 比對整個 `meta` 物件的 golden/決定性 fixture | 已盤點:**repo 內無**任何 `.test.ts` 以 `toEqual`/`toStrictEqual`/`toMatchSnapshot` 對整個 `meta` 物件斷言(全域搜尋 0 命中) | — | R-2b 風險降為低:新增 optional 欄位不會使既有測試因「物件形狀」而 diff |
| `meta.suspect` 完整 OR 集合(NFR-S1-2b 比對基準,見下) | T3 後**唯一**變化 = 移除 corridor 項 | 現行 4 項 OR → T3 後 3 項 OR | 見下方 OR 集合抄錄 |
| 決定性回歸(`src/loop/__tests__/` 8 檔、`tests/regression/` 8 檔) | **必須不變** | 本次 T0 僅量測,未改 `src/`,已全綠(83 files/651 tests 含此範圍) | 變動 = 違反 NFR-S1-1,立即停 |

**`meta.suspect` 現行 OR 集合**(逐條抄錄自 [main.ts:379-382](../../../src/main.ts#L379-L382) + [export.ts:21-26](../../../src/data/export.ts#L21-L26),作為 T3 之後「只減不加」的比對基準):

```
suspect =
  sharedState.validity.playerCorridorExceeded                                    // ← T3 移除(K-3)
  || (protocolContext === undefined ? experimentSession.suspect : protocolContext.suspect)  // session/protocol suspect
  || frames.summary.p95 > PERF_FLOOR_MS                                          // perfFloor
  || recorderOverflow   // = meta.recorderOverflow || snapshot.recorderOverflow（export.ts:21,26）
```

確認：**`bufferOverflow` 不在此 OR 集合內**(`sharedState.inputMeta.bufferOverflow` 僅落 `meta.bufferOverflow` 欄位本身,[main.ts:375](../../../src/main.ts#L375),從未併入 `suspect` 運算)。T2 新增 `meta.validity.bufferOverflow` 時必須維持這個「不進 suspect」的現狀(NFR-S1-2b)。

---

## 4. Decision Log

| # | 決策 | 理由 | 落點 |
|---|---|---|---|
| **S1-D1** | 計畫落 `docs/known_issue/KI-004-S1/` 資料夾(而非單檔或 exec-plan WP) | 守 CLAUDE.md §9「bugfix 走 known_issue」,同時沿用 exec-plan 的「一 task 一檔、單 task context < 40%」紀律;S1 橫跨 `src/metrics` + `main.ts` + Python + fixtures + 兩道新閘,單檔會過長 | 2026-08-05 使用者拍板 |
| **S1-D2** | T4 + T5 **合併為單一 commit** | TS 修法後 `epsilon-parity.test.ts` 必紅(Python fixture 未重產),與 repo 硬規「每個 commit 綠」衝突;比照 BD-001 的 TDD 偏離慣例 | 落地時同步記 BD-004「偏離計畫」 |
| **S1-D3** | `legacy-default` fallback **仍套用 `SIM_TO_WORLD`**,只有 `base.z` 退回 0 | D2b 的因子是全域引擎常數、可知;D2a 的 `base.z` 才是 pre-S1 匯出無法還原的部分。fallback 不得原樣保留舊的錯誤行為 | [README §2.3](README.md) |
| **S1-D4** | 研究側入口(parity generator / `run_pipeline`)一律 `strict`,Python 端**不留位置參數相容** | 留著相容入口 = 留著「靜默用錯原點」的路徑,正是 D2a 的成因 | [README §2.4](README.md) · T4 |
| **S1-D5** | 閘 ② 兩側各自對**閉式解**斷言,而非互相對表 | parity 是一致性閘,無法發現兩側一起錯(BD-004 架構層結論) | T4 · T5 |
| **S1-D6** | **前拉** KI-004 §5.1 的 S2 ②③ 與 ① 的**靜態部分**進 S1(新增 T2) | 使用者拍板。D2a 的結構性根因是「匯出在數學上無法還原原點」(KI-004 §2.3)—— 只修 derivation 是把「猜」從錯的改成對的,只有讓匯出自我描述才能讓「猜」本身消失。三個純量 + 一個布林區塊,additive、不 bump `schemaVersion`。corridor 的匯出落點同時解決,`suspect` 拆除不再遺失資訊 | 2026-08-05;[README §2.3a](README.md) · T2 |
| **S1-D7** | eye base 記**靜態**(`meta.scene.eye`),**逐 tick** eye pose 留 S2 | 場景在單一 drill 內固定 ⇒ 靜態 base + `px/pz` + `simToWorld` 已足以逐 tick 還原;逐 tick 版是 GD-7 raw-over-derived 的完整形式,對還原能力零增益。**前提**:若日後允許 drill 內切換場景,靜態欄位立即失效 | TD-1 |
| **S1-D8** | `suspect` 在 S1 **只減不加**;`bufferOverflow` 進 `validity` 但**不**進 `suspect` | K-3 只授權移除 corridor。把 `bufferOverflow` 順手併入會改變舊資料的判讀口徑,屬未經授權的語意擴大 | NFR-S1-2b · T2 · T3 |
| **S1-D9** | 兩份真實 fixture(08:03 / 09:39)**刻意不補新 meta 欄位** | 它們是 pre-S1 匯出的回歸樣本;補欄會讓 `legacy-default` 相容路徑與 strict 拋錯在 CI 完全不受測 | T2 · T4 |
| | *(T0 起逐條追加)* | | |

---

## 5. Surprises(執行中發現、與計畫假設不符的事)

| # | 發現 | 影響 | 處置 |
|---|---|---|---|
| **S-S1.1** | M14 ② 撤回**未傳播到所有文件**:[exec-plan/README.md:125](../../exec-plan/README.md) 仍寫「M14 ✅ 六項全綠 / entry blocker 已解除」、[MAP.md:38](../../MAP.md) 寫「②③⑥ 綠 / ①④⑤ 阻塞」,兩者互相矛盾也與 stage4/README 矛盾 | 讀到不同文件會得到相反的排程結論 | 併入 **T5** 一次收斂;寫法改為「權威在一處、其餘指路」 |
| **S-S1.2** | 用「僅 `aimPunchPitch/Yaw == 0` 的首發」過濾兩份真實 fixture 時,08:03 與 09:39 **各只剩 1 筆合格 fire**(N=1)。改用「全部 20 筆 firstShot fire」重現 KI-004 §1.2 的 median/max,量級與方向完全吻合(現行公式偏差 8~93°,正確公式 <0.25°),08:03 的 max 甚至逐位吻合(12.73° = 12.73°);但 median 有小數點差異(08:03: 12.26° vs 12.52°;09:39: 68.10°/93.53° vs 67.11°/88.55°)。腳本存於 scratchpad(不進 repo),未提交 | 差異來源疑為**tick 選取口徑**未拍板(README §5 OQ-S1-3:`argmin \|Δt\|` vs 「最近的 t ≤ fire.t」)——KI-004 原始診斷用的確切口徑未逐字記錄;差異量級遠小於「bug 存在」本身的訊噪比(~50-500×),不影響診斷結論成立 | 不阻塞 T0;**OQ-S1-3 必須在 T4 實作時定案**,定案後可用同一腳本逐位核對是否收斂到 12.52/67.11 |
| **S-S1.3** | `uv run pytest`(不帶參數)在本機環境對**預設 basetemp**(`%TEMP%\pytest-of-<user>`)拋 `PermissionError: [WinError 5] Access is denied`,10 案於 `research/src/report/tests/test_coach_report.py` 等處失敗;改用短路徑 `--basetemp=C:\pytest-tmp` 後 **168 passed**,零失敗 | 純環境問題(Windows ACL + Claude Code scratchpad 路徑過長觸及 `test_coach_report.py` 內建的 MAX_PATH 規避邏輯),與 KI-004 程式碼無關;若未來 CI/其他機器重現同樣的 basetemp 問題,`uv run pytest` 的「正常」呼叫方式需要外部處理(非本 repo 範疇) | 記錄於此供未來 session 參考;不視為受影響測試,不計入 R-1 |
| | *(執行中追加)* | | |

---

## 6. Open Questions(狀態隨執行更新)

| # | 問題 | Owner | Deadline | 現況 |
|---|---|---|---|---|
| ~~**OQ-S1-1**~~ | ~~是否把 `meta.simToWorld` + 靜態 eye base 從 S2 前拉進 S1?~~ | 使用者 | — | ✅ **關閉(2026-08-05)**:**前拉**,落 T2(S1-D6) |
| ~~**OQ-S1-2**~~ | ~~corridor 越界資訊在 S1 期間無匯出落點,是否可接受?~~ | 使用者 | — | ✅ **關閉(2026-08-05)**:**前拉** `meta.validity`,落 T2(S1-D6) |
| **OQ-S1-3** | 閘 ① 的 tick 選取口徑(`argmin \|Δt\|` vs `t ≤ fire.t`) | 實作者 | T4 實作時 | 🟡 建議 `argmin`(與 KI 實測口徑一致) |
| **OQ-S1-4** | `clearance.halfWidthU` 是否拆成兩個欄位(= OQ-KI4-6) | 實作者 | T3 實作時 | 🟡 建議**不拆**(K-3 下 corridor 已非 gate) |
| **OQ-S1-5** | M14 ② 重新宣告的證據門檻 | 研究者 | T6 開工前 | 🟡 建議「parity 綠 + 閘 ① 兩份 fixture 綠」即可 |
| **OQ-S1-6** | `meta.validity` 上線後,`suspect` 是否仍為研究判讀的主要旗標? | 研究者 | S3 前 | 🟡 S1 維持相容旗標;若改以 `validity` 逐項判讀,`suspect` 可於 S3 標 deprecated。不阻塞 S1 |

> KI-004 §7 的 **OQ-KI4-2 / 5 / 6** 不在此重複,只在 T-exit 的遺留清單複查落點。
