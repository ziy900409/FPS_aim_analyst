# KI-029 — prop 淨空把 sphere hitbox 當成外接立方體的**角點**半徑：與命中判定不同幾何（KI-021 的第三處未修點）

> 類型：**latent correctness/consistency defect**（方向保守 ⇒ 只會**誤拒**，不會產生錯資料；今日無觀測到的失敗）。
> 狀態：🔴 **診斷完成（2026-09-07），修法待落地**。尚無 `BD-029`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 相關：[KI-021](KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md)（同一病理，已修於**離線推導**層）·
> [DECISIONS.md GD-30](../exec-plan/DECISIONS.md)（WP-54 目標由 cube 改回 sphere）·
> [GD-33](../exec-plan/DECISIONS.md)（房間邊界不在 `validateClearance()` 範圍）。
> 發現脈絡：WP-57 T3 為寬場 arena 寫牆／地板淨空閘時，需要「目標外緣半徑」；沿用既有
> `targetHitboxRadius()` 會讓 README §2.5 全表數字（`1.8604`／`1.3281`／`0.5547`…）全部對不上，
> 追查後發現該 helper 回的是**box 角點半徑**，而它被無條件套用在 sphere hitbox 上。

## 1. 症狀

`src/scene/clearance.ts` 的 `targetHitboxRadius()` 算的是外接立方體的**半對角線**：

```ts
// clearance.ts:42-44
export function targetHitboxRadius(hitbox: TargetHitboxSize): number {
  return Math.sqrt((hitbox.width / 2) ** 2 + (hitbox.height / 2) ** 2 + (hitbox.depth / 2) ** 2);
}
```

`TargetHitboxSize` **帶 `shape: 'box' | 'sphere'`**（`DrillConfig.ts:34-42`，WP-46 T2 引入），但這個 helper
與其唯一消費者都沒有讀它：

```ts
// clearance.ts:56-57（validateClearance）
const hitbox = resolveTargetHitbox(drill);
const propInflationU = targetHitboxRadius(hitbox) + CLEARANCE_MARGIN_U;
```

對三軸相等的球（邊長 = 直徑 = `2r`），角點半徑是 `√3·r ≈ 1.732·r`，而**球的外緣就是 `r`**。
⇒ prop 淨空的膨脹量被高估 `(√3 − 1)·r ≈ 0.732·r`。

**這與命中判定不同幾何**：引擎端 `HitDetector.ts:103-106` 對 sphere 用 `radius = hitbox.width / 2`
做球體相交；`trackingDerivation.isOnTarget()` 也已於 [KI-021](KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md)
改成 ray/sphere。**淨空層是同一個 `shape` 欄位被丟掉的第三個地方，且是唯一還沒修的一個。**

## 2. 根因

KI-021 的修法範圍是「離線推導層 + WP-55 閘門 + WP-54 config」，
**沒有掃過 `src/scene/clearance.ts`**。原因合理：KI-021 的驅動症狀是「on-target 判定過寬 41%」
（會產生**錯的資料**），而淨空層的偏差方向相反（過嚴 ⇒ 只會誤拒載入），不會出現在任何資料稽核裡。
於是它成為一個沒有症狀的殘留點。

`targetHitboxRadius()` 對 box 是**正確**的（H1 預設 `{1,2,1}` 的任意朝向外接半徑就是半對角線），
所以這不是「helper 寫錯」，而是**「box 專用的 helper 被沿用到 sphere」**——與 KI-021 完全同型。

## 3. 影響面（實測）

`validateClearance()` 只掃 `scene.propBounds`（[GD-33](../exec-plan/DECISIONS.md)），故只有
「sphere hitbox 的 drill」×「propBounds 非空的場景」才會被執行到。逐一覆驗：

| drill | hitbox | 綁定場景 | props | 是否可達 |
|---|---|---|---|---|
| `tracking_core_pr_pilot_v1` | sphere | `field-low`（`main.ts` `loadDrillConfigDirect` 釘死） | **16** | ✅ **可達** |
| `tracking_reversal_pilot_v1` | sphere | `field-low` | **16** | ✅ **可達** |
| `spider-shot-v2` | sphere | `placeholder-room` | 0 | ❌ |
| `spider-shot-v3` | sphere | `spider-shot-room` | 0 | ❌ |
| `spider-shot-wide-v1` | sphere | `wide-flick-arena`（WP-57 T3） | 0 | ❌ |
| `micro_flick_three_target_test_v1` | sphere | `micro-flick-room` | 0 | ❌ |

