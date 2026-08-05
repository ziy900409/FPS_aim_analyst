# KI-004 / S1 — Progress log

> running log:每個 task 完成時與切片一起 stage。tech spec:[README.md](README.md) · 索引:[task-checklist.md](task-checklist.md)
> 最新在下(時序閱讀)。決策若跨計畫或偏離協議 → 同步寫 [BD-004](../BUGFIX-DECISIONS.md)。

---

## 1. Progress

| 日期 | Task | 結果 | 證據 / 備註 |
|---|---|---|---|
| 2026-08-05 | 計畫 | ✅ S1 tech spec + T0–T6 + T-exit 產出 | 本資料夾;上游 [KI-004 §5.1](../KI-004-sim-world-unit-domain-mismatch.md) / [BD-004](../BUGFIX-DECISIONS.md) K-1/K-2/K-3 |
| 2026-08-05 | 計畫修訂 | ✅ **OQ-S1-1 + OQ-S1-2 拍板前拉** → 新增 T2(匯出自我描述),T2–T5 順延編號 | 使用者裁示;R-2 / R-6 / FM-5 消除,TD-1 縮為「逐 tick eye pose」 |
| | T0 | ⬜ | |
| | T1 | ⬜ | |
| | T2 | ⬜ | |
| | T3 | ⬜ | |
| | T4+T5 | ⬜ | 合併 commit |
| | T6 | ⬜ | |
| | T-exit | ⬜ | |

---

## 2. 基線(T0 回填)

| 項目 | 基線值 | 實測 |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | |
| `npm run test:ci` | 82 files / 641 tests + 19 e2e | |
| `uv run pytest` | 74 passed | |
| 08:03 `\|ε_現行 − offsetDeg\|` | median 12.52° / max 12.73° | |
| 08:03 `\|ε_正確 − offsetDeg\|` | median 0.21° | |
| 09:39 `\|ε_現行 − offsetDeg\|` | median 67.11° / max 88.55° | |
| 09:39 `\|ε_正確 − offsetDeg\|` | median 0.14° | |

> 基線值取自 [KI-004 §1.2](../KI-004-sim-world-unit-domain-mismatch.md);T0 必須獨立重現,對不上就停。

---

## 3. 受影響測試清單(T0 回填,FM-2 歸因表)

| 測試 | 預期 | 現值 → 新值 | 歸因(D2a / D2b / 兩者 / 不變) |
|---|---|---|---|
| `src/metrics/trackingDerivation.test.ts` | | | |
| `src/metrics/detectionDerivation.test.ts` | | | |
| `tests/golden/research/epsilon-parity.test.ts` | 必變(T5 重產) | | |
| `tests/e2e/br-tracking.spec.ts`(WP-23 M11 round-trip) | | | |
| `research/.../tests/test_angular.py` | 必變(簽名) | | |
| `src/data/metadata.test.ts` · `src/data/export.test.ts` | 增案(T2 新欄位);`suspect` 期望值**必須不變** | | |
| 比對整個 `meta` 物件的 golden/決定性 fixture(T0 盤點) | 可能因新 optional 欄位而 diff;須確認是「新欄位出現」而非「既有值改變」 | | |
| 決定性回歸(`src/loop/__tests__/`、`tests/regression/`) | **必須不變** | | 變動 = 違反 NFR-S1-1,立即停 |

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
