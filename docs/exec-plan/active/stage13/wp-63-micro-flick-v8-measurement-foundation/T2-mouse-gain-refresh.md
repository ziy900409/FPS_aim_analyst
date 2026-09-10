# T2 — 修 KI-035：感度／FOV 變更後重設 mouse gain

> WP：[WP-63](README.md) · 估時 1 d · Risk Med · 相依：T0
> 診斷：[KI-035](../../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md) · 修復決策：`BD-035`（本 task 開立）

## 目的

`ticks[].dYaw`／`dPitch` 是本 WP 方向預測（FR-63.11）與路徑長度的唯一資料源。目前它可能與 `meta.mouseIntegration` 發散，而且**離線不可察覺**。

## 根因摘要

| 位置 | 行為 |
|---|---|
| `main.ts:493-494` | `onSensitivityChange` / `onFovChange` **只**呼叫 `cameraController.set*` |
| `main.ts:1347` / `main.ts:1417` | `recorder.configureMouseIntegration()` 只在**換武器**與**換 drill** 時被呼叫 |
| `main.ts:775` | 匯出時以**當下** `settingsPanel` 值重新 `resolveMouseGain()` |

⇒ 「載入 drill 後才調感度」⇒ `ticks[]` 用舊 gain 積分、`meta` 報新 gain。

`main.ts:712-713` 的註解宣稱兩者「不可能發散」——該不變式在這條路徑上不成立。

## Steps

1. **決定修法**（OQ-63.4，預設 (a)+(b) 併行）：
   - **(a)** `onSensitivityChange` / `onFovChange` 各加一行 `recorder.configureMouseIntegration({ gain: currentMouseGain() })`
   - **(b)** drill 執行期間停用 sensitivity／FOV 控制項，使一次 run 內恆為單一 gain
   - 先確認 (b) 是否會讓既有 E2E 轉紅（`tests/e2e/` 內任何在 run 中操作 settings 的案例）。若會，**不得靜默改測試** —— 改採 (a) only 並把「run 內可能有兩組 gain」記為明帳限制。
2. 實作選定的修法。
3. 更正 `main.ts:712-713` 的註解：把「不可能發散」改為描述實際保證（哪些時機會重設、哪些不會）。
4. 新增測試（sensitivity）：建構 recorder → `configureMouseIntegration` 初值 → 變更 sensitivity 觸發 callback → 積分一批已知 mouse delta → 斷言 `ticks[].dYaw` 使用**新** gain，且數值與 `resolveMouseGain(新設定).hipStep` 一致。
5. 新增測試（FOV）：同上，改變 `hipFovDeg`。
6. 新增測試（negative）：**未**變更設定時，`configureMouseIntegration` 不被額外呼叫，`ticks[].dYaw` 逐位不變。
7. 驗證既有 `dYaw`/`dPitch` golden 與四 FPS `TickRecord` 全欄位 parity 斷言**逐位不變**。
8. 開立 `BD-035` 入 [BUGFIX-DECISIONS.md](../../../../known_issue/BUGFIX-DECISIONS.md)：選了哪個修法、為何、是否偏離協議、遺留 OQ。同步把 [KI-035](../../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md) 狀態翻為 ✅ 並補修復連結。

## Definition of Done

- [ ] `npx.cmd vitest run src/data/DataRecorder.test.ts` exit 0，含三條新測試（sensitivity／FOV／negative）
- [ ] 既有 `dYaw`/`dPitch` golden 與四 FPS parity 斷言**未修改**且仍綠（`git diff` 對這些測試檔為空）
- [ ] 若採 (b)：`npx.cmd playwright test --workers=1` exit 0 且 passed 數 ≥ T0 基線，**且未修改任何既有 spec**
- [ ] `main.ts:712-713` 註解已更正為描述實際保證
- [ ] `BD-035` 已入 `BUGFIX-DECISIONS.md`；`KI-035` 狀態已翻 ✅
- [ ] `npm.cmd run typecheck` ×2 與 `npm.cmd run build` exit 0

## Commit

```
fix(wp-63): T2 refresh mouse gain on sensitivity and fov change
```
