# WP-67 T5 — 術語與斷代規則文件化

> C-D3／C-D4 · OQ-67.1 · [CONTEXT.md](../../../../../CONTEXT.md) · 記憶分層 [CLAUDE.md §5](../../../../../CLAUDE.md)

## Objective

把「開場協定」這個構念寫進 semantic memory，並讓分析端在**讀文件時**就知道哪些資料不可混池——而不是等 guard 拋錯才知道。

## 為什麼文件是交付的一部分

guard 擋得住**跑在 Python 裡**的分析；擋不住有人用 Excel 打開兩批 CSV 貼在一起。斷代規則必須同時存在於「程式會擋」與「文件會說」兩處，且兩處講同一句話（C-D4：不得各算一套）。

## Steps

1. **[CONTEXT.md](../../../../../CONTEXT.md) 新增術語**（照既有表格形狀，一行一術語，技術名詞保留英文）：
   - **開場協定（opening protocol，`meta.opening.protocol`）**：`immediate-v0` / `armed-countdown-v1` 各自的定義、對應的受試者體驗、以及「缺席 ≠ v0」這條。
   - 在既有 `DrillPhase` / `countdownRemainingMs` 相關條目旁交叉連結，讓讀到 arming 的人會看到斷代。
2. **`docs/operational/` 斷代規則**：在既有 analysis 文件族中新增（或擴充）一節，寫明：
   - 三個時期的分界與各自的判定依據（`opening` 欄 → `pointerLockLost` 鍵 → 皆無）
   - **混池紅線**：跨協定的開場段指標（`t_acquire` / 首發命中 / 反應時間）不得合併統計；可合併的是與開場無關的段落——並具名列出哪些**是**、哪些**不是**，不要只寫原則
   - 指向 `classify_opening()` 為唯一實作（C-D4）
3. **OQ-67.1 結案**：History Library 是否顯示 protocol。依預設關閉（不做）並寫明理由；若使用者在此時改判 ⇒ **另開 WP，不夾帶**（承 WP-65 T-exit 步驟 5 同一紀律）。
4. **交叉檢查**：新寫的定義與 [README §2.4](README.md) 的 docstring、`OpeningMeta` 的 TS 註解**三處說同一句話**。有任何一處不同即為 C-D4 意義下的第二定義，當場改到一致。

## Definition of Done

- [ ] `CONTEXT.md` 新增「開場協定」術語條目，含三種判定依據與「缺席 ≠ v0」
- [ ] `docs/operational/` 的斷代規則一節已落地，且**具名列出**哪些指標不可跨協定合併、哪些可以
- [ ] 文件明指 `classify_opening()` 為唯一實作（C-D4）
- [ ] OQ-67.1 已結案並寫明理由（關閉或另開 WP，二擇一具名）
- [ ] TS 註解／Python docstring／CONTEXT.md 三處定義逐句一致（在 `progress.md` 貼出三處引文對照）

## Commit

```text
docs(wp-67): define the opening protocol construct and its pooling red line
```
