# T-exit — S1 Exit gate:交付判定

> 上游:[S1 README §6](README.md) · [KI-004 §6 驗證計畫](../KI-004-sim-world-unit-domain-mismatch.md)
> 依賴:T0–T6 全數 commit。本檔為**證據回填表**,不新增改動。

---

## 1. 硬閘(G-1 ~ G-8)

| # | 條件 | 驗證方式 | 結果 | 證據 |
|---|---|---|---|---|
| **G-1** | 閘 ① 綠:兩份真實 fixture 的全部合格 fire,`\|ε − offsetDeg\| ≤ 0.5°`,且合格樣本數 > 0 | `npm run test:ci` | ⬜ | 08:03 median/max = ____ · 09:39 median/max = ____ · 合格 fire 數 = ____ |
| **G-2** | 閘 ② 綠:TS 與 Python 各自對**閉式解** ≤ 1e-9(`eyeBase.z ≠ 0` 且 `px ≠ 0`) | `npm run test:ci` + `uv run pytest` | ⬜ | TS rel.err = ____ · Python rel.err = ____ |
| **G-3** | corridor 邊界測試綠:在 `halfWidthU / SIM_TO_WORLD`(= 100 u)翻轉,且**不**觸發 `meta.suspect`,但 `meta.validity.corridorExceeded` 為 `true` | `npm run test:ci` | ⬜ | |
| **G-4** | `npx tsc --noEmit` exit 0 · `npm run test:ci` exit 0 · `uv run pytest` exit 0 | 三條指令 | ⬜ | vitest ____ files / ____ tests + ____ e2e(基線 82/641/19)· pytest ____ passed(基線 74) |
| **G-5** | 決定性零影響:`src/sim/`、`SharedState` 演進、`SimLoop.step` 零 diff;既有決定性回歸逐位綠 | `git diff --stat` + 案數對照 T0 | ⬜ | |
| **G-6** | 09:39 真實匯出實跑:`suspect` 符合 K-3 意圖(僅 corridor 越界時為 `false`),ε(t) 量級合理(對照 `offsetDeg` 0.8–3.2°) | 重跑腳本輸出對照表 | ⬜ | |
| **G-7** | **匯出自我描述**:新產生的匯出含 `meta.simToWorld` + `meta.scene.eye` + `meta.validity`;derivation **不傳 options** 即解析出 `source === 'meta'`,且 `base` == 該場景 `resolveEyeWorldBase` | round-trip 測試 + `npm run test:ci` | ⬜ | |
| **G-8** | **`suspect` 只減不加**:相對 S1 前的唯一差異是移除 corridor 項;`bufferOverflow` 未被併入 | NFR-S1-2b 釘死測試 | ⬜ | 對照 T0 抄錄的 OR 集合 |

---

## 2. FR 覆蓋複查

| FR | Task | 交付證據 | 結果 |
|---|---|---|---|
| FR-S1-1 `SIM_TO_WORLD` 引擎級唯一常數 | T1 | `grep` 無第二份單位換算字面值 | ⬜ |
| FR-S1-2 eye world base 單一來源 + camera 逐位不變 | T1 | 四場景逐條斷言測試 | ⬜ |
| FR-S1-3 corridor world 域比較 | T3 | 邊界掃描測試 | ⬜ |
| FR-S1-4 corridor 脫離 `suspect` | T3 | `suspect` 語意測試 | ⬜ |
| FR-S1-5 derivation 用 eye pose | T4 | 閘 ①/② | ⬜ |
| FR-S1-6 `ResolvedEyeOrigin.source` 具名揭露 | T4 | 三值覆蓋測試 | ⬜ |
| FR-S1-7 `strictEyeOrigin` 拋錯 | T4 · T5 | 拋錯路徑測試 + 研究側入口 strict | ⬜ |
| FR-S1-8 Python 同步 | T5 | `uv run pytest` | ⬜ |
| FR-S1-9 閘 ① | T4 | G-1 | ⬜ |
| FR-S1-10 閘 ② | T4 · T5 | G-2 | ⬜ |
| FR-S1-11 parity fixture 重產 | T5 | `epsilon-parity.test.ts` 綠 | ⬜ |
| FR-S1-12 M14 ② 重新宣告 + 對帳 | T6 | WP-28 progress + 五處文件 | ⬜ |
| FR-S1-13 `meta.simToWorld` | T2 | G-7 | ⬜ |
| FR-S1-14 `meta.scene.eye`(未讀 render camera) | T2 | G-7 + `git diff` 複查 | ⬜ |
| FR-S1-15 `meta.validity` 四項 | T2 · T3 | G-3 + G-8 | ⬜ |

---

## 3. NFR 量化複查

