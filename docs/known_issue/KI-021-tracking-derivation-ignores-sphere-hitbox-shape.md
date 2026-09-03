# KI-021 — on-target 離線推導忽略 `hitbox.shape`：sphere 目標被當成外接立方體，與命中判定不同幾何

> 類型：**correctness bug（已在正式 Assessment drill 上生效，非 latent）**。
> 狀態：🟢 **已修**（2026-09-03，三個 atomic commit：slice A 推導層 sphere 幾何、slice B WP-55 閘門、
> slice C WP-54 config cube→sphere + 文件）。見 [DECISIONS.md GD-30](../exec-plan/DECISIONS.md)。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-021。
> 發現脈絡：WP-54 T6 slice 10 為了 KI-020 把 pilot 目標改成真的角尺寸時，發現 WP-55 的 contact
> derivation 只接受 box（`trackingContact.ts:147`）；追查該限制的來源時發現真正的問題在更底層的
> `trackingDerivation.isOnTarget()`。

## 1. 症狀

`src/metrics/trackingDerivation.ts` 的 `isOnTarget()` 是 **ray/AABB slab test**，
且 `hitboxFromMeta()` 只讀 `widthU/heightU/depthU`、**把 `shape` 丟掉**：

```ts
// trackingDerivation.ts:283-287
function hitboxFromMeta(payload: ExportPayload): HitboxSize | undefined {
  const hitbox = payload.meta.targets?.hitbox;
  if (hitbox === undefined) return undefined;
  return { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU }; // ← shape 沒帶
}
```

`HitboxSize`（同檔 :33-37）也沒有 `shape` 欄位。因此 `shape:'sphere'` 的目標在離線推導裡被當成
**外接立方體**：正面輪廓是邊長 = 直徑的正方形，而真正的球是它的**內切圓**。

**這與命中判定不同幾何**——引擎端 `HitDetector.ts:103-106` 對 sphere 用
`sphere.radius = t.hitbox.width / 2` 做球體相交（WP-46 T2）。

## 2. 為何這是硬約束的違反（不只是「還沒支援」）

- **CLAUDE.md §4 / GD-7 擴充**明文：「`shape:'sphere'` 時命中判定與渲染改用球體相交，但仍須同一個
  `TargetState.hitbox` 單一來源」，且「命中判定（`HitDetector`）與 **on-target 離線推導**
  （`trackingDerivation`）必須使用**同一幾何來源**，不得新增另一套閾值或尺寸常數」。
- **CONTEXT.md §23**（`ε(t)`／on-target 的正規定義）：「**on-target（逐 tick 二元）= 準心射線 ∩
  H1 hitbox（與命中判定同幾何，零新門檻參數）**」。

也就是：權威文件從來就要求 on-target 跟著命中判定的幾何走；目前的實作對 sphere **沒有**照做。
**不需要改 CLAUDE.md 或 CONTEXT.md** ——它們是對的，是實作偏離了它們。

## 3. 影響面（已生效，非假設）

| 消費者 | 是否受影響 | 說明 |
|---|---|---|
| **`spider-shot-v2`（`mode:'assessment'`，正式 drill）** | ❌ **已受影響** | `spider_shot_v2.ts:9-14` 的 hitbox 是 **sphere**（直徑在 8u 距離下對應 **2.0°**）；`spiderShotMetrics.ts:44` 呼叫 `deriveTrackingSamples()`、`:65` 用 `samples.find(s => s.onTarget)?.t` 取 `firstOnTarget` 餵 settle/overshoot 指標。於是 `t_first_on_target` 可能在準心離中心 **1.41°**（正方形對角）時就蓋戳，而真正的球體邊界是 **1.0°** ⇒ **最多寬鬆 41%**，且偏差**方向相依**（軸向正確、對角最寬鬆） |
| `spider-shot-v1` | ✅ 不受影響 | hitbox 未宣告 `shape` ⇒ box，行為本來就正確 |
| WP-54 tracking pilot | ✅ 目前不受影響 | slice 10 刻意用 **cube**（[D-54.40](../exec-plan/active/stage11/wp-54-tracking-pilot/progress.md)）繞過此 bug——正是本 KI 要解除的權宜之計 |
| WP-55 contact derivation | ⚠️ 被此 bug 擋住 | `trackingContact.ts:141-152` `hasValidHitbox()` 對 `shape:'sphere'` 回 `'invalid-hitbox'`、整份 payload 排除。這個閘門是**正確的防線**（寧可排除也不要用錯幾何靜默算），但它讓 sphere 目標的 drill 全部進不了 coverage |
| `holdClickMetrics` / `researchMetrics` | ⚠️ 需逐一確認 | 同樣 import `deriveTrackingSamples`；落地時應檢查其消費的 drill 是否有 sphere hitbox |

