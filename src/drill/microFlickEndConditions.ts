import type { DrillConfig } from './DrillConfig.ts';
import { microFlickThreeTargetTestV1 } from './micro_flick_three_target_test_v1.ts';
import { microFlickThreeTargetTestV2 } from './micro_flick_three_target_test_v2.ts';
import { microFlickThreeTargetTestV3 } from './micro_flick_three_target_test_v3.ts';
import { microFlickThreeTargetTestV4 } from './micro_flick_three_target_test_v4.ts';
import { microFlickThreeTargetTestV5 } from './micro_flick_three_target_test_v5.ts';
import { microFlickThreeTargetTestV6 } from './micro_flick_three_target_test_v6.ts';
import { microFlickThreeTargetTestV7 } from './micro_flick_three_target_test_v7.ts';
import { microFlickThreeTargetTestV8 } from './micro_flick_three_target_test_v8.ts';
import { microFlickThreeTargetTestV9 } from './micro_flick_three_target_test_v9.ts';

/**
 * WP-68 / T2（FR-68.3／FR-68.5）—— micro-flick 家族的 `drillId -> endCondition` 查表。
 *
 * **為什麼需要查表**：`endCondition` 從來沒有進過匯出 `meta`（T0.6 逐欄掃 `src/data/metadata.ts`
 * 確認），所以離線端無法從匯出本身得知這一場是 kill-budget 還是計時制。`deriveOutcome()` 的計分窗
 * **右界**兩者語意不同（v8 的最後一顆被打掉即結束；v9 的鐘還在走），所以這個事實必須取得到，否則
 * `killRateHz` 對計時制 drill 會系統性高估（README §0.2）。
 *
 * **為什麼不改匯出 schema**：那是匯出契約的 additive 變更，應另開 WP（比照 WP-67 對 `meta.opening`
 * 的處理）；夾帶進本 WP 會讓一個切片同時動 schema 與指標語意（D-68.T0-2 駁回路徑 A 的理由）。
 * 形狀比照同檔的 `resolveCycletimeMs()` —— 從匯出取一個穩定 id，再查本 build 的登記表。
 *
 * **值一律讀自 drill module 自己的 config，不得手抄**（D-58-T0-2 的同一條紀律）：手抄的那一刻，
 * 「這個 drill 的結束條件」就有了第二個定義，而離線指標會信錯的那一個。
 *
 * ⚠️ 技術債（README §3.2）：任何 WP 把 `endCondition` 或等價事實加進 `meta` 之後，本表應改讀匯出
 * 並移除 `unknown_end_condition` 旗標。
 */
type EndConditionRosterEntry = readonly [drillId: string, endCondition: DrillConfig['endCondition']];

const END_CONDITION_ROSTER: readonly EndConditionRosterEntry[] = [
  microFlickThreeTargetTestV1,
  microFlickThreeTargetTestV2,
  microFlickThreeTargetTestV3,
  microFlickThreeTargetTestV4,
  microFlickThreeTargetTestV5,
  microFlickThreeTargetTestV6,
  microFlickThreeTargetTestV7,
  microFlickThreeTargetTestV8,
  microFlickThreeTargetTestV9,
].map((variant) => [variant.drill.drillId, variant.drill.endCondition] as const);

/**
 * Exported so `microFlickEndConditions.test.ts` can drive a duplicate roster through it directly:
 * two entries for one id must fail at **module construction**, not silently resolve to whichever
 * came first — the right bound would then depend on import order rather than on the drill's config.
 */
export function buildEndConditionByDrillId(
  roster: readonly EndConditionRosterEntry[],
): ReadonlyMap<string, DrillConfig['endCondition']> {
  const map = new Map<string, DrillConfig['endCondition']>();
  for (const [drillId, endCondition] of roster) {
    const existing = map.get(drillId);
    if (existing !== undefined) {
      throw new Error(
        `Drill ${drillId} declares both '${existing.type}' and '${endCondition.type}' end conditions`,
      );
    }
    map.set(drillId, endCondition);
  }
  return map;
}

/** drill -> 該 drill 自己宣告的結束條件。不在表內 ⇒ 離線端一律具名 `unknown_end_condition`。 */
export const MICRO_FLICK_END_CONDITION_BY_DRILL_ID: ReadonlyMap<
  string,
  DrillConfig['endCondition']
> = buildEndConditionByDrillId(END_CONDITION_ROSTER);