| NFR | 指標 | 實測 | 結果 |
|---|---|---|---|
| NFR-S1-1 | sim 決定性零影響(`src/sim/` / `SharedState` 演進 / `SimLoop.step` 零 diff) | | ⬜ |
| NFR-S1-2 | 匯出 schema **只增不改**(新欄位皆 optional additive;`schemaVersion` 維持 2;既有欄位無刪改名、尺度語意不變) | | ⬜ |
| NFR-S1-2b | `meta.suspect` 只減不加(唯一差異 = 移除 corridor) | | ⬜ |
| NFR-S1-3 | 四場景 camera 位置逐位不變 | | ⬜ |
| NFR-S1-4 | 閘 ① 容差 0.5°;修法前於 08:03 為紅(≈12.5°) | | ⬜ |
| NFR-S1-5 | 閘 ② 相對誤差 ≤ 1e-9 | | ⬜ |
| NFR-S1-6 | 三條指令 exit 0 | | ⬜ |

---

## 4. 交付後狀態

- [x] **M14 ② 重新宣告**完成(2026-08-06,T6;見 [WP-28 progress.md](../../exec-plan/active/stage4/wp-28-research-foundation/progress.md))。⚠️ **不等於** WP-30/31 entry blocker 解除 —— 該 blocker 有三條相互獨立的理由(KI-004/KI-005/KI-006,2026-08-06 才確認),本項只解除 KI-004 這一條;KI-005(🟡 待落地)/KI-006(🔴 待拍板)仍未落地,entry blocker 整體維持。此假設(訂於 2026-08-05,KI-005/006 發現前)已作廢,見下方 §5 與 KI-004 §3。
- [ ] KI-004 狀態 = 「✅ S1 已落地;S2(逐 tick eye pose)/ S3 待辦」,且 §5.1 的 S2 列已改寫(②③ 與 ① 靜態部分已前拉)。
- [ ] 遺留 OQ 清單(逐條有落點,不得只在 commit message):
  - ~~**OQ-S1-1** / **OQ-S1-2**~~ → ✅ 2026-08-05 拍板**前拉**,已由 T2 交付(FR-S1-13/14/15)
  - **OQ-S1-3** 閘 ① 的 tick 選取口徑 → 依 T4 實作決定,結論記 progress
  - **OQ-S1-6** `meta.validity` 上線後 `suspect` 是否仍為主要判讀旗標 → **S3**,owner 研究者
  - **OQ-KI4-2** corridor 觀測記錄粒度 → S1 已落布林;粒度升級待研究者定義
  - **OQ-KI4-5** 越界期間的 peek 是否在報告層加註 → 影響 WP-30/31 資料篩選,owner 研究者
  - **OQ-KI4-6** `clearance.halfWidthU` 是否拆欄 → 依 T3 決定(**不拆**),定觀測粒度時複查
- [ ] **未交付項**(明確記錄,避免日後誤以為 S1 已根治):
  - 匯出記的是**靜態** eye base,非逐 tick eye world pose(TD-1)。單一 drill 內場景固定 ⇒ 還原能力充分;**但若日後允許 drill 內切換場景或改變 eye base,靜態欄位立即失效,必須先做 S2**。
  - corridor 觀測只有布林 `corridorExceeded`,無 `max|lateral|` / 越界 tick 佔比(TD-1b / OQ-KI4-2)。
  - pre-S1 匯出(含 08:03 / 09:39 兩份真實 fixture)仍需呼叫端顯式提供 eye base(FM-1);此為刻意保留的相容路徑測試樣本。
  - `CONTEXT.md` 的「sim/資料不得用公尺」敘述**在今天仍是假的**(屬 S3),留著會繼續誘導同類 bug。

---

## 5. 建議的下一步

| 優先 | 項目 | 理由 |
|---|---|---|
| 1 | **S3 文件 / ADR** | `CONTEXT.md` 的錯誤單位敘述是 D2a 的文化成因;S1 已把資料層修正,文件層若不跟上,下一個人仍會照著錯的敘述寫程式 |
| 2 | WP-30 / WP-31 展開 | ⚠️ **此優先序訂於 2026-08-05,KI-005/KI-006 發現前已作廢**:entry blocker **未**解除 —— KI-004 這條理由已隨 M14 ② 重新宣告解除,但 KI-005(ω 汙染)/ KI-006(樣本無構念)兩條獨立理由仍待落地(見 KI-004 §3「WP-30/WP-31 entry」列)。新匯出自我描述原點雖已可直接使用(不必等 S2),但**不足以**解除整體 entry blocker |
| 3 | **S2 逐 tick eye world pose** | 優先度已因 T2 前拉而下降(還原能力已足);觸發條件 = 允許 drill 內切換場景,或研究側決定把 corridor 觀測升級為連續量(OQ-KI4-2) |

## Commit message

```
docs(ki-004): S1 exit gate — 八道硬閘證據回填 + 交付判定
```
