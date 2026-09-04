# Technical Specification Template

> 填完後依 `SKILL.md` §4 落點:執行計畫 → `docs/exec-plan/active/stageN/wp-NN-<slug>/`(資料夾,非單檔);
> 跨 WP 穩定決策 → `docs/exec-plan/DECISIONS.md`;bug → `docs/known_issue/`。

## 1. 需求壓縮 (Requirements)
- **Functional Requirements**: 系統必須具備的具體行為與功能(可對應 FR 編號)。
- **Non-functional Requirements**: 效能、精度、可稽核性需求(必須量化)。
- **Constraints**: 既有架構限制、依賴版本、瀏覽器/執行環境封裝。
- **Open Questions**: 尚未決定的設計點,標 Owner / Deadline / 影響哪個 Task。

## 2. 系統架構與設計 (Technical Design)
- **System boundary**: 模組邊界在哪?`In scope` / `Out of scope` 各列一份。
- **Data flow**: 新增或異動的資料流向(Mermaid 或流程文字)。
- **Interface contracts**: 函式/型別的完整簽名(含 input/output 型別與錯誤情境)。
- **Failure modes**: 觸發條件 / 影響範圍 / 處理策略(fallback、拒載、graceful degradation)。

## 2b. 硬約束衝擊 (Hard-constraint impact) — 逐條過閘,不得留白

> 出處 `CLAUDE.md §4`。與本設計無關者寫「不觸及 + 一句理由」,不得只寫「N/A」。

| 約束 | 是否觸及 | 說明 / 緩解 |
|---|---|---|
| 時鐘域:禁 `Date.now()`,一律 `performance.now()`(ADR-4) | | |
| cross-origin isolation 生效(`crossOriginIsolated === true`) | | |
| **決定性**:同輸入序列跨 render FPS,sim 狀態逐位一致 | | |
| **三迴圈邊界**:input / sim / render 只透過 `SharedState` 溝通(ADR-2) | | |
| 固定佈局:輸入 ring + `DataRecorder` arena,不 `push` 物件 | | |
| seeded RNG:sim/recoil 禁 `Math.random()`,seed 入 metadata(GD-5) | | |
| **GD-6**:場景幾何永不進 sim runtime / 解析度與場景切換不改 sim | | |
| **GD-9**:場景資產僅 CC0 或 CC-BY,且 `ATTRIBUTIONS.md` 可稽核 | | |
| **GD-11**:FPSci(CC BY-NC-SA)程式碼/config 禁止進 repo | | |
| hitbox 單一來源(`TargetState.hitbox`),命中與離線推導共用(GD-7) | | |
| C-D1/C-D5:`research/` ↔ `src/` 單向隔離、晉升指標雙實作對表 | | |

## 3. 風險分析 (Risk Analysis)
- **Validity risk**: 會不會污染量測效度(時序、可見度、輸入鏈)?
- **Technical debt risk**: 為了快速上線所產生的妥協 + 觸發重構的條件。
- **Performance bottlenecks**: draw call / 三角形數 / GC 卡頓 / 掉 tick。

## 4. 任務拆解 (Task Breakdown)
*一 task = 一垂直切片 = 一原子 commit(協議 §3.1)。粒度 0.5–3 dev-days。*

| Task | Objective | Dependencies | Risk | Complexity | Definition of Done(可驗證證據) | Commit |
|------|-----------|--------------|------|------------|---------------------------------|--------|
| T0   | entry-gate:驗上游 exit-gate 綠燈 + OQ 收斂 | — | Low | Low | 上游 gate 證據連結齊全;OQ 全數關閉或降級為非阻塞 | `docs(wp-NN): T0 entry-gate` |
| T1   | 建立 XX 模組 | T0 | Low | Med | `npx vitest run` exit 0,含 XX 對抗性 fixture | `feat(wp-NN): T1 ...` |
| T2   | 串接 XX | T1 | Med | High | E2E 綠 + 逐位一致斷言通過 | `feat(wp-NN): T2 ...` |
| T-exit | exit-gate:里程碑宣告證據清單 | T1–Tn | — | Low | 每項證據有指令與輸出(非「已完成」) | `docs(wp-NN): T-exit ...` |
