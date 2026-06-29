# T3 — 原始輸入（unadjustedMovement）+ NotSupportedError fallback

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY `src/input/PointerLock.ts` |
| **Status** | ⬜ TODO |

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
- [ ] 改 `request()` 為 try/catch fallback。
- [ ] 加 `rawInputEnabled` 旗標 + getter。
- [ ] 驗：Chrome/Edge 應 `rawInputEnabled===true`（console log）；若 false 記錄環境。
- [ ] `tsc` 乾淨。

## Definition of Done
- [ ] unadjusted 成功時 `rawInputEnabled===true`；`NotSupportedError` 走 fallback 不拋例外。
- [ ] 受測環境的 `rawInputEnabled` 記入 progress.md。

## Commit
`feat(wp-1): 原始滑鼠輸入 unadjustedMovement + NotSupportedError fallback（FR-1.3）`
