# WP-61 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md) · Stage 索引：[`../README.md`](../README.md)

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／構念歸屬／評估契約 pre-registration | [T0-entry-gate.md](T0-entry-gate.md) | WP-60 T-exit ✅ | High |
| ✅ | **T1** 標註通道儀器 | [T1-annotation-channel.md](T1-annotation-channel.md) | T0 ✅ | High |
| 🟡 | **T2** Cohort 取得／標註完整性稽核／候選事件表 | [T2-cohort-and-label-audit.md](T2-cohort-and-label-audit.md) | T1 ✅ + 真人 cohort ⛔ | High |
| ⬜ | **T3** 可分性消融 | [T3-separability-ablation.md](T3-separability-ablation.md) | T2 ✅（資料充分性閘） | High |
| ⬜ | **T4**（**條件式**）判準凍結／TS 實作／C-D5 對表 | [T4-conditional-criterion.md](T4-conditional-criterion.md) | T3 判定 = `promote` | High |
| ⬜ | **T-exit** 驗收、結論與去向 | [T-exit-gate.md](T-exit-gate.md) | T3（或 T4） | Med |

## 序列閘（不得跳）

1. **T0 已通過（2026-09-09）** —— OQ-61.1（構念歸屬）、OQ-61.3（`KeyL`）與評估契約已凍結；T1 可開。
2. **T2 的資料充分性閘未過不得開 T3** —— 髒標籤跑出來的「分不開」不可歸因。<br>　⛔ **現況（2026-09-09）：判定 `blocked-by-data`** —— cohort 尚未錄製（真人 session 0／2、lift 標註 0／30、pause 標註 0／30）。T2 的儀器已全部落地並驗證，缺的只有 step 1 的錄製。
3. **T2 的 F3 檢定判定「標註通道不可用」時直接跳 T-exit** —— 不得續行 T3。
4. **T3 判定非 `promote` 時不執行 T4** —— 直接走 T-exit 的負面結論路徑。

## Package Definition of Done

- [x] 存在一個**獨立於取樣空洞**的事件級標註通道，opt-in 預設關閉，且開啟時 sim 狀態與關閉時逐位一致（T1 的四 FPS parity + 突變驗證）。
- [ ] 評估契約在**看資料之前**凍結，且 `git log -p` 可證明自 T0 起未被改動（T3 step 1）。
- [ ] cohort 的每份 run 有可用性與標註完整性的**實際數字**；作廢者具名，作廢規則來自 T0 而非事後。<br>　（稽核程式與 operator 入口已完成並以對照 fixture 驗證；等真人 run。）
- [ ] 四層消融 × 每個 θ 的混淆矩陣、指標與逐層增益齊全，且校準集與 held-out 兩組都已報告。
- [ ] 本 WP 交付**三種合法結案形態之一**（通過／不可靠分離／證據不足），附 T0 決策規則的字面對照與**宣稱範圍**。
- [ ] WP-60 的 `segmentByTimeGap()`／`deriveUnlockedIntervals()`／WP-57 的 `deriveRepositioningSuspicion()` 語意**一行未改**。
- [ ] C-D3（未過 gate 不進教練報告）、C-D4（構念不得有第二定義）、C-D1／C-D2（research 邊界）、C-D5（僅 promote 路徑觸發）逐條有掃描或測試證據。
- [ ] typecheck ×2／全量 Vitest／`vite build`／`uv run pytest`／全量 Playwright 五閘有實際數字；未執行者具名說明，不宣稱通過。

## Commit discipline

每個 task 單獨 commit；subject 見各 task file。完成 task 後同步本清單、[progress.md](progress.md) 與 [`../README.md`](../README.md) §2。

⚠️ **worktree**：本 repo 常有平行 session。stage 層索引檔可能帶著他人的未提交變更 —— **只 stage 自己的檔案，絕不整檔 `git add`**。