## 4. 修法（三步，box 路徑逐位不變）

### 4.1 `shape` 流進 derivation（`trackingDerivation.ts`）

```ts
export interface HitboxSize {
  width: number; height: number; depth: number;
  shape?: 'box' | 'sphere';   // 省略 = 'box'（既有行為逐位不變）
}
// hitboxFromMeta(): 補帶 shape
return { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU, shape: hitbox.shape };
```

### 4.2 `isOnTarget()` 加 ray/sphere 分支，鏡射引擎語意（`radius = width/2`）

`aimForward()` 回單位向量（`sin/cos` 組合），故可用簡化式；結尾的 `t ≥ 0` 語意與現有 box 分支的
`tmax >= Math.max(tmin, 0)` 對齊（含「原點在球內」）：

```ts
if (options.hitbox.shape === 'sphere') {
  const r = options.hitbox.width / 2;
  const lx = target.x - ox, ly = target.y - oy, lz = target.z - oz;
  const tca = lx * dir.x + ly * dir.y + lz * dir.z;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return false;
  const thc = Math.sqrt(r * r - d2);
  return tca + thc >= Math.max(tca - thc, 0);
}
```

> `epsilonDeg` **不需要改**：它走 `angularEccentricityDeg()`（準心射線 vs 目標**中心**的夾角），
> 與 hitbox 形狀無關。只有 `onTarget` 及其衍生（TOT、`tAcquireMs`、drop/reacquire、
> spider-shot settle/overshoot）會變。

### 4.3 放寬 WP-55 的閘門（`trackingContact.ts:147`）

接受 `'sphere'`，但**同時要求三軸相等**（鏡射 `schema.ts:243` 的 sphere 規則），否則畸形 sphere 會
靜默只用 `width`：

```ts
(metaHitbox.shape === undefined || metaHitbox.shape === 'box' ||
 (metaHitbox.shape === 'sphere' &&
  metaHitbox.widthU === metaHitbox.heightU && metaHitbox.heightU === metaHitbox.depthU))
```

## 5. 測試（修前紅 / 修後綠）

1. **corner fixture（關鍵）**：一條射線穿過立方體角落區、落在內切球外 ⇒ box 判 on-target、
   sphere 判 off-target。這是唯一能證明 `shape` 真的生效的斷言，同時量化那 √2 anisotropy。
2. **與 `HitDetector` 同幾何（GD-7）**：同一個 `meta.targets.hitbox` 同時驅動兩者；
   同一組 (origin, dir, target, hitbox) 下 `isOnTarget()` 與 `raycastWithRay()` 的 sphere 判定一致。
3. **box 逐位不變**：`shape` 省略/`'box'` 時所有既有 T3/spider-shot 斷言不動（改動 additive）。
4. **畸形 sphere**（三軸不等）仍被 `'invalid-hitbox'` 擋下。
5. **WP-55 coverage**：`keeps WP-54 candidate drills as contact-contract compatibility evidence
   only` 由 `includedRunCount: 0` 回到 `2`。
6. **spider-shot-v2 迴歸**：`firstOnTarget` 在 sphere 幾何下不早於 box 幾何（單向不等式），並用
   合成 fixture 鎖住至少一個「box 會誤判 on-target、sphere 不會」的 tick。

