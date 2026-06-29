# CLAUDE.md — 專案執行協議與導航

> 本檔每個 session 開場即載入,是 agent 的**程序記憶 (procedural memory)**:固化「怎麼在這個 repo 做事」與「去哪找知識」。保持精簡。
> 文件語言:**繁體中文,技術術語保留英文原文**(決策 D4)。

---

## 1. 專案一句話

瀏覽器中執行的第一人稱 **counter-strafe(反向急停)瞄準訓練器**(Three.js `WebGPURenderer` + TypeScript + Vite)。精準採集鍵鼠輸入與遊戲狀態,量測「急停時機」與「首發命中」,匯出資料供研究分析。階段 A 交付 F1–F4 + 1 個 counter-strafe drill。

---

## 2. 文件導航(知識去哪找)

| 想知道 | 看這裡 |
|---|---|
| 全部文件目錄 / 導航 | [docs/MAP.md](docs/MAP.md) ← **先看這個** |
| 專有名詞 / 正規術語(semantic memory) | [CONTEXT.md](CONTEXT.md) |
| 需求 / ADR-1~9 / WBS(source of truth) | [docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) |
| 大框架計畫 / 決策 D1–D5 / 架構總覽 | [docs/PLAN.md](docs/PLAN.md) |
| 可執行任務(要做什麼) | [docs/exec-plan/README.md](docs/exec-plan/README.md) → `active/wp-N-*/` |
| 全域決策 / 跨文件矛盾帳本 | [docs/exec-plan/DECISIONS.md](docs/exec-plan/DECISIONS.md) |

**命名任何東西前**(變數/函式/類別/檔案/欄位),先對齊 [CONTEXT.md](CONTEXT.md) 的正規術語。

---

## 3. 執行協議(怎麼做事)

> 沿用 [exec-plan/README.md §5](docs/exec-plan/README.md)。違反這幾條 = 破壞專案的記憶與可稽核性。

1. **一個 task = 一個垂直切片 = 一個原子 commit**。先驗證再 commit;當前 task 未 commit 不開下一個。
2. **只開你正在做的 task 檔**(+ 指名原始檔)。單 task context 應 < 40%。
3. 每個 task 檔自帶 **Steps / Definition of Done / Commit message**,照著走。
4. task 完成時:
   - 更新該 WP 的 `progress.md`(Progress / Decision Log / Surprises / Open Questions),與切片一起 stage。
   - 把該 WP `task-checklist.md` 的 **Done** box 翻 ✅。
5. WP 完成:把 [exec-plan/README.md §2](docs/exec-plan/README.md) 該 WP 狀態翻 ✅,視需要把資料夾移入 `completed/`。
6. **跨 WP 先驗上游 exit-gate 已綠燈**(entry-gate task 的職責)。
7. **跨 WP / 跨文件的決策或矛盾** → 寫進 [DECISIONS.md](docs/exec-plan/DECISIONS.md)(per-WP 的寫 `progress.md`,跨界的寫全域帳本)。
8. 里程碑門控:**M1(WP-2 脊椎)未過,不展開 WP-3 之後**。

---

## 4. 不可違反的硬約束(技術)

> 這些是研究效度的前提,任何 task 都不得破壞。出處見規格 ADR。

- **禁用 `Date.now()`**:一律 `performance.now()`(量測時鐘域,ADR-4)。
- **`import * as THREE from 'three/webgpu'`**(非 `'three'`),否則拿不到 `WebGPURenderer`;bootstrap 必須 async(`await renderer.init()`)。
- **cross-origin isolation 必須生效**(`crossOriginIsolated === true`,COOP/COEP),否則計時精度不足、量測資料失效(ADR-4)。
- **決定性 (determinism)**:同一輸入序列在不同 render FPS 下,sim **狀態**(tick index 對應的 position/velocity/命中)一致;**不**斷言 wall-clock 時間戳。
- **三迴圈只透過 `SharedState` 溝通**,互不直接呼叫(ADR-2)。
- **固定佈局紀律**:**輸入緩衝 = 真 ring**(消費後繞圈)、**`DataRecorder` = preallocated arena**(非環狀、drill 內不繞圈);兩者皆固定欄位、物件重用、不 `push` 物件(避免 GC 卡頓)。
- **UI = 純 TS + DOM overlay**(D1),階段 A 不引入 React/Vue/Lit。
- **階段 A 鎖 Chrome/Edge 桌面版**;`event.timeStamp` 與 `performance.now()` 同源可減僅 Chromium 成立。

---

## 5. 記憶分層(這個 repo 如何記憶)

| 層 | 載體 | 寫入時機 |
|---|---|---|
| Working(短期) | 當前 `Tn-*.md` + 指名原始檔 | 執行中,不落盤 |
| Semantic(概念) | [CONTEXT.md](CONTEXT.md) / 規格書 | 新術語或架構概念定案時 |
| Episodic(發生過) | per-WP `progress.md` + git history | 每個 task 完成 |
| 全域決策/矛盾 | [DECISIONS.md](docs/exec-plan/DECISIONS.md) | 跨 WP/跨文件的決策或不一致 |
| 程序(怎麼做) | 本檔 + task 內建 DoD | 協議變更時 |
