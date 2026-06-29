# T6 / T-exit — Exit gate

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T5 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-0 狀態）；docs only |
| **Status** | ⬜ TODO |

## Objective

驗證 WP-0 地基整體綠燈、map 規格附錄 E 的相關驗收項、更新頂層索引狀態、交棒 WP-1，並（若 remote 可用）開 PR。

## Steps

- [ ] `npx tsc --noEmit` exit 0。
- [ ] `npx vitest run` 綠燈（`pickBackend` 等單元測試）。
- [ ] `npx playwright test` 綠燈（`isolation.spec.ts`：`crossOriginIsolated === true`）。
- [ ] `npm run build && npm run preview` → preview 頁 `crossOriginIsolated === true`、空場景可見、console 印出 backend。
- [ ] map 下方 4 項 WP-0 驗收 → 證據；勾選。
- [ ] 把 [頂層索引](../../README.md) §2 的 WP-0 狀態翻 ✅；把本資料夾依需要移入 `../../completed/`。
- [ ] 在 progress.md 寫 `Outcomes & Retrospective`（受測 backend、解析度實測值、未決的 D3 host）。
- [ ] （條件性）remote 可用則 `gh pr create`（base `main`）；CI 不可用則記錄本機紅綠燈證據。

## Acceptance criteria（規格附錄 E 相關項）→ evidence

- [ ] `crossOriginIsolated === true`，`performance.now()` 達 5 µs 解析度 → T2（Playwright + `assertIsolation` 實測值）
- [ ] 渲染後端正確偵測（WP-7 metadata seam 就緒）→ T3（console + `pickBackend` 測試 + seam）
- [ ] 空場景可跑、dev/preview 無 error、版本鎖定 → T1（lockfile + `tsc` 乾淨）
- [ ] 線上主機標頭設定就緒（host-agnostic）→ T4（`public/_headers` + 文件；實際 deploy 視 D3）

## Definition of Done

- 4 項 WP-0 驗收全部勾選並有證據在 progress.md。
- 頂層索引 WP-0 狀態 ✅。
- 交棒 note 指向 WP-1（`active/wp-1-fps-pointerlock/`，待建立）。
- PR 開啟或本機綠燈證據記錄。

## Commit

`docs(wp-0): exit gate — 驗收 map + 頂層索引狀態 + 交棒 WP-1`