## 6. DoD

- [x] §4.1–4.3 落地，§5 六項測試修前紅／修後綠（每片都先在工作區證實紅，再與修法合併為單一綠 commit，BD-001 慣例）。
- [x] 確認 `holdClickMetrics`/`researchMetrics` 消費的 drill 是否含 sphere hitbox（slice B 稽核，2026-09-03）：
  - **`holdClickMetrics` — 不受影響，且本 KI §3 的前提有誤。** 它**沒有** import `deriveTrackingSamples`（實測：`grep -rn deriveTrackingSamples src/ --include=*.ts` 的非測試命中檔為 `researchMetrics` / `spiderShotMetrics` / `trackingContact` / `trackingDynamics` / `trackingPilotEvidence`，不含 `holdClickMetrics`）；它走的是 `deriveVisibilityTimeline`（`visibilityDerivation`）。
  - **`researchMetrics` — 不受影響。** `computeCurveMetrics()`（:163）雖然呼叫 `deriveTrackingSamples`，但只讀 `sample.epsilonDeg`（:170）——該量走 `angularEccentricityDeg()`（準心 vs 目標**中心**夹角），與 shape 無關；它不讀 `onTarget`。
  - **其餘 `onTarget` 消費者（都已涵蓋）**：`spiderShotMetrics`（slice A）、`trackingContact`（slice B）、`trackingDynamics:436-445`（first-on-target / drop-reacquire，隨 slice C 的 WP-54 config 一起改變，屬預期內）、`trackingPilotEvidence`（只透傳 samples trace）。
- [ ] **新發現（latent，非本 KI 根因，待使用者裁定是否開 KI-022）**：`src/scene/occlusionGeometry.ts` 的 `visibleFractionForTarget()`（:128-143）的 9-sample 對 8 個**外接立方體角點**取樣，同樣**不讀 `shape`**（對 sphere 而言那 8 點在半徑 √3·r 處，全在球外）。目前是 **latent 而非 live**：有 `visibility` 設定的 drill（`hold_click_v1`、`peek_click_transfer_*`）hitbox 全是 box，而唯一的 sphere drill `spider_shot_v2` 沒有 visibility/occlusion 設定；slice C 的 WP-54 pilot 也沒有（`tracking_core_pr_pilot_v1` 無 `visibility`/`sceneId`）。依本檔 §7，這**不是**同一根因的另一個消費者（不同函式、不同構念：occlusion coverage 非 on-target），也沒有在任何現行資料上算錯數字，故本次**不**自行開 KI-022；但一旦有人給 sphere drill 加 visibility 設定，它會静默高估曝光面積。
- [x] `spider-shot-v2` 既有 metrics 語意變更記入 **wp-46 progress**（D-46.5 + 一則 Progress 條目）——選 WP-46 而非 WP-36/WP-44，因為 sphere hitbox 是 WP-46 引入的（D-46.1 拍板 GD-7 擴充）。已標註 pre-fix 匯出檔的 settle/overshoot/`movementTimeMs` 係 box 幾何、不可與修後資料直接合併；`analysis-spider-shot.md` 同步補上同一則警告。
- [x] WP-54 hitbox 由 cube 改回 sphere（GD-30）——**已在 9 個 block 重跑之前落地**，排序硬約束滿足。`trackingPilotAngularSizeToEdgeU`→`trackingPilotAngularSizeToDiameterU`、`cubeHitbox()`→`sphereHitbox()`；直徑等於原 cube 邊長，故 `widthU`（0.13964u @2.0°/4u）逐位不變，e2e 斷言不動、只加 `shape` 斷言。
- [x] 回寫 `docs/operational/analysis-tracking.md`（刺激語意表 **+ §on-target 本體**——該節原本明文只寫 ray/box slab test，是這個 bug 的 prose 對應面）與 `analysis-spider-shot.md`（WP-46 節補上「同幾何當時只落實到命中判定與渲染、推導層漏掉」的更正）。
