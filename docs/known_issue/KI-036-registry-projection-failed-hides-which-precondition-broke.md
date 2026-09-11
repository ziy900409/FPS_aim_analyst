# KI-036 — `projection-failed` 是單一 catch-all,遮蔽「缺受試者代號」這個真因

> 類型：**diagnosability defect**（無錯資料流出;但整批 run 靜默退出趨勢且無從歸因）。
> 狀態：🔴 **診斷完成（2026-09-09），修法待落地**。尚無 `BD-034`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 標的：[`src/history/DrillMetricRegistry.ts`](../../src/history/DrillMetricRegistry.ts)（`project()` 的
> `try/catch`，`:397-415`）· [`src/metrics/compatibilityKey.ts`](../../src/metrics/compatibilityKey.ts)（`:30`）。
> 相關：[KI-037](KI-037-valid-duration-includes-countdown.md)（同一批真人 run 發現）·
> [CLAUDE.md §4 C-D3](../../CLAUDE.md)。
> 發現脈絡：2026-09-09 依
> [`HANDOFF-v3-real-data.md`](../exec-plan/active/stage14/HANDOFF-v3-real-data.md) 用三份真人
> `spider-shot-v3` 匯出產生教練報告時，HANDOFF §9 的 DoD 寫「`DrillMetricRegistry.project()` 對三份
> 都回 `status: 'ready'`」——實測**三份都不是**。

## 1. 症狀

三份 2026-09-09 的真人 `spider-shot-v3` 匯出，`createDrillMetricRegistry().project(payload)` 一律回：

```json
{ "status": "invalid-metric", "reasonCode": "projection-failed" }
```

`projection-failed` 不告訴操作者**哪一條前提失敗**。實際原因逐條複驗後是單一一項：

> **`meta.session` 整個區塊缺席** ⇒ `buildCompatibilityKey()` 的第一行
> `requireTrimmedNonEmptyString(meta.session?.participantId, …)` 擲錯。

三份匯出的 `meta` 頂層鍵為 `schemaVersion, drillId, weaponId, weaponSeed, rngSeed, backend, displayHz,
simHz, browser, sensitivity, sensitivityModel, movementModel, fovDeg, crossOriginIsolated, startedAt,
unit, vStrafe, maxDrillSeconds, lateEventCount, bufferOverflow, recorderOverflow, suspect, simToWorld,
validity, weapon, targets, spawn, scene, display, frames, assessment, protocolGuard, mouseIntegration,
replay` —— **沒有 `session`**。

其餘每一條前提都成立（已逐條複驗）：`meta.assessment` 在、`sessionPlanMode` 未設、`weaponId`／
`movementModel`／`fovDeg` 都在、`protocolGuard.noMovement === true`、`targets.hitbox`／`scene.eye`／
`spawn.spiderShot` 齊備、宣稱角徑 2.0° 與匯出 hitbox 的一致性檢查通過。

**指標本身完全算得出來。** 繞過 registry 的 cohort key、直接呼叫
`registrationForExactDrill('spider-shot-v3').project(payload)`，五個 descriptor 全部有值：

| Metric | rep 1 | rep 2 | rep 3 |
|---|---:|---:|---:|
| `spider-v3.peripheral-hits-per-minute` | 33.2 | 36.2 | 40.1 |
| `spider-v3.peripheral-first-shot-hit-rate` | 94.6% | 84.6% | 97.7% |
| `spider-v3.median-peripheral-hit-time-ms` | 810.1 | 788.7 | 771.5 |
| `spider-v3.median-fire-angle-error-deg` | 0.47 | 0.52 | 0.48 |
| `spider-v3.median-overshoot-deg` | 2.88 | 1.64 | 1.83 |

⇒ 失效的是**這三份 run 的 metadata**，不是指標。但 `projection-failed` 讓這兩件事在輸出上不可分。

## 2. 根因

兩個獨立的面，**必須分開處置**：

### ① 蒐集面 —— 錄製時沒有填受試者代號

