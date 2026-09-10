# WP-62 T0 — Entry gate：基線復現、編號重查、決策凍結

## Objective

在動任何程式碼之前，證明上游 exit-gate 仍為綠燈、確認 WP／GD 編號在**寫入當下**未被平行 session 取用、把 D-62-1～4 凍結入全域帳本，並排除與平行 session 的檔案熱區衝突（協議 §3.6）。

## Steps

1. **上游 gate 復現**：WP-58 T-exit 為本 WP 的唯一上游（Session Plan 排程層）。跑一次全量基線並把**實際數字**記入 `progress.md`：
   - `npm run typecheck`（兩個 tsconfig）、`npm run build`
   - 全量 Vitest（WP-58 T-exit 記錄為 2,688 passed／2 skipped；**以本次實測為準**，不得沿用文件數字）
   - 全量 Playwright（WP-58 T-exit 記錄為 99 passed）
   ⚠️ 注意 `npm run typecheck` **只掃 `src/` 與 `server/`**，不含 `scripts/` 與 `tests/`；本 WP 若在 `tests/` 新增型別，須另行確認。
2. **編號重查**（GD-35 ② 紀律，已四度應驗）：於寫入當下重新查 `docs/exec-plan/DECISIONS.md` 的最大 `GD-n` 與全 repo 最大 `WP-n`。規劃期寫定的 **WP-62 / GD-38 一律視為佔位符**；若被取用則依 GD-15「先採納先得」順延，並回改本 WP 全部檔案的編號。
3. **平行 session 檢查**：確認沒有其他 session 正在改本 WP 的熱區——
   - `src/session/*`、`src/ui/SessionPlanSetup.ts`、`src/main.ts`、`src/data/metadata.ts`
   - `.worktrees/` 下是否有含這些檔案的未合併 worktree（已知 `wp-60-raw-mouse-t1` 存在）
   索引檔（stage README、`task-checklist.md`、`graphify-out/`）若衝突，只 stage 自己那幾行。
4. **決策入帳**：把 §1.4 的 D-62-1～4 與「落點為 stage13（主題不符，依使用者指示）」寫成 `GD-38` 條目進 [DECISIONS.md](../../../DECISIONS.md)。
5. **OQ 處置**：OQ-62.1／62.2 標為「T4 開工前需 owner 答覆，未答覆則採預設假設」；OQ-62.3 標為 T1 開工時由實作者決定並記錄。三者皆**非阻塞**。
6. **CodeGraph blast radius 對帳**：對 `activateDrill`、`compileSessionProgram`、`SessionRunnerOptions`、`SessionPlanItemMeta` 各跑一次 impact 查詢，與 README §0.1 的表對帳；有出入即更新 README。

## Invariants

- 不改任何 `src/` 程式碼。
- 編號一律以查詢當下的最大值為準，不沿用規劃文件寫定值。
- OQ 全部標 owner；未答覆者有明文的預設假設，不得留白。

## Definition of Done

- [ ] 基線四項指令的**實際輸出數字**記入 `progress.md`（typecheck ×2、build、Vitest passed/skipped、Playwright passed），皆 exit 0
- [ ] `DECISIONS.md` 新增 `GD-n` 條目（含 D-62-1～4 + stage13 落點說明），且該編號經寫入當下重查確認未被取用
- [ ] 若編號順延，本 WP 全部檔案（README／T0–T6／T-exit／checklist／progress）已同步改號，`grep -r "WP-62\|GD-38"` 無殘留舊號
- [ ] 熱區檢查結果記入 `progress.md`：列出 `src/session/`、`SessionPlanSetup.ts`、`main.ts`、`metadata.ts` 的最近 commit 與是否有平行未合併變更
- [ ] OQ-62.1／62.2／62.3 各有 owner 與預設假設，記入 `progress.md`
- [ ] README §0.1 blast radius 與 CodeGraph 實查結果一致（有出入則已回改）

## Commit

```text
docs(wp-62): T0 entry gate, baseline replay and decision freeze
```
