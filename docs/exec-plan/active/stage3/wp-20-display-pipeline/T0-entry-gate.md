# T0 — Entry gate(GD-10 收斂驗證 + 效能地板起點 + 硬約束回寫)

> Part of [WP-20 display-pipeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(可與 WP-19 並行開跑) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [CLAUDE.md](../../../../../CLAUDE.md) §4 + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ⬜ |

## Objective

動 renderer 尺寸鏈之前先鎖:現行 resize/pixelRatio 路徑現況、效能地板起點值
(OQ-S3-1)、frames 匯出形式(OQ-S3-4)、`meta.display` 落點與 WP-16 的對帳。

## In scope
- **現況驗證**:`main.ts` resize()/`setPixelRatio(min(dpr,2))` 現行行為、`SceneManager.resize`
  只管 aspect 的分工,grep/讀碼證據記 progress——T1 改動的基線。
- **OQ-S3-1**:效能地板起點定稿(計畫預設 warmup p95 ≤ 8.33ms;drill 中 suspect 門檻同值),
  記 ledger + 回填 [../README.md §8](../README.md);標注「pilot 後校準」。
- **OQ-S3-4**:frames 匯出形式定稿(JSON 完整序列 + 摘要 p50/p95/p99/超標窗數;CSV 只摘要)。
- **OQ-20.1 / OQ-20.2**:容量常數與更新率估計法;`meta.display` 區塊縫與 WP-16 T1 對帳
  (縫歸 WP-16、填值歸本 WP;WP-16 未開跑則於其 progress 互記)。
- **CLAUDE.md §4 回寫**:「解析度/場景切換僅 render/UI/data 層,sim 狀態演進不受影響」。
- 本機基線量測:現行(native 模式等效)idle + drill 的 frame time 粗測記 progress
  (效能地板合理性 sanity check)。

## Out of scope
- 任何 `src/` 變更;fullscreen/gate 實作(T2)。

## Steps

- [ ] `npm run test` 乾淨基準 exit 0 記 progress。
- [ ] resize/pixelRatio 現況證據記 progress。
- [ ] OQ-S3-1 / OQ-S3-4 / OQ-20.1 / OQ-20.2 決議記 ledger + §8 回填。
- [ ] CLAUDE.md §4 追加一條硬約束(與本 task 同 commit)。
- [ ] 本機 frame time 粗測基線記 progress。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:現況證據、四條 OQ 決議(明確數值/文字,非「傾向」)、基線量測;
  CLAUDE.md §4 含新約束;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-20): T0 entry gate — GD-10 收斂 + 效能地板/frames 形式決議 + 硬約束回寫`
