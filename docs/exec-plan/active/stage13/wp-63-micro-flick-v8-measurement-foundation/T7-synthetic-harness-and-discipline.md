# T7 — 合成 harness、FPS parity、tick-rate 敏感度、採集紀律文件

> WP：[WP-63](README.md) · 估時 2.5 d · Risk Med · 相依：T1–T6
> 對應 NFR-63.1／63.2／63.5、README §4.2

## 目的

把整條鏈路的行為釘死在測試裡，並交付操作端的採集紀律 —— 後者不是程式改動，但缺了指標就無效。

## 七種故障型態（README §4.2）

| # | 型態 | 期望行為 |
|---|---|---|
| 1 | 慢速滑移（300 ms 低速滑過去） | 免閾值描述子仍給出有限值（無門檻 ⇒ 不應退化為缺失） |
| 2 | 半路改主意（朝 A 加速→轉向 B 殺 B） | 方向預測準確率隨 `W` **非單調**；L1 對該發標 `intended` 為開火時的 argmin |
| 3 | 一路修正（無明確彈道段） | `signReversalCount` 顯著偏高、`dwellPathRatio` 大、L0 仍完整 |
| 4 | 過衝後回頭再殺 | `reEntryCount >= 1` 且 `signReversalCount >= 1` |
| 5 | 零值交替（模擬 60 Hz aim 更新） | 全部指標與 144 Hz 情形**逐位相同**（本 WP 不依賴 `aim` 連續性） |
| 6 | 停頓再啟動（flick → 停 80 ms → 微調 → 開火） | `approachToFireMs` 不吞掉停頓 |
| 7 | replacement 落在瞄準點附近（2.6° 邊界） | `nearest3Deg` 觸及下界；`replacementEngagedRate` 有反應 |

合成軌跡若需隨機性，一律注入 seeded RNG 並把 seed 寫入 fixture（GD-5）。

## 採集紀律（交付 `docs/operational/analysis-micro-flick.md`）

| 條件 | 硬閘 / 建議 | 缺席後果 |
|---|---|---|
| `meta.displayHz >= 144` | **硬閘（拒收）** | `aim` 更新率不足；[KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) 的完全緩解點 |
| `meta.crossOriginIsolated === true` | **硬閘（拒收）** | 計時精度不足，量測資料失效（ADR-4） |
| `meta.weaponId === 'usp_s_laser'` | **硬閘（拒收）** | 有散布／後座 ⇒ 命中不再是角誤差的純函式（T1） |
| `meta.scene.eye` 存在 | **硬閘（拋錯）** | eye origin 落到 `legacy-default` ⇒ 全部角度量偏移 |
| **先設定感度／FOV，再載 drill** | **操作紀律** | [KI-035](../../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md)；T2 修復後降為建議 |
| `meta.dpi` 自述填寫 | 建議 | 無 cm/360 ⇒ 感度以混淆因子形式偷渡 |
| `?rawMouse=1` | **建議開啟**（OQ-63.3 預設） | 資料先收著作為後續校準的參考真值；**不進本 WP 任何指標定義** |
| practice run 不進 history | 事實 | 匯出 JSON 必須自行保存，沒有 trend |

排除規則（比照既有 quality flags 紀律）：失焦、暫停、非測試輸入、遙測缺口、`recorderOverflow`、`ammo_exhausted_in_window` 各自 reason code；**miss 不整筆刪**。

## Steps

1. 建立七份故障型態 fixture 與對應的具名測試。
2. **NFR-63.2 FPS parity**：同 seed 同輸入序列，在 30／60／144／240 render FPS 下產生 v8 匯出，斷言逐 tick trace 與 `deriveMicroFlickMetrics()` 全部輸出**逐位一致**（`Object.is` 全欄位）。
3. **NFR-63.5 tick-rate 敏感度**：把同一條合成軌跡以 64／128／256 Hz 重採樣，斷言 FR-63.10 四個描述子的相對變異 < 5%。超標的描述子須在 `progress.md` 具名並說明是否降級宣稱。
4. **NFR-63.1 legacy 回歸**：v1–v7 與所有非 population drill 的既有 golden 逐位不變（不得編輯任何期望輸出檔）。
5. 撰寫 `docs/operational/analysis-micro-flick.md`：構念定義、四層指標公式、封閉旗標詞彙表、版本字串、上表的採集紀律與排除規則、以及 [README §5](README.md) 的真人資料誠實邊界。
6. 更新 [`docs/MAP.md`](../../../../MAP.md) 的導航列，加入本 WP 與新分析文件。
7. 執行全量閘。

## Definition of Done

- [ ] 七份故障型態 fixture 各有具名測試且綠，測試名對應 README §4.2 的編號
- [ ] NFR-63.2 四 FPS 逐位一致斷言綠（`Object.is` 全欄位，非抽樣比對）
- [ ] NFR-63.5 三種 tick rate 的相對變異數值記入 `progress.md`，全部 < 5%（超標者具名 + 降級說明）
- [ ] NFR-63.1：`git diff` 對所有既有 golden／期望輸出檔為空
- [ ] `docs/operational/analysis-micro-flick.md` 存在且含採集紀律表與排除規則
- [ ] `docs/MAP.md` 已更新
- [ ] `npm.cmd run typecheck` ×2、`npm.cmd test`、`npx.cmd playwright test --workers=1`、`npm.cmd run build` 四項 exit 0，數字記入 `progress.md` 並與 T0 基線對照

## Commit

```
test(wp-63): T7 close micro flick metric gates with synthetic harness
```