`meta.session` 由 `main.ts` 在存檔／匯出時依 SessionSetup 的值帶入
（[`main.ts:1146`](../../src/main.ts#L1146) `...(overrides.participantId !== undefined ? { session: … } : {})`）。
沒有走那條路徑的匯出就沒有這個區塊。與 `meta.dpi` 同型：**瀏覽器讀不到、只能人填，沒填就永久缺**。

### ② 診斷面 —— 一個 `catch` 吞掉七種不同的失敗

```ts
// DrillMetricRegistry.ts:397-415
try {
  const qualityGateStatus = qualityGateStatusForPayload(payload);
  const compatibilityKey = buildCompatibilityKey(payload.meta, registration.drillId, targetConditionCellForRegistration(payload), qualityGateStatus);
  const observations = registration.project(payload);
  …
} catch {
  return { status: 'invalid-metric', reasonCode: 'projection-failed' };
}
```

這個 `try` 涵蓋的擲錯來源至少有：`meta.session.participantId` 缺席、`weaponId`／`movementModel`／
`sensitivity`／`fovDeg` 缺席或非法、`protocolGuard.noMovement` 不為真、`targets.hitbox`／`scene.eye`
缺席、宣稱角徑與匯出 hitbox 不符（`> 1e-9` 即擲）、以及 projector 自己的任何例外。**七類失敗共用一個
編碼。** 其中「宣稱角徑對不上」是一道**真正的資料完整性檢查**，而「忘了填代號」是操作疏失 ——
兩者的處置完全不同，但輸出上不可分。

⚠️ 注意 `catch` 連 `error` 都沒有綁定 ⇒ 原始訊息在被丟棄前**沒有任何地方留存**。

## 3. 影響面

1. **今日無錯資料流出**：`invalid-metric` 是正確的結論（這些 run 確實不該進 cohort，因為 cohort 的第一
   個軸就是 `participantId`）。錯的是**說不出為什麼**。
2. **靜默退出趨勢**：`HistoryTrend` 只看 `status`，所以整批 run 就這樣不見了。操作者若不逐份手動比對
   `meta`，看到的只是「趨勢圖上沒有這幾場」。
3. **與 KI-031 同型的失效模式**：合法值（`invalid-metric` 是列舉裡的合法狀態）掩蓋掉一個可修的問題，
   CI 全綠。KI-031 是 `status: 'timeout'` 掩蓋 detection 全滅，這裡是 `projection-failed` 掩蓋
   metadata 缺欄。
4. **DoD 誤導**：`HANDOFF-v3-real-data.md` §9 寫「三份都回 `ready`」是本檔作者在**沒有實跑 registry**
   的情況下寫下的預期；接手者若照抄會得到一個永遠打不了勾的 DoD。
5. **同一欄還擋住 `deriveSessionId()`**（[`compatibilityKey.ts:19`](../../src/metrics/compatibilityKey.ts#L19)），
   所以這批 run 也沒有 session id 可用於歸戶。

## 4. 修改計畫（未落地）

**選項 A（建議）—— 把 catch-all 換成具名 reason code，不改任何判定語意。**

- 讓 `buildCompatibilityKey()` 與 `targetConditionCellForRegistration()` 擲**帶結構的錯**（例如
  `MetricPreconditionError { field: 'meta.session.participantId' }`），`project()` 的 `catch` 讀它並回
  `{ status: 'invalid-metric', reasonCode: 'missing-precondition', field }`。
- **不新增狀態、不改既有 reason code 的意義**：`ready`／`unregistered-drill`／`excluded-cohort`／
  `invalid-metric` 四個狀態不動，`unknown-metric-id`／`unit-mismatch`／`non-finite-value` 三個既有
  code 不動;只把 `projection-failed` 從「什麼都可能」縮小成「真正未預期的例外」。
- 現有測試對 `projection-failed` 的斷言需逐一檢視：斷言「缺前提 ⇒ projection-failed」的要改成新 code，
  斷言「未預期例外 ⇒ projection-failed」的保留。

**選項 B —— 只在離線分析端補診斷，production 0 改動。**
即本次落地的做法:[`scripts/spiderShotV3CoachRunner.ts`](../../scripts/spiderShotV3CoachRunner.ts) 的
`diagnoseProjectionFailure()` 逐條複驗前提並印出缺了什麼。**這是繞道不是修復** —— 它是 registry 前提
的第二份清單，registry 改了它不會自動跟上（C-D4 意義下的複製品，已在該函式的 doc comment 標明）。
選 A 落地後應把它刪掉。

**選項 C —— 蒐集面硬閘：Assessment 模式沒填 `participantId` 就不讓開跑。**
根治 ①，但不修 ②（其他六種前提失敗仍然無從歸因），而且會改變操作流程。應與 A 併用而非取代。

**兩面都要處理**：A 修診斷、C 修蒐集。只做 A 的話下一批資料還是進不了趨勢，只是這次知道為什麼。

## 5. 遺留 OQ

- **OQ-KI34-1**：`meta.session` 缺席的既有匯出有多少？若歷史資料庫裡已有一批，補填 `participantId`
  是否可行（`startedAt` + 機器可推）還是一律作廢？這決定 C 是否需要一支回填工具。
- **OQ-KI34-2**：`participantId` 應否對 **Assessment** 模式成為 `collectMeta()` 的必填？
  [`metadata.ts:717`](../../src/data/metadata.ts#L717) 目前只在 `session` 區塊存在時驗證其內容，
  不驗證區塊本身是否存在。改成必填會讓 practice run 也被擋，需先確認 practice 路徑不共用它。
- **OQ-KI34-3**：本次的三份真人 run 是否要補一個 `participantId` 後重跑以取得 cohort key？
  **本 stage 不做** —— 補填等於偽造採集紀錄；正確做法是下一批錄製時填好。
