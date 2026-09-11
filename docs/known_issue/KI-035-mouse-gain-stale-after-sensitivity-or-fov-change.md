# KI-035 — 感度／FOV 變更後 `dYaw`/`dPitch` 沿用舊 gain,而 `meta.mouseIntegration` 報新值

> 狀態:🔴 **未修**(2026-09-10 登記)· 類別:量測效度(silent data corruption)
> 修復決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) `BD-035`(尚未開立)
> 發現於:[WP-63](../exec-plan/active/stage13/wp-63-micro-flick-v8-measurement-foundation/README.md) 規劃期稽核

---

## 1. 症狀

操作員若在**載入 drill 之後**才調整感度或 FOV,該次 run 的匯出會同時包含:

- `ticks[].dYaw` / `ticks[].dPitch` —— 以**舊 gain** 積分
- `meta.mouseIntegration.hipStep` / `.adsStep` —— 匯出當下以**新 gain** 重算

兩者不一致,而且**離線無法察覺**:匯出本身沒有任何欄位記錄「積分當時用的是哪組 gain」,
`meta` 那份看起來完全正常。

`ticks[].aim` **不受影響**(由 `CameraController` 即時讀 sensitivity),命中判定、彈道與
sim 決定性亦不受影響 —— 受污染的只有 tick 窗積分角位移這一條資料流。

## 2. 根因

| 位置 | 行為 |
|---|---|
| [`main.ts:493-494`](../../src/main.ts) | `onSensitivityChange` / `onFovChange` **只**呼叫 `cameraController.setSensitivity()` / `setFov()` |
| [`main.ts:744`](../../src/main.ts) | `createDataRecorder({ mouseIntegration: { gain: currentMouseGain() } })` —— 建構當下鎖定一份 gain |
| [`main.ts:1347`](../../src/main.ts) | `loadWeaponById()` 呼叫 `recorder.configureMouseIntegration({ gain: currentMouseGain() })` |
| [`main.ts:1417`](../../src/main.ts) | `activateDrill()` 呼叫同一行 |
| [`main.ts:775`](../../src/main.ts) | `buildCurrentExportPayload()` 以**當下** `settingsPanel.sensitivity` / `.fov` 重新 `resolveMouseGain()` |

⇒ recorder 的 gain 只在**換武器**與**換 drill** 兩個時機更新;感度／FOV 變更**不在其中**。

[`main.ts:712-713`](../../src/main.ts) 的註解明文宣稱:

> 「與 collectMeta 的 `meta.mouseIntegration` 用**同一個 MouseGain 物件**產生
> (buildCurrentExportPayload 內另算一份,值必然相同),故兩者**不可能發散**。」

這個不變式在「載入 drill 後才改設定」這條路徑上**不成立**。註解描述的是設計意圖,不是現行行為。

## 3. 觸發條件與可達性

**觸發**:`activateDrill()` 或 `loadWeaponById()` 之後、`buildCurrentExportPayload()` 之前,
操作員在 Controls 面板調整 sensitivity 或 FOV,且該 run 未再換 drill／武器。

**可達性:高**。Controls 面板在 drill 載入後並未被禁用,而「先載入 drill、試打幾下、再微調感度」
是自然的操作順序。

**影響半徑**:任何消費 `ticks[].dYaw` / `ticks[].dPitch` 的離線分析。已知消費者包含
`deriveRepositioningSuspicion()`(WP-57,`omegaDegPerSec()` 路徑)與規劃中的
[WP-63](../exec-plan/active/stage13/wp-63-micro-flick-v8-measurement-foundation/README.md)
方向預測與路徑長度。

## 4. 為什麼不能靠事後偵測繞過

`meta.mouseIntegration` 只有一組值,沒有時間軸;`ticks[]` 也沒有逐 tick 的 gain 欄位。
唯一的間接線索是拿 `aim` 的差分與 `dYaw`/`dPitch` 對帳 —— 但兩者本來就在不同時鐘域
(`aim` 為顯示率、`dYaw` 為 tick 窗積分),正常情況下也不會逐位相等,無法用來判定發散。

⇒ **這是必須在寫入端修的問題,不是離線端可補救的問題。**

## 5. 候選修法(未拍板,BD-035 決定)

| 方案 | 內容 | 代價 |
|---|---|---|
| **(a) 補接線** | `onSensitivityChange` / `onFovChange` 各加一行 `recorder.configureMouseIntegration({ gain: currentMouseGain() })` | 最小 diff;但 run 進行中改設定仍會讓同一份 `ticks[]` 前後段使用不同 gain(比現況好,但仍非單一真相) |
| **(b) run 進行中鎖定設定** | drill 執行期間停用感度／FOV 控制項 | 語意最乾淨(gain 在 run 內恆定);但改動 UI 行為,須確認不影響既有 E2E |
| **(c) provenance 化** | 在 `meta` 增加 gain 變更事件序列,離線可分段 | 資料最誠實,但要動匯出 schema,成本最高 |

**規劃期傾向 (a) + (b) 併行**:(a) 讓任何時刻的 gain 都是最新值,(b) 讓一次 run 內不會出現兩組 gain。
(c) 留給「確實需要 run 內變更設定」的情境,目前無此需求。

## 6. 驗收(修復時)

- [ ] 新增測試:建構 recorder → 變更 sensitivity → 積分一批 mouse delta → 斷言
      `ticks[].dYaw` 使用**新** gain,且與 `meta.mouseIntegration.hipStep` 對得上
- [ ] 新增測試:同上但變更 FOV
- [ ] 既有 `dYaw`/`dPitch` golden 與四 FPS parity 斷言逐位不變
- [ ] `npm run typecheck` / 全量 Vitest / `vite build` 皆 exit 0

## 7. 相關

- [GD-36](../exec-plan/DECISIONS.md) ④ —— 「閘與被閘的量必須問同一個問題」的同型錯誤:
  一個欄位的名字不保證它描述的是你以為的那段時間。本 KI 是其時間軸版本。
- [WP-63](../exec-plan/active/stage13/wp-63-micro-flick-v8-measurement-foundation/README.md) T2 —— 規劃中的修復落點。
