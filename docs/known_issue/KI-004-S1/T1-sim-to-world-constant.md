# T1 — `SIM_TO_WORLD` 升引擎級常數 + eye world base 單一來源

> 交付 **FR-S1-1 / FR-S1-2**(KI-004 §5.1 S1 ①)· 上游:[S1 README §2.3](README.md)
> 性質:**純重構,零行為變更**。這一刀的價值在於「之後 T2/T3 有東西可以引用」,不在於修好任何 bug。

**In scope**:`src/loop/constants.ts`(新增常數)· `src/scene/eyePose.ts`(新檔)· `src/render/SceneManager.ts`(改為消費純函式)· `src/main.ts`(import 常數取代 module 字面值)· 新增 camera 逐位不變測試。
**Out of scope**:corridor 比較(T2)· 離線推導(T3)· 任何匯出欄位。

---

## 為什麼要拆出 `resolveEyeWorldBase`

KI-004 §2.3 指出射線原點由**三個分處不同層的片段**組成,而三者都不在匯出裡:

| 片段 | 目前持有者 | T1 之後 |
|---|---|---|
| `eyeHeight` / `eyeZ ?? depth/2 − standoff` | [SceneManager.ts:66-68](../../../src/render/SceneManager.ts#L66)(建構子內的 local) | `resolveEyeWorldBase(config)`(純函式,可被離線推導引用) |
| `SIM_TO_WORLD = 0.01` | [main.ts:628](../../../src/main.ts#L628) module 常數,註解自陳「佔位;WP-6 drill config 接管」 | `src/loop/constants.ts`(引擎級具名常數) |
| `player.x / z` | `SharedState`(sim 層) | 不動 |

D2a 的直接成因就是 [KI-002 / D1](../KI-002-br-field-camera-anchor-protocol-load.md) 引入 `eyeZ` 時,**只有 render 那一側被修**。把它變成一個具名純函式,是讓「下一次改 camera 錨定」不可能再只修一半。

---

## Steps

### 1. `SIM_TO_WORLD` 升格

- [ ] 在 [src/loop/constants.ts](../../../src/loop/constants.ts) 新增:

```ts
/**
 * world unit per source unit —— sim domain(Source unit)與 world domain(three.js,≈公尺)
 * 之間的**唯一**橋樑(KI-004 / K-1「雙域 + 顯式換算」)。
 *
 * 幾何(位置 / hitbox / eyeHeight / 場景 / camera)= world domain;
 * kinematics(vx / vStrafe / CS2_PROFILE / residualSpeed)= source unit(CS2 校準活在這裡,不得改)。
 *
 * **不掛 SceneConfig**:掛上去會讓同一 drill 在不同場景產生不同幾何,並讓行為依賴場景資料
 * (KI-004 §5.1;GD-6 精神)。
 */
export const SIM_TO_WORLD = 0.01;
```

- [ ] [main.ts:628](../../../src/main.ts#L628) 的 module 常數刪除,改 import。**保留該處註解的歷史說明**(佔位緣由、為何 250 u/s 需要縮放),但把「佔位;WP-6 drill config 接管」改寫為指向 KI-004 / K-1 的現行決策——那個接管已明確**不會發生**。
- [ ] `grep -n "0\.01" src/` 確認沒有其他作為單位換算用途的字面值殘留。

### 2. `resolveEyeWorldBase` 新檔

- [ ] 新增 `src/scene/eyePose.ts`,實作 [README §2.3](README.md) 的契約:`EyeWorldBase`、`CAMERA_STANDOFF = 1`、`resolveEyeWorldBase(config: SceneConfig): EyeWorldBase`。
- [ ] 語意必須與現行 [SceneManager.ts:66-68](../../../src/render/SceneManager.ts#L66) 逐位等價:

```
x = 0
y = room.eyeHeight
z = room.eyeZ ?? (room.roomSize[1] / 2 − CAMERA_STANDOFF)      // roomSize = [width, depth, height]
```

其中 `room = config.proceduralRoom ?? DEFAULT_PROCEDURAL_ROOM`(沿用 SceneManager 現行的 fallback)。

- [ ] `SceneManager` 建構子改為 `const eye = resolveEyeWorldBase(config); this.camera.position.set(eye.x, eye.y, eye.z);`,`lookAt` 維持現行 `(0, room.eyeHeight, −depth/2)` 不動。

### 3. 逐位不變測試(FM-4)

- [ ] 新增測試(建議 `src/scene/eyePose.test.ts`),對**全部**已註冊場景逐條斷言 `resolveEyeWorldBase` 的三個分量:
  - `field-low` → `(0, 1.6, 4)`(`depth 10 / 2 − 1`)
  - `placeholder-room` / `urban-high` → 依各自 `roomSize`/`eyeHeight` 計算
  - `br-field` → `z = 0`(KI-002/D1 顯式 `eyeZ: 0`)
  > 實際數值以讀取 scene config 為準,**不要照抄本檔**;本檔的 `field-low = 4` 只是 KI-004 §1.2 引用的已知值。
- [ ] 補一條「`SceneManager.camera.position` == `resolveEyeWorldBase(config)`」的斷言,把兩者綁死(防止日後又只改一邊)。

### 4. 回歸

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:ci`

---

## Definition of Done

- [ ] `SIM_TO_WORLD` **只**在 `src/loop/constants.ts` 定義;`src/main.ts` 與後續消費者一律 import。
- [ ] `resolveEyeWorldBase` 為 camera 原點的唯一實作;`SceneManager` 建構子不再自行計算 `standoff` / `eyeZ`。
- [ ] 新增測試對每個已註冊場景逐條斷言 eye base 三分量,且 camera 位置與該函式綁定。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] `npm run test:ci` exit 0,且**零既有測試期望值變更**(T1 為純重構;任何期望值變動即代表行為被改,必須回頭)。
- [ ] `git diff` 不觸及 `src/sim/`、`src/state/SharedState.ts`、`src/loop/SimLoop.ts` 的演進邏輯。

## Commit message

```
refactor(ki-004): SIM_TO_WORLD 升引擎級常數 + eye world base 抽為單一純函式

KI-004 / S1 ①(FR-S1-1/2)。射線原點的三個片段之一(scene 幾何)原為
SceneManager 建構子內的 local 計算,D2a 即源於 KI-002/D1 改了 render
側而離線推導沒跟上。抽為 resolveEyeWorldBase 純函式後,T3 的離線推導
可引用同一定義。

純重構:四場景 camera 初始位置逐位不變(新測試逐條斷言),零測試期望值變更。
```
