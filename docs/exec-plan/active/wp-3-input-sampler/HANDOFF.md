# Session Handoff — 2026-07-01

> 給下一個 session 的續接說明。讀完即可繼續。**本檔未 commit**（可刪或併入下個 commit）。
> 權威狀態見 [progress.md](progress.md)；本檔只是快速指路。

## 現在在哪

- **Branch**：`wp-3-input-sampler`，**領先 `main` 共 10 個 commit、尚未 push**。工作樹乾淨。
- **WP-3（F1 InputSampler）✅ 完成**（含 T5 exit-gate + 真實瀏覽器 e2e）。頂層索引 [`../../README.md`](../../README.md) §2 WP-3 已翻 ✅。
- 全綠：`tsc --noEmit` exit 0 · `vitest run` **54 passed** · `playwright test input-sampler` **3 passed（真實 Edge）** · `vite build` ✓。

## 本 session 做了什麼（最近 3 個 commit）

1. `2962af5` refactor — T4b 五軸 code review 後補強：simStep 熱路徑零配置（`createSimLoop` 綁定一次 handler 傳入 simStep 選用第 4 參數）+ `dequeueInto` 空防呆。
2. `4ce388b` docs — T5 exit-gate：F1 四項驗收 map 證據、頂層索引 ✅、交棒 WP-5。
3. `cb8eea4` test — 補真實瀏覽器 e2e（`tests/e2e/input-sampler.spec.ts`，Edge 3 passed）+ 手動驗手冊（[manual-verification.md](manual-verification.md)）。為此在 `main.ts` 加 dev-only 觀測縫 `window.__aimDebug`（`import.meta.env.DEV` 守門、production 剝除）+ `src/vite-env.d.ts`。

## 唯一未做的驗證（誠實揭露）

- **鎖定中開火入緩衝的「正向」路徑**：Pointer Lock 需真實使用者手勢、e2e 無法穩定自動化。e2e 只驗了**未鎖定→fire 被閘門擋**的負向。正向請照 [manual-verification.md](manual-verification.md) §B 手動跑一次（`npm run dev` → 點畫面取鎖 → DevTools 觀測 `__aimDebug`）。非阻斷。

## 下一步（二選一）

- **(A) 開 WP-5**（`HitDetector` + 橫移 + 簡化急停，**M2**）：相依 WP-3 ✅ + **WP-4**。⚠️ 先跑 WP-5 的 entry-gate 驗 **WP-4 exit-gate 是否已綠**（WP-4 目前 🟡 規劃完成、未實作）；WP-4/WP-5 相依關係見 [`../../README.md`](../../README.md) §4。若 WP-4 未完成，WP-5 的命中/target 部分會卡住 → 可能要先做 WP-4。
- **(B) 收尾 WP-3**：手動跑 §B 正向 fire 驗證；視需要 `git push` + 開 PR（remote `ziy900409/FPS_aim_analyst`；branch 未 push）；可選把 `active/wp-3-input-sampler/` 移入 `completed/`。

## 續接時務必遵守（CLAUDE.md 硬約束摘要）

- 禁 `Date.now()`（一律 `performance.now()` / `event.timeStamp`）。
- `import * as THREE from 'three/webgpu'`；bootstrap async。
- 三迴圈只透過 `SharedState` 溝通（ADR-2）。
- 決定性：同輸入序列不同 FPS → sim 逐 tick 狀態一致（不斷言 wall-clock）。
- 命名前先對齊 [`../../../../CONTEXT.md`](../../../../CONTEXT.md) 正規術語。
- 一 task = 一垂直切片 = 一原子 commit；先驗證再 commit。
- 編輯 symbol 前跑 GitNexus `impact`（MCP 未連時以 grep 手動評估並註明）。
- **Bash 工具是 Git Bash（POSIX sh）非 PowerShell**：多行 commit message 用 `git commit -F - <<'EOF' … EOF`，別用 PowerShell here-string `@'…'@`（本 session 犯過、已修）。

## 建議的新 session 開場白

> 「接續 `wp-3-input-sampler` 分支。WP-3 已完成（含 e2e），branch 領先 main 10 個 commit 未 push。請讀 docs/exec-plan/active/wp-3-input-sampler/HANDOFF.md 與 progress.md，然後 [開 WP-5 / 收尾 WP-3 並 push]。」
