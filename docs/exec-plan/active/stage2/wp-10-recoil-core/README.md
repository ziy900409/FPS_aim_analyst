# WP-10 — recoil-core:後座力數學核心 + golden tests(M5)

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 演算法來源:[研究計畫 Phase 1](../CS2%20壓槍軌跡復刻研究計畫.md)
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | CS2 後座力三層(固定彈道表 / punch 動力學 / 隨機不準度)移植為**純數學 TS 模組**(`src/recoil/`,零 three/DOM 相依),以 golden tests 釘死正確性 |
| **里程碑** | **M5**:golden 全綠 → 之後所有整合問題可歸因到接線,不歸因到公式 |
| **相依** | 無(階段 A M4 ✅ 已達成;可立即開跑) |
| **對應 FR** | FR-B1(彈道表)、FR-B2(punch 動力學)、FR-B3(inaccuracy)、FR-B4(recoil index 衰減) |
| **估時** | 2–3 dev-days |
| **狀態** | 🟡 進行中(T0 ✅, T1 ✅ 2026-07-05) |

---

## 1. 範圍

**In scope**(全部新增,不動既有檔):

```
src/recoil/rng.ts              ← createRan1(Valve CUniformRandomStream 移植)       [T1]
src/recoil/recoilTable.ts      ← generateRecoilTable(64 筆,Lerp 平滑 + 前 4 發抑制) [T1]
src/recoil/punch.ts            ← RecoilState + recoilTick + recoilOnFire            [T2]
src/recoil/spread.ts           ← sampleSpread(三成分 inaccuracy)                    [T3]
src/recoil/*.test.ts           ← golden + 單元測試                                   [T1–T3]
src/recoil/patternViewer.ts    ← 2D 彈道檢查頁(dev-only,production 剝除)          [T4]
tests/golden/recoil/*.json     ← golden fixtures(彈道表前 8 筆、10 發 punch 向量)  [T1–T2]
```

**Out of scope**:`WeaponConfig` 執行期驗證與武器 JSON(WP-11)、simStep 佈線(WP-13)、
相機/射線(WP-12/13)。本 WP 的參數以 inline 常數/測試 fixture 形式存在。

## 2. 介面契約(權威版見 [../README.md §2.3](../README.md))

```ts
export type Rng = () => number;                                  // [0,1) seeded;禁 Math.random
export function createRan1(seed: number): Rng;
export function generateRecoilTable(p: WeaponRecoilParams): readonly RecoilTableEntry[]; // 恆 64 筆
export function recoilTick(s: RecoilState, dtSec: number): void; // dtSec 恆 1/64(OQ-S2-1)
export function recoilOnFire(s: RecoilState, w: WeaponRecoilLike, table: readonly RecoilTableEntry[]): void;
export function sampleSpread(s: RecoilState, w: WeaponInaccuracyLike, speedRatio: number, rng: Rng): { x: number; y: number };
```

單位:模組輸出 **degree**(Source 慣例:pitch 正值朝下);`degToRad` 與符號翻轉由 WP-13 接線處一次完成,本 WP 不做。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| ran1 常數/流程與 Valve 原版有一字之差 | 整張彈道表全錯且難察覺 | T1 先鎖 golden(seed 223)再往下;T4 檢查頁人工比對 pattern 形狀(直升 9 發 → 左右之字) |
| punch 積分順序錯(decay/kick/leapfrog 次序) | 10 發向量對不上 | T2 依研究計畫順序逐步實作,golden ±0.01° 把關 |
| 衰減公式誤用變動 dt | 換 FPS 漂移 | 契約:`recoilTick` dtSec 恆 1/64(../README.md §2.4);測試斷言非 1/64 拋錯或文件化 |

## 4. Task 索引(每 task 一個自足檔;開檔即可執行)

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | M4 確認 + OQ-S2-1/S2-6 拍板 + GD-5/文件對帳落地 | — | Low |
| **T1** | [T1-ran1-recoil-table.md](T1-ran1-recoil-table.md) | `createRan1` + `generateRecoilTable` + golden(seed 223) | T0 | ✅ |
| **T2** | [T2-punch-dynamics.md](T2-punch-dynamics.md) | `RecoilState`/`recoilTick`/`recoilOnFire` + 10 發 golden 向量 | T1 | High |
| **T3** | [T3-spread-inaccuracy.md](T3-spread-inaccuracy.md) | `sampleSpread` 三成分 + seeded RNG | T1 | Low |
| **T4** | [T4-pattern-viewer.md](T4-pattern-viewer.md) | 2D 彈道檢查頁(dev-only) | T2, T3 | Low |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | **M5 門**:golden 全綠 + 文件回填 | T1–T4 | — |
