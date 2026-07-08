# T0 — Entry gate(GD-6/9 收斂驗證 + 資產選型 + 硬約束回寫)

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(stage3 首個可開跑 task) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [CLAUDE.md](../../../../../CLAUDE.md) §4 + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ✅ 2026-07-07 |

## Objective

寫場景程式碼之前先鎖三件事:GD-6/9 決議與現行程式碼的收斂點(SceneManager 現況、
sim 對場景零知識的證據)、資產選型(OQ-S3-3,T2 的輸入)、硬約束回寫 CLAUDE.md
(場景幾何不進 sim / 授權白名單)。

## In scope
- **上游驗證**:M4 ✅ 證據連結;`src/sim` 全目錄無場景 import、無位置 clamp 的現況
  grep 證據記 progress(GD-6「純裝飾是既有本體論」的基線)。
- **資產選型(OQ-S3-3)**:列 3 候選(CC0 / CC-BY 各至少一),逐項記:授權類別、
  來源 URL、三角形/材質量級、雜亂度對應(`field-low` 用哪包);選定 1 包記 ledger。
- **OQ-19.1**:`CLEARANCE_MARGIN_U` 與 `playerCorridor.halfWidthU` 預設值定稿
  (計畫預設 0.5u / 由現行 drill strafe 幅度推得),記 ledger。
- **OQ-19.2**:確認 WP-16 T1 是否已留 `meta.scene` optional 區塊縫;未留 → 與 WP-16
  progress 互記對帳(區塊縫歸 WP-16、填值歸本 WP T4)。
- **CLAUDE.md §4 回寫**:「場景幾何永不進 sim runtime(GD-6)」「場景資產授權白名單
  CC0/CC-BY,NC/遊戲抽取/付費包原始檔禁入 repo(GD-9)」兩條硬約束。

## Out of scope
- 任何 `src/` 變更;資產下載(T2)。

## Steps

- [ ] `npm run test` 乾淨基準 exit 0 記 progress。
- [ ] `src/sim` 零場景相依 + 無 clamp 的 grep 證據記 progress。
- [ ] 資產 3 候選比較表記 progress;選定包記 ledger(OQ-S3-3 → [../README.md §8](../README.md) 回填)。
- [ ] OQ-19.1 / OQ-19.2 決議記 ledger。
- [ ] CLAUDE.md §4 追加兩條硬約束(docs 變更,與本 task 同 commit)。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:上游證據、資產選型表 + 選定結論、兩條 OQ 決議(明確文字,非「傾向」);
  CLAUDE.md §4 含兩條新硬約束;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-19): T0 entry gate — GD-6/9 收斂驗證 + 場景資產選型 + 硬約束回寫`
