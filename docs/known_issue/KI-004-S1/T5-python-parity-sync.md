# T5 — Python `angular.py` 同步 + 閘 ② Python 版 + parity fixture 重產

> 交付 **FR-S1-8 / 10 / 11**(KI-004 §5.1 S1 ④⑤)· 上游:[S1 README §2.4](README.md)
> 依賴:**T4 的 TS 實作已完成**(同一 commit 內;見 T4 的 commit 顆粒度註)。

**In scope**:`research/src/modules/kinematics/algorithms/angular.py` · 其三處呼叫端 · Python 閘 ② 測試 · `research/fixtures/parity/epsilon-synthetic_counterstrafe.json` 重產。
**Out of scope**:`run_pipeline` 的指標語意變更(只改原點,不改分段/欄位)· 新增 Python 分析功能。

---

## 為什麼 parity 綠了還是錯

[BD-004 架構層結論](../BUGFIX-DECISIONS.md):**parity 是一致性閘(A == B),設計上不可能發現 A 與 B 一起錯**。[angular.py:127](../../../research/src/modules/kinematics/algorithms/angular.py#L127) 忠實移植了 TS 的 `origins = (px, eye_height, pz)`,兩側**同樣錯**,相對誤差仍 ≤1e-9 → 閘門綠燈。

⇒ T4 的重點不是「讓 Python 跟上 TS」,而是**讓 Python 也對閉式解負責**(閘 ②),使兩側不再能一起漂。

---

## Steps

### 1. `angular.py` 的 eye origin 契約

- [ ] 依 [README §2.4](README.md) 新增 `EyeOrigin`(frozen dataclass)與 `resolve_eye_origin(...)`,與 TS `resolveEyeOrigin` **逐條同構**:相同優先序(`explicit` → `meta` → `legacy-default`)、**相同的 `'meta'` 成立條件**(`meta.simToWorld` 正有限 **且** `meta.scene.eye` 三分量有限,只拿到一半視為 miss)、相同 fallback(`(0, eye_height ?? 1.6, 0)` 且仍套用 `SIM_TO_WORLD`)、相同 strict 拋錯語意。
- [ ] `SIM_TO_WORLD = 0.01` 落為 module 常數,**僅作 fallback 用**(T2 之後的匯出一律走 `meta.simToWorld`);C-D1 禁止 import TS,TD-3 已入帳,由閘 ② 雙側閉式解綁定。
- [ ] `_geometry()` 的
  ```python
  origins = np.column_stack((px, np.full(len(px), eye_height), pz))
  ```
  改為
  ```python
  offsets = np.column_stack((px, np.zeros(len(px)), pz)) * eye_origin.sim_to_world
  origins = np.asarray(eye_origin.base, dtype=float) + offsets
  ```
- [ ] `epsilon_deg` / `on_target` 的第三位置參數 `eye_height: float = 1.6` 改為 **keyword-only** 的 `eye_origin: EyeOrigin`。**刻意不留位置參數相容** —— 留著就等於留著「靜默用錯原點」的入口。
- [ ] docstring 更新:說明原點為 world domain、由呼叫端提供、S1 期間匯出尚無該欄(指路 KI-004 §2.3)。

### 2. 三處呼叫端

- [ ] [run_pipeline.py:305](../../../research/src/report/run_pipeline.py#L305)(`_epsilon_or_none`)—— 改傳 `eye_origin`,且 **`strict=True`**。若無法解析原點,現行語意是「回 `None`,`mean_epsilon_deg` 欄留空」;沿用該 graceful 路徑(該欄為診斷用、未進教練報告,D-28.13),但必須在輸出中留下可辨識的原因,不得靜默。
- [ ] [notebooks/t2/generate_epsilon_parity.py](../../../research/src/modules/kinematics/notebooks/t2/generate_epsilon_parity.py) —— `build_parity_payload` 的 `eye_height` 參數改為 eye origin;`strict=True`;產出的 `options` 必須含 `eyeOrigin`(`base` / `simToWorld` / `source`),且因合成 fixture 已於 T2 補欄,`source` 應為 **`'meta'`**(若為 `'legacy-default'` 代表 T2 的補欄沒生效,停下來查)。
- [ ] [algorithms/tests/test_angular.py](../../../research/src/modules/kinematics/algorithms/tests/test_angular.py) —— 全面改用新簽名。

### 3. 閘 ② Python 版(FR-S1-10)

- [ ] 以 **T4 完全相同的數字**(`eyeBase = (0, 1.6, 4)`、`simToWorld = 0.01`、`px = 169.25`、`target = (2, 1.5, −4)`、同一組 yaw/pitch)新增 Python 測試,對**閉式解常數**斷言相對誤差 ≤ 1e-9。
- [ ] 一併補 `base.z = 0` 的退化案與 `pz ≠ 0` 案,與 TS 一一對應。
- [ ] 不要用「跟 TS 對表」代替本閘 —— 那正是失效過的機制。

### 4. 重產 parity fixture(FR-S1-11)

- [ ] 執行 generator 重產 `research/fixtures/parity/epsilon-synthetic_counterstrafe.json`。
- [ ] 檢查 diff:`presentations[]` 的 `rmsEpsilonDeg` / `medianEpsilonDeg` / `p95EpsilonDeg` **必然**變動 —— 除了原點修正,T2 還把該合成 fixture 的 eye base 補成 `z ≠ 0`;`tAcquireMs` / `totPercent` / `acquisitionFailure` 若也變動,須歸因(on-target 幾何原點同樣被修正)。
- [ ] 若 T2 選擇把合成 fixture 補欄延到本 task 執行(見 T2 檔末的顆粒度說明),在此一併完成。
- [ ] `tests/golden/research/epsilon-parity.test.ts` 的 `expect(actual.options).toEqual(parityFixture.options)` 現行逐欄比對 `options` —— 新增的 `eyeOrigin` 會自動納入比對範圍;確認 TS 與 Python 的 `options` 序列化形狀一致(欄名、巢狀、數值型別)。

### 5. 回歸(兩側都要綠)

```bash
uv run pytest
```

```bash
npm run test:ci
```

- [ ] `uv run pytest` exit 0(基線 74 passed + 新增案)。
- [ ] `npm run test:ci` exit 0 —— 含 T3 遺留的 `epsilon-parity.test.ts`,此時必須轉綠。
- [ ] `npx tsc --noEmit` exit 0。

### 6. C-D1 複驗

- [ ] `research/` 未 import 任何 TS 模組;`src/` 未 import Python 產物(唯一例外 = committed parity fixture,本來就在)。

---

## Definition of Done

- [ ] `epsilon_deg` / `on_target` 僅接受 keyword-only 的 `eye_origin`;舊的 `eye_height` 位置參數已移除。
- [ ] `resolve_eye_origin` 的 `'meta'` 成立條件與 TS 逐條同構(含「只有一半」退 fallback),有對應測試。
- [ ] 三處呼叫端全部更新;generator 與 `run_pipeline` 走 `strict=True`。
- [ ] Python 閘 ② 存在,數字與 T4 的 TS 版**逐位相同**,各自對閉式解斷言 ≤ 1e-9。
- [ ] parity fixture 已重產,`options.eyeOrigin.source === 'meta'`,diff 已逐項歸因並記入 [progress.md](progress.md)。
- [ ] `uv run pytest` exit 0 · `npm run test:ci` exit 0 · `npx tsc --noEmit` exit 0(案數對照 T0 基線,增量已說明)。
- [ ] C-D1 單向隔離複驗通過。

## Commit message

> T4 + T5 的合併 commit(見 [T4](T4-eye-origin-derivation.md) 的顆粒度註)。

```
fix(ki-004): 離線 ε(t) 量測原點改 world domain + 補正確性閘 ①②

KI-004 / S1 ③④⑤(FR-S1-5/6/7/8/9/10/11)。trackingDerivation 與
detectionDerivation 把射線原點寫死為 (px, eyeY, pz),相對真實 camera pose
有兩個獨立缺陷:D2a 遺漏 camera base offset(field-low eyeZ = 4,恆成立、
與 px 無關),D2b 遺漏 SIM_TO_WORLD(px ≠ 0 時再疊 100×)。以引擎自身的
fire.offsetDeg 為 ground truth 實測:08:03 偏差中位數 12.52°、09:39 67.11°。

改為 eyeOrigin = base + (px, 0, pz) × simToWorld,並抽出 src/metrics/eyeOrigin.ts
為兩個 derivation 的唯一幾何實作(原本 detectionDerivation 另有一份複製)。
base 與 simToWorld 優先讀匯出自帶的 meta.scene.eye / meta.simToWorld,
pre-S1 匯出則由呼叫端顯式提供;來源以 ResolvedEyeOrigin.source 具名揭露,
研究側入口一律 strict。

新增專案先前完全缺席的正確性閘(parity 是一致性閘,無法發現兩側一起錯):
  閘 ① fire.offsetDeg oracle —— |ε − offsetDeg| ≤ 0.5°(修法前紅:12.5°/67°)
  閘 ② eyeBase.z ≠ 0 且 px ≠ 0 的閉式幾何 fixture,TS/Python 各自對閉式解 ≤1e-9

Python angular.py 同步(C-D4),parity fixture 重產。
sim 演進與匯出 schema 零改動;變動的既有期望值逐條歸因於「舊值本來就錯」。
```
