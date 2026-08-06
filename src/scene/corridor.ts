/**
 * corridor 越界純觀測判定 —— world domain 比較(KI-004 / S1 T3,FR-S1-3)。
 * `playerX` 為 sim domain(source unit),`halfWidthU` 為 world domain(KI-004 §5.1 D1-Option A);
 * `simToWorld` 是兩域間唯一換算橋樑(`src/loop/constants.ts` 的 `SIM_TO_WORLD`)。
 * `main.ts` 與測試共用此唯一定義,避免第二份比較式(KI-004 的病根)。
 */
export function isOutsideCorridor(playerX: number, halfWidthU: number, simToWorld: number): boolean {
  return Math.abs(playerX) * simToWorld > halfWidthU;
}
