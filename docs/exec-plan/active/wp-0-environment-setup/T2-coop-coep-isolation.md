# T2 — Cross-origin isolation（COOP/COEP + 斷言）

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY `vite.config.ts`（headers plugin）；NEW `src/env/isolation.ts`；NEW E2E `tests/e2e/isolation.spec.ts` |
| **Status** | ✅ DONE（2026-06-30）|

## Objective

讓 dev + preview server 回傳 `COOP: same-origin` / `COEP: require-corp`，使 `crossOriginIsolated === true`，並把 `performance.now()` 解析度提升到 ~5 µs（ADR-4）。以 Playwright 在**真實瀏覽器**斷言，不靠肉眼（FR-0.2）。

## In scope
- `vite.config.ts` 自訂 plugin：`configureServer` + `configurePreviewServer` 都注入兩個標頭。
- `src/env/isolation.ts`：`assertIsolation()` 回傳 `{ crossOriginIsolated, timerResolutionUs }`，false 時 `console.warn`。
- `main.ts` 啟動時呼叫 `assertIsolation()` 並 console 印出。
- Playwright spec：載入 dev/preview，斷言 `crossOriginIsolated === true`。

## Out of scope
- 線上 host 標頭（→ T4，本 task 只管本機 dev+preview）。
- backend 偵測（→ T3）。

## Design notes

- **dev 與 preview 都要設**：只設 dev 會讓 `vite preview`（T4 部署前驗證）失去 isolation。
- **解析度量測**：連續取 `performance.now()` 差值的最小非零值近似解析度；isolated 應達 ~5 µs，非 isolated 約 100 µs。此值僅供 log/sanity，不作硬斷言（環境噪音大）。
- 硬斷言只放在 `crossOriginIsolated === true`（布林、可靠）。

```ts
// vite.config.ts plugin（核心）
function coopCoep(): Plugin {
  const set = (res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  };
  return {
    name: 'coop-coep',
    configureServer: (s) => s.middlewares.use((_, res, next) => (set(res), next())),
    configurePreviewServer: (s) => s.middlewares.use((_, res, next) => (set(res), next())),
  };
}
```

## Steps

- [x] `vite.config.ts` 加 `coopCoep()` plugin（dev + preview）。
- [x] 寫 `src/env/isolation.ts`：`assertIsolation()`（讀 `crossOriginIsolated`、量解析度、false → warn）。
- [x] `main.ts` 啟動呼叫 `assertIsolation()`，`console.info('[isolation]', status)`。
- [x] 設定 `playwright.config.ts`（webServer = dev + preview，baseURL；channel `msedge`）。
- [x] 寫 `tests/e2e/isolation.spec.ts`：斷言 COOP/COEP 標頭 + `crossOriginIsolated === true`。
- [x] `npm run dev` console 確認 `[isolation] {crossOriginIsolated: true, timerResolutionUs: ~5}`。
- [x] `npx playwright test isolation` 綠燈（2 passed：dev + preview）。
- [x] `npm run build && npm run preview` 後，preview 同樣 `crossOriginIsolated === true`（spec 覆蓋）。

## Definition of Done

- [x] dev + preview 皆 `crossOriginIsolated === true`。
- [x] Playwright `isolation.spec.ts` 通過。
- [x] `assertIsolation()` 量到的解析度記入 progress.md（實測 ≈ 5.0 µs）。

## Commit

`feat(wp-0): COOP/COEP cross-origin isolation + Playwright 斷言（FR-0.2）`
