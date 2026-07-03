# T0 — Entry gate

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | 無（專案起點） |
| **Risk / Complexity** | Low / Low |
| **Touches** | 只有 docs：`progress.md`、`README.md`（OQ 狀態） |
| **Status** | ✅ DONE（2026-06-30）|

## Objective

在寫任何程式前，證明地基假設成立並鎖定 open questions：開發機具 Node/npm、瀏覽器 WebGPU 可用性、repo 乾淨無既有 `src/`。解 OQ-0.1（npm + Node 版本）、OQ-0.2（`three` 版本可取得）、OQ-0.4（TS/lint 策略）。OQ-0.3（host）維持後定。

## In scope
- 跑驗證指令；數字記進 progress.md。
- 在 [README.md](README.md) §1 + progress.md ledger 翻 OQ-0.1/0.2/0.4 狀態。

## Out of scope
- 任何 `package.json` / `src/` / `vite.config.ts` 等程式檔（→ T1+）。
- 安裝相依（T1 才 `npm install`）。

## Steps

- [x] 確認 Node ≥ 20 LTS：`node -v` = v25.6.1、`npm -v` = 11.9.0 → progress.md。
- [x] 確認 repo 乾淨且無既有前端骨架：根目錄無 `package.json` / `src/`；`git status` 僅 `M CLAUDE.md` + `?? AGENTS.md`（與本 WP 無關）。
- [x] 確認 `three` ≥ r171 可取得：`npm view three version` = 0.185.0（≥ 0.171 = r171）。
- [x] **瀏覽器 WebGPU 探測**：Edge（headless=new）探測 `!!navigator.gpu` → `true` → 受測後端 = **webgpu**。
- [x] **OQ-0.1** 鎖定：npm + Node ≥ 20 LTS → progress.md。
- [x] **OQ-0.2** 鎖定：`three` 0.185.0（≥ r171）→ progress.md。
- [x] **OQ-0.4** 鎖定：`tsconfig` `strict: true` + 最小 ESLint → progress.md。
- [x] 把 OQ-0.1/0.2/0.4 在 [README.md](README.md) §1 Open Questions 與 progress.md ledger 翻為 ✅；加一筆 dated log。

## Definition of Done

- progress.md 記錄：`node -v` / `npm -v` / `npm view three version` / `navigator.gpu` 探測結果 / repo 乾淨確認。
- **PASS 條件**（全部成立；否則 STOP、記錄發現、問使用者再開 T1）：
  `Node ≥ 20` · `three ≥ r171 可取得` · repo 無既有前端骨架 · WebGPU 探測結果已記錄（true 或 false 皆可，但須記下受測後端）。
- OQ-0.1/0.2/0.4 在 README §1 + progress.md 翻 ✅。

## Commit

只 stage 三個 doc 檔；訊息：
`docs(wp-0): T0 entry gate — 鎖定 Node/npm/three 版本與 OQ-0.1/0.2/0.4`
