# T0 — Entry gate(三上游全綠驗證)

> Part of [WP-13 sim-camera-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-10 **M5** ✅、WP-11 exit ✅、WP-12 exit ✅ |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs |
| **狀態** | ✅ PASS(2026-07-06) |

## Objective

驗證三條上游全部收斂(這是 stage2 內部唯一的硬門控:**M5 未過不接線**),
並確認本 WP 依賴的具體符號都已存在且形狀正確。

## In scope
- 驗證 wp-10 / wp-11 / wp-12 的 `task-checklist.md` 全 ✅ 與 exit-gate 證據
  (golden 全綠、連發決定性、raycastWithRay 等價測試)。
- 符號存在性抽查(記入 progress):`recoilTick`/`recoilOnFire`/`sampleSpread`/`createRan1`
  (src/recoil)、`fireOneShot`/`SharedState.weapon`(WP-11)、`raycastWithRay`(WP-12)。
- OQ-13.1(spread seed 來源)設計傾向記錄:建議 `drill.sequence.seed` 兼用
  (單一 seed 管 spawn 序列與 spread,匯出只記一值),T1 定案。

## Out of scope
- 任何 `src/` 變更;OQ-S2-4(視覺跟隨)——T2 以開關 + 常數處理,值不阻塞。

## Steps

- [x] 三份上游 checklist 全 ✅;各 exit-gate 的 progress 證據連結記入本 WP progress。
- [x] `npm run test` 當前全綠(exit 0)——接線前的乾淨基準(33 files / 250 tests)。
- [x] 符號抽查(`codegraph_search` 或 tsc import 快查)三組,結果記 progress(7 符號全存在)。
- [x] OQ-13.1 傾向記 ledger(drill.sequence.seed 兼用)。
- [x] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:三上游 ✅ 證據、乾淨基準(test exit 0)、符號抽查結果;
  `git diff --stat` 不含 `src/`。
- 任一上游未綠 → **STOP**,記 blocker,不開 T1。

## Commit

`docs(wp-13): T0 entry gate — M5/WP-11/WP-12 三上游收斂驗證`