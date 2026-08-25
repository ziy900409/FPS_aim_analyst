# WP-41 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-41.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-25 | 覆核四個 assessment config、`TargetManager` RNG 消費點與 `CompatibilityKey`；README §0 的結論仍成立，並完成 D-41.1/D-41.2。 |
| T1 build family order | ✅ | 2026-08-25 | Added `TestFamilyId` and deterministic Latin-square `buildFamilyOrder()`; focused unit suite passed (5 tests) and `npm run test:ci` passed (126 Vitest files / 955 tests + Playwright). |
| T2 condition schedule scope | ✅ | 2026-08-25 | 依 D-41.2 執行關閉分支：在 [`analysis-spider-shot.md`](../../../../operational/analysis-spider-shot.md) 記錄四協定的 FR-G7 現況、讀碼證據與不覆寫 seed 的理由；零程式碼、零測試改動。 |
| T-exit 驗收 + 文件定稿 | ✅ | 2026-08-25 | `npm run test:ci` 全綠(126 Vitest 檔 / 955 tests + 21 Playwright tests)；`git diff` 對四個 `src/drill/*.ts` 協定檔為空；FR-G6 驗收證據 [`src/session/sessionSchedule.test.ts:1-37`](../../../../../src/session/sessionSchedule.test.ts)；文件對帳清單完成(見下)。 |

## Decision Log

### D-41.1 — FR-G7：hold-click、hold-track、counterstrafe-reversal 關閉

- **決定**：不為三個協定新增家族內條件區塊排程或 seed 覆寫。
- **證據**：hold-click（seed `34034`）與 hold-track（seed `35035`）的 `spawnArea.yawDegRange`、`distanceURange` 都是固定的單點；L/R 既由 `TargetManager.markKilled()` 確定性交替。兩者的 seed 只影響 700–1700 ms spawn 延遲。counterstrafe-reversal 的 seed 為 `37002`，未定義 `spawnArea` 且延遲固定為 `[500, 500]`，沒有可觀測的隨機維度。三者的 near/mid/far 常數中僅 `mid` 接入 assessment config，並非待排序的條件格。
- **Alternatives Considered**：在既有協定內新增多距離／L-R 區塊後再排程。這會修改凍結的 `src/drill/*.ts` 協定與既有決定性回歸，超出 WP-41 範圍，應另開 WP。

### D-41.2 — FR-G7：Spider Shot seed 覆寫分支關閉

- **決定**：本 WP 不新增 `buildSpiderShotOverrideSeed()` 或 config clone／metadata 同步機制；T2 僅需把此範圍收斂記錄成文件。
- **證據**：Spider Shot 的固定 seed `36036` 僅驅動 center/peripheral 交替中 peripheral 的連續方位、半徑與距離取樣；其唯一非退化範圍為 azimuth `[0, 360]`。這不是 FR-G7 所述可分組、可平衡的 L/R、近中遠或象限條件區塊。`CompatibilityKey` 也未包含 seed，故覆寫雖不會破壞比較相容性，卻不能提供真正的條件 block counterbalancing。
- **Alternatives Considered**：在 orchestrator 層 clone `DrillConfig`，覆寫 `spiderShot.seed`，並將實際 seed 寫入 metadata。此方案需要額外 config／匯出整合，且只改變連續方位樣本、不保證象限或條件格平衡，因此不值得納入本 WP 的 1–2 天範圍。

### D-41.3 — FR-G6 採用 Latin-square 輪轉

- **決定**：T1 依 README §2① 實作以 participantId 的確定性雜湊起點加上 `sessionIndex mod 4` 的 cyclic rotate。
- **證據**：現有 `pilotSeed()` 採純算術產生決定性 seed；FR-G6 所需的是四家族的位置平衡，不是隨機抽樣。此設計使同一參與者的任意連續四個 session 各家族各出現在每個位置一次。
- **Alternatives Considered**：以 seeded shuffle 取代輪轉。小樣本 session 下無法保證位置平衡，且增加不必要的 RNG 複雜度。

## Surprises

_T0~T2 執行期無意外；README §0 的讀碼證據在當前 `src/` 仍成立。_

- **T-exit 發現**:[`docs/exec-plan/README.md` §2 階段 G 表](../../../README.md)的 WP-40 列在 WP-40 T-exit 完成後仍停留在「⬜ 待展開」,未同步翻 ✅(疑似 WP-40 T-exit 遺漏頂層 README 這一步)。本次已修正 WP-41 自己的列,但未動 WP-40 的列(非本 WP 範圍);留給 WP-42 T-exit 或下一次文件housekeeping 一併處理。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S7-1 | 既有 seed 是否已決定「家族內條件呈現順序」,使 FR-G7 與既有決定性測試衝突 | ✅ 已關閉（D-41.1/D-41.2；T2 文件記錄完成）：既有 seed 不代表可平衡的家族內條件區塊；不覆寫協定 seed。 |
| OQ-S7-9 | Spider Shot 覆寫 seed(若採納)是否需要 WP-42 UI 呈現 | ✅ 不適用（D-41.2）：覆寫分支未採納，WP-42 無需新增 UI 呈現點。 |
| OQ-S7-10 | Latin-square 輪轉是否需要更強的一階順序平衡設計 | 🟡 延後(非本 WP 阻塞項):T1 交付的位置平衡輪轉已滿足 FR-G6 字面要求;若研究端日後需要更嚴謹的一階順序平衡設計,屬加強項,留待研究者提出後另開任務,不阻塞 WP-41 T-exit 或 WP-42 T3 接線。 |
