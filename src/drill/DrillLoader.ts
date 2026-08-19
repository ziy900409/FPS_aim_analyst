import type { DrillConfig } from './DrillConfig.ts';
import { validateDrill } from './schema.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { formatClearanceViolations, validateClearance, type ClearanceOptions } from '../scene/clearance.ts';

export interface DrillLoadOptions {
  readonly clearance?: ClearanceOptions;
}

/**
 * loadDrill — WP-6 / T2（FR-6.2，OQ-6.4）
 *
 * drill 的載入邊界:未信任的來源（JSON 字串 **或** 已解析物件）→ 驗證（T1 `validateDrill`）→
 * `DrillConfig`。這是 F4「換 config 即換 drill」的入口:研究者改 JSON、經此載入,`TargetManager`
 * （config 驅動）即換 drill,零引擎程式碼改動。
 *
 * **失敗即 throw 明確錯誤、不回傳半成品**(OQ-6.4):
 *   - 字串解析失敗 → `DrillConfig 載入失敗: JSON 解析錯誤 — …`
 *   - schema 不合 → `validateDrill` 拋帶欄位路徑的錯誤
 * 呼叫端（DrillRunner,T4）據此**不啟動 drill**,避免不合法 config 污染量測資料。
 *
 * 接受字串與物件兩型:Vite `import x from './x.json'` 給已解析物件;`fetch().then(r=>r.text())`
 * 給字串——兩路皆走同一驗證,避免呼叫端各自 `JSON.parse`。
 */
export function loadDrill(source: unknown, scene?: SceneConfig, options: DrillLoadOptions = {}): DrillConfig {
  let json: unknown = source;
  if (typeof source === 'string') {
    try {
      json = JSON.parse(source);
    } catch (e) {
      throw new Error(`DrillConfig 載入失敗: JSON 解析錯誤 — ${(e as Error).message}`);
    }
  }
  const drill = validateDrill(json);
  if (scene !== undefined) {
    const violations = validateClearance(scene, drill, options.clearance);
    if (violations.length > 0) {
      throw new Error(`DrillConfig 載入失敗: clearance 驗證失敗 — ${formatClearanceViolations(violations)}`);
    }
  }
  return drill;
}
