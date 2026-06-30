# T6 / T-exit — Exit gate

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T5 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-0 狀態）；docs only |
| **Status** | ✅ DONE（2026-06-30）— 最終驗收全綠 + 收口 + 交棒 WP-1 |

## Objective

驗證 WP-0 地基整體綠燈、map 規格附錄 E 的相關驗收項、更新頂層索引狀態、交棒 WP-1，並（若 remote 可用）開 PR。

## Steps

- [x] `npx tsc --noEmit` exit 0。（exit 0 ✅）
- [x] `npx vitest run src/render/createRenderer.test.ts` 綠燈（`resolveBackend` 雙重判定 4 tests）。
- [x] `npx playwright test` 綠燈（`isolation.spec.ts`：dev+preview `crossOriginIsolated === true`；`backend.spec.ts`：實際 backend=webgpu）。**3 passed**。
- [x] `npx vite build` ✓ 且 `diff dist/_headers public/_headers` 無差異；preview isolation 由 playwright 雙 webServer 涵蓋。
- [x] map 下方 4 項 WP-0 驗收 → 證據；勾選（見下方 Acceptance criteria 與 [README §map](README.md)）。
- [x] 把 [頂層索引](../../README.md) §2 的 WP-0 狀態翻 ✅。**資料夾保留在 `active/`**（決策見下方註）。
- [x] 在 progress.md 寫 `Outcomes & Retrospective`（受測 backend=webgpu、解析度 ≈5.0 µs、未決 D3 host）。
- [x] CI/remote PR 為條件性：本機紅綠燈證據已記錄於 progress.md T6 entry；是否開 PR 交使用者裁示。

> **資料夾移動決策（README §5「依需要」）**：保留在 `active/wp-0-environment-setup/` 不移入 `completed/`。理由：(1) 頂層索引與規劃中的 WP-1~9 子資料夾連結皆指向 `active/...`，只移 WP-0 會造成跨檔連結 churn 與斷鏈風險；(2) WP-1 剛要啟動且需頻繁回參 WP-0 既成事實（backend seam / isolation / 學習筆記）。狀態已以 §2 的 ✅ 標示完成，達成「可稽核」目的。日後整批 stage A 收尾時再考慮搬遷。

## Acceptance criteria（規格附錄 E 相關項）→ evidence

- [x] `crossOriginIsolated === true`，`performance.now()` 達 5 µs 解析度 → T2（Playwright dev+preview 3 passed + `assertIsolation` 實測 ≈5.0 µs）
- [x] 渲染後端正確偵測（WP-7 metadata seam 就緒）→ T3（`backend.spec.ts` e2e=webgpu + `resolveBackend` 4 tests + `{renderer,backend}` seam）
- [x] 空場景可跑、dev/preview 無 error、版本鎖定 → T1（lockfile 鎖 `three@0.185.0` + `tsc` 乾淨 + `vite build` ✓）
- [x] 線上主機標頭設定就緒（host-agnostic）→ T4（`public/_headers` == `dist/_headers` + `deploy-headers.md`；實際 deploy 視 D3）

## Definition of Done

- [x] 4 項 WP-0 驗收全部勾選並有證據在 progress.md。
- [x] 頂層索引 WP-0 狀態 ✅。
- [x] 交棒 note 指向 WP-1（`active/wp-1-fps-pointerlock/`，待建立）。
- [x] PR 開啟或本機綠燈證據記錄（本機綠燈已記錄；PR 與否交使用者裁示）。

## Commit

`docs(wp-0): exit gate — 驗收 map + 頂層索引狀態 + 交棒 WP-1`
