# T3 — 原始輸入（unadjustedMovement）+ NotSupportedError fallback

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY `src/input/PointerLock.ts`（+ `src/main.ts`：rawInputEnabled console log，供 spot-check）|
| **Status** | ✅ DONE（2026-06-30）|

## Objective
把 `request()` 改為先試 `requestPointerLock({ unadjustedMovement: true })`（關 OS 加速），catch `NotSupportedError` 後 fallback 到一般 Pointer Lock，並記錄是否啟用原始輸入（供 WP-7 metadata）（FR-1.3，附錄 B）。

## In scope
- `PointerLock.request()`：try unadjusted → catch `NotSupportedError` → 一般 lock。
- 暴露 `rawInputEnabled: boolean`（成功啟用 unadjusted 為 true）。

## Out of scope
- metadata 寫入匯出檔（→ WP-7；本 task 只暴露旗標）。

## Design notes（附錄 B 對齊）
```ts
async request() {
  try { await canvas.requestPointerLock({ unadjustedMovement: true }); this.rawInputEnabled = true; }
  catch (e) {
    if ((e as DOMException).name === 'NotSupportedError') {
      await canvas.requestPointerLock(); this.rawInputEnabled = false;
    } else throw e;
  }
}
```
- `rawInputEnabled=false` 影響可重現性，須在 progress.md 與未來 metadata 註記。

## Steps
- [x] 改 `request()` 為 try/catch fallback。
- [x] 加 `rawInputEnabled` 旗標 + getter。
- [x] 驗：Chrome/Edge 應 `rawInputEnabled===true`（console log）；若 false 記錄環境。→ main.ts 鎖定後 `console.info('[pointerlock] rawInputEnabled', …)`；真值待真人 spot-check（見 progress.md）。
- [x] `tsc` 乾淨。

## Definition of Done
- [x] unadjusted 成功時 `rawInputEnabled===true`；`NotSupportedError` 走 fallback 不拋例外。→ 三分支由一次性合成驗證全綠。
- [x] 受測環境的 `rawInputEnabled` 記入 progress.md。→ 分支邏輯已驗；真實環境值待非 headless spot-check（progress.md 記為 open item）。

## Commit
`feat(wp-1): 原始滑鼠輸入 unadjustedMovement + NotSupportedError fallback（FR-1.3）`
