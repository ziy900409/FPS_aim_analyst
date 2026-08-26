# T5 — `spider_shot_v2.ts` 數值更新(hitbox / timing / spiderShot / endCondition)

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2, T3, T4 |
| **Risk / Cplx** | Low / Low(純資料值變更,引擎能力已在 T2–T4 就緒;風險在遺漏移除冗餘欄位或 `targets.count` 設太低卡住 spawn) |
| **Touches** | MODIFY `src/drill/spider_shot_v2.ts`、`src/drill/spider_shot_v2.test.ts` |
| **狀態** | ✅ |

## Objective

把 T1–T4 新增的引擎能力實際套用到 `spider_shot_v2.ts`:球體 hitbox(視角直徑 2.0° @ 距離 8u 換算)、`peekTimeoutMs` 改 1750ms、`spiderShot.centerExemptFromTimeout: true`、`endCondition` 改 60 秒時限、`targets.count` 調高避免卡 spawn、移除冗餘的 `timing.timeLimitMs`。

## Steps

- [ ] 新增具名常數,公式留在程式碼(不手打無來源魔術數字):
  ```ts
  const SPIDER_SHOT_V2_DISTANCE_U = 8;
  const SPIDER_SHOT_V2_ANGULAR_DIAMETER_DEG = 2.0; // Aim Lab Ultimate/Standard 1.8°–2.2° 中點,候選值
  const SPIDER_SHOT_V2_HITBOX_DIAMETER_U =
    2 * SPIDER_SHOT_V2_DISTANCE_U * Math.tan((SPIDER_SHOT_V2_ANGULAR_DIAMETER_DEG / 2) * (Math.PI / 180));
  export const SPIDER_SHOT_HITBOX_V2: TargetHitboxConfig = {
    widthU: SPIDER_SHOT_V2_HITBOX_DIAMETER_U,
    heightU: SPIDER_SHOT_V2_HITBOX_DIAMETER_U,
    depthU: SPIDER_SHOT_V2_HITBOX_DIAMETER_U,
    shape: 'sphere',
  };
  ```
- [ ] `spiderShotV2.targets.hitbox`:改為 `SPIDER_SHOT_HITBOX_V2`(取代現行 `SPIDER_SHOT_HITBOX_V1`)。
- [ ] `spiderShotV2.targets.count`:調高至 `300`(OQ-46.1 候選值,60 秒內任何合理擊殺速率都到不了,只是安全上限,非實際結束條件)。
- [ ] `spiderShotV2.timing`:`peekTimeoutMs` 改 `1750`;**移除** `timeLimitMs: 120000`(改由 `endCondition` 單一負責 60 秒時限,避免兩個時間來源)。
- [ ] `spiderShotV2.spiderShot`:新增 `centerExemptFromTimeout: true`。
- [ ] `spiderShotV2.endCondition`:改為 `{ type: 'timeLimit', value: 60000 }`(取代現行 `{ type: 'targetCount', value: 20 }`)。
- [ ] 更新 `spider_shot_v2.test.ts` 既有測試(若斷言了舊的 `hitbox`/`endCondition`/`timing` 值)配合新值改寫;既有「與 v1 seed 不同」「v1 逐位不變」兩個案例保持不變(不涉及本次改動欄位)。
- [ ] 新增測試:①`resolveTargetHitbox(spiderShotV2)` 回傳 `shape:'sphere'` 且三軸相等;②`spiderShotV2.spiderShot.centerExemptFromTimeout === true`;③`spiderShotV2.endCondition.type === 'timeLimit'` 且 `value === 60000`;④`spiderShotV2.targets.count` 大到不會在 60 秒典型擊殺速率下提前耗盡(可用簡單算術斷言,如 `count * 最短合理單發時間 > 60000` 的反向驗證,或直接斷言數值 ≥ 某下限)。
- [ ] `main.ts` 確認 spider-shot-v2 註冊處無需改動(T3 已讓 `setShape` 讀 `config.targets.hitbox?.shape`,本檔案改動後應自動套用,不需要額外接線)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `spiderShotV2` 的 hitbox 為 sphere、直徑由公式算出(非手打數字) | code review + 新測試 |
| ② | `endCondition` 為 60 秒時限 | 新測試 |
| ③ | `centerExemptFromTimeout: true` | 新測試 |
| ④ | `targets.count` 不會在 60 秒內提前耗盡 spawn | 新測試/推算 |
| ⑤ | `spider-shot-v1` 完全不受影響(既有「v1 逐位不變」案例維持綠燈) | 既有測試零修改全綠 |
| ⑥ | `npm run test:ci` 全綠 | 執行確認 |

## Commit

`feat(wp-46): T5 — spider_shot_v2 數值更新(sphere hitbox / 60s 時限 / center 免逾時)`