**可達案例的量化**（WP-54 pilot：`distanceU = 4`，角尺寸候選 3.0°／2.0°）：

| 角尺寸 | 直徑 | 正確外緣 `r` | 實際用的角點 `√3·r` | 過度膨脹 | 有效淨空門檻（`+0.5`） |
|---|---|---|---|---|---|
| 3.0° | 0.209487 | 0.104744 | 0.181421 | **+0.076678 u** | 0.681421 vs 正確 0.604744（**嚴 12.7%**） |
| 2.0° | 0.139641 | 0.069820 | 0.120932 | **+0.051112 u** | 0.620932 vs 正確 0.569820（**嚴 9.0%**） |

**後果的正確描述**：淨空閘比它宣稱的幾何**嚴 9–13%**。方向保守 ⇒
① **不會**放行真正會穿模的組合、② **不會**污染任何匯出資料或指標、
③ 但**可能誤拒**一個幾何上合法的 drill×scene 組合，而錯誤訊息會指向某個 prop、
讓人以為是場景道具問題，而不是閘的半徑定義問題。今日 `field-low` × pilot 的 16 個 props
全數通過（`tracking_core_pr_pilot_v1.test.ts` 綠），故**無觀測到的失敗**。

**風險其實在反方向**：WP-57 T3 已在 `src/scene/spiderWideArena.ts` 用 shape-aware 的
`spiderWideTargetRadiusU()`（sphere → `width/2`）。若日後有人「為了一致性」把它改回
`targetHitboxRadius()`，README §2.5 的整張表會對不上而紅燈；反之若有人把 `targetHitboxRadius()`
直接改成 shape-aware，則**box drill 逐位不變、sphere drill 的 prop 淨空會放寬**——那是行為變更，
需要覆驗既有場景×drill 組合仍全綠（見 §4 的驗證要求）。

## 4. 修改計畫（未落地）

**選項 A（建議）—— 讓 `targetHitboxRadius()` shape-aware，單一定義。**
sphere 回 `max(w,h,d)/2`、box 維持半對角線；`resolveTargetHitbox()` 仍是唯一來源（GD-7）。
WP-57 T3 的 `spiderWideTargetRadiusU()` 隨即改為呼叫它，消掉重複定義（C-D4）。
- **必要驗證**：① box drill 的 `propInflationU` 逐位不變（H1 `{1,2,1}` 與所有 `shape` 省略者）；
  ② `field-low` × 兩個 pilot、以及全部既有 scene×drill 組合的 `validateClearance` 仍零違規；
  ③ 新增 sphere 專屬 case 釘住 `r`（非 `√3·r`）；④ WP-57 T3 的 612 落點測試維持綠。
- **代價**：sphere drill 的 prop 淨空會**放寬** 9–13%，屬刻意的行為變更，須在 BD 記名。

**選項 B —— 只在文件與註解記載「box 專用」，呼叫端各自 shape-aware。**
零行為變更、零回歸風險，但保留兩份半徑定義（WP-57 已有一份），下一個寫淨空的人仍會踩。

**選項 C —— 不修，只留本 KI。**
可接受，因為方向保守；但要接受「誤拒時的錯誤訊息會指錯方向」這個除錯成本。

**不建議**：把 `CLEARANCE_MARGIN_U` 調小來抵銷 —— 那會同時放寬 box drill，把一個幾何定義問題
變成一個全域安全邊界問題。

## 5. 遺留 OQ

- **OQ-KI29-1**：選項 A 會放寬 sphere drill 的 prop 淨空 9–13%。`field-low` × WP-54 pilot 目前
  有多少實際餘裕？若某個 prop 原本只差一點就違規，放寬後會從「誤拒」變成「勉強放行」——
  需要量出最小餘裕再決定，不能只看「測試還是綠的」。**待工程量測**（本 KI 未量）。
