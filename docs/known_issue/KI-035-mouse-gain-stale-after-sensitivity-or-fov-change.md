# KI-035 — 感度／FOV 變更後 `dYaw`/`dPitch` 沿用舊 gain,而 `meta.mouseIntegration` 報新值

> 狀態:✅ **已修**(2026-09-10 登記 → 2026-09-14 修復,[WP-63](../exec-plan/active/stage13/wp-63-micro-flick-v8-measurement-foundation/README.md) T2)· 類別:量測效度(silent data corruption)
> 修復決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) **`BD-039`**
> ⚠️ 規劃期本檔與 T2 task 檔都寫「`BD-035`」,那是按 KI 號推的。實況 `BD-n` 與 `KI-n` 不同步,
> `BD-035` 已由 KI-038 取用 ⇒ 依 GD-15「先採納先得」改取 **BD-039**。
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

## 5. 候選修法(規劃期,已由 `BD-039` 拍板,見 §5b)

| 方案 | 內容 | 代價 |
|---|---|---|
| **(a) 補接線** | `onSensitivityChange` / `onFovChange` 各加一行 `recorder.configureMouseIntegration({ gain: currentMouseGain() })` | 最小 diff;但 run 進行中改設定仍會讓同一份 `ticks[]` 前後段使用不同 gain(比現況好,但仍非單一真相) |
| **(b) run 進行中鎖定設定** | drill 執行期間停用感度／FOV 控制項 | 語意最乾淨(gain 在 run 內恆定);但改動 UI 行為,須確認不影響既有 E2E |
| **(c) provenance 化** | 在 `meta` 增加 gain 變更事件序列,離線可分段 | 資料最誠實,但要動匯出 schema,成本最高 |

**規劃期傾向 (a) + (b) 併行**:(a) 讓任何時刻的 gain 都是最新值,(b) 讓一次 run 內不會出現兩組 gain。
(c) 留給「確實需要 run 內變更設定」的情境,目前無此需求。

## 5b. 實際修法(2026-09-14,`BD-039`)

**採 (a) + (b) 併行**,兩者修的不是同一條路徑,缺一不可:

| 修法 | 落點 | 修掉哪條路徑 |
|---|---|---|
| **(a)** | `main.ts` 新增 `refreshRecorderMouseGain()`,`onSensitivityChange`/`onFovChange` 各呼叫一次 | §3 的原始症狀:**載入 drill 之後、取鎖之前**調滑桿(相位為 `idle`/`armed`,(b) 的判準不涵蓋) |
| **(b)** | `SettingsPanel` 新增 `lockAim()`;`main.ts` 新增 `syncAimSettingsLock()`,在 `drillRunner.phase` 為 `countdown`/`running` 時停用兩個滑桿 | run **進行中**改設定(唯一可達路徑 = 跑到一半掉鎖 ⇒ 面板重新顯示) |

兩個實作細節值得記住:

1. **(a) 需要就緒旗標**。`createSettingsPanel()` 在**建構當下**就把兩個預設值推過 callback 一次,
   而 `settingsPanel` 與 `recorder` 在 `main.ts` 都是下方才宣告的 `const`(TDZ)⇒ 直接呼叫會
   `ReferenceError`。`recorderMouseGainWired` 讓那一次推送直接略過;該時刻的 gain 由
   `createDataRecorder({ mouseIntegration: { gain: currentMouseGain() } })` 自己帶,是同一份值。
2. **FOV 半邊只咬得到可開鏡的武器**。`resolveMouseGain()` 的 `hipStep` 只取決於 sensitivity,
   FOV 只進 `adsStep`(`ads.fovDeg / hipFovDeg`)⇒ 無 `ads` 的武器(例如 v8 的 `usp_s_laser`)
   改 FOV 對 `dYaw` 逐位無影響。以 `DataRecorder.test.ts` 的斷言 (4) 釘死。

**未提供回溯修正**:§4 已論證修前的匯出無法事後判定積分用了哪組 gain。凡「載入 drill 後才調過設定」
的舊 run,其 `dYaw`/`dPitch` 一律不可信(`BD-039` 的 OQ-KI35-1)。

## 6. 驗收(修復時)

- [x] 新增測試:建構 recorder → 變更 sensitivity → 積分一批 mouse delta → 斷言
      `ticks[].dYaw` 使用**新** gain,且與 `meta.mouseIntegration.hipStep` 對得上
      (`DataRecorder.test.ts`「sensitivity 變更後,積分用新 gain…」)
- [x] 新增測試:同上但變更 FOV(「FOV 變更後,ADS 態積分用新 adsStep…」)
- [x] 既有 `dYaw`/`dPitch` golden 與四 FPS parity 斷言逐位不變(那些測試檔 `git diff` 為空)
- [x] `npm run typecheck` / 全量 Vitest / `vite build` 皆 exit 0
      (3,233 passed / 2 skipped;數字與 Playwright 兩層閘記於 WP-63 `progress.md` §T2)

## 7. 相關

- [GD-36](../exec-plan/DECISIONS.md) ④ —— 「閘與被閘的量必須問同一個問題」的同型錯誤:
  一個欄位的名字不保證它描述的是你以為的那段時間。本 KI 是其時間軸版本。
- [WP-63](../exec-plan/active/stage13/wp-63-micro-flick-v8-measurement-foundation/README.md) T2 —— 規劃中的修復落點。
