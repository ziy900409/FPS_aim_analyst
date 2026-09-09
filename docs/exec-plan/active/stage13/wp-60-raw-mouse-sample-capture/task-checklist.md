# WP-60 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md) · Stage 索引：[../README.md](../README.md)
> **T-exit 後續**：三項具名缺口的收尾計畫見 [T-exit-followup.md](T-exit-followup.md)（TF1 F6／TF2 真人分布／TF3 Playwright）。

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| 🟡 | **T0** Entry gate／取樣充分性稽核／實機 PoC | [T0-entry-gate.md](T0-entry-gate.md) | 無（WP-57 已交付，只讀不改）| **High**；R1 已通過，R2 摘要已回填：空洞長度不足以可靠分離 lift/pause；F6 瀏覽器 frame log 待量測 |
| ✅ | **T1** 擷取契約：arena／型別／strict parser | [T1-capture-contract.md](T1-capture-contract.md) | 依使用者明確指示 override T0 gate；OQ-60.2／60.3／60.5 已於 T1 contract 凍結 | Med |
| ✅ | **T2** SimLoop 接線與決定性證明 | [T2-recorder-wiring.md](T2-recorder-wiring.md) | T1；依使用者明確指示續行（T0 經驗性 gate 仍 blocked，故 app 佈線層 opt-in **預設關閉**，見 D-60.T2-1）| **High** |
| 🟡 | **T3** 時間間隙切段原語與 Pointer Lock 消歧 | [T3-time-gap-primitive.md](T3-time-gap-primitive.md) | T1（OQ-60.1 已於 2026-09-08 收斂，不再阻塞）| Med；**DoD 的真人取樣分布一項未完成** —— 該 run 從未入 repo，本 session 取不到（見 progress §T3）|
| ✅ | **T4** 操作者可見度：取樣健康度報告 | [T4-operator-visibility.md](T4-operator-visibility.md) | T2 + T3 | Low；六欄 additive、四個 blocker 全閘在 `mouseSamples` 存在上（缺席仍合法），legacy 與含取樣的樣本各實跑一次（見 progress §T4）|
| ✅ | **T-exit** 驗收與 WP-61 handoff | [T-exit-gate.md](T-exit-gate.md) | T1～T4 | Med；A-60.1～16 **14 ✅ / 1 ✅ 帶上界告警 / 1 🟡**，無 ❌。三項具名缺口：F6 瀏覽器 frame log、T3 真人分布、全量 Playwright 讀數（port 5173 被占用）。本 gate 落地修復 **D-60.X1** |

**排程**：T0 是 **go/no-go 閘**（R1：若實機事件率 < 500 Hz，本 WP 前提崩塌，停止並回報 —— 那也是一個合格的 T0 結論）。T1 綠燈後 **T2 與 T3 可並行**（T3 只吃匯出型別，以合成 block 測試，不需要擷取路徑真的在跑）。

## Package Definition of Done

> 逐項證據見 [progress.md](progress.md) §T-exit gate（2026-09-09）。

- [x] 一份真實 run 的匯出含逐筆原始滑鼠取樣，樣本數 ≈ 實機事件率 × drill 長度，且序列化 ≤ 1.0 MB。（A-60.1／A-60.10）<br>⚠️ 60 s 門檻通過（571 KB）；「增幅 ≤ 30%」的框在滿 300 s 不成立（≈ 2.85 MB）⇒ **OQ-60.7**。
- [x] 錄製關閉時，匯出內容與本 WP 之前**逐位相同**；既有 golden／determinism／export 測試期望值零修改。（A-60.2／NFR-60.7）
- [ ] 開啟錄製不改變 sim 行為：四 FPS parity 逐位一致、零額外 `push`、frame-time 無退化。（A-60.3／A-60.5／A-60.16）<br>前兩項 ✅；**frame-time 的瀏覽器側讀數未取（F6）** ⇒ 本項不打勾。
- [x] 兩個資料流結構性對齊：每個 tick 的 `dYaw` 等於該 tick 窗內原始樣本的換算總和。（A-60.4）
- [x] 三種事件空洞（感測器離地／Pointer Lock 中斷／drill 未進行）在離線分析上**可分辨**。（A-60.9）<br>⚠️ 「可分辨」= 三者在**輸出上分得開**；**不等於**空洞長度可判定成因（D-60.R2-1 已判否）。
- [x] 缺席合法、宣稱不符擲指名欄位 typed error；缺 `mouseSamples` 的舊匯出不被判 blocked。（A-60.7／A-60.15）
- [x] 新模組不建立第二套「抬滑鼠」構念：C-D3 零 importer、C-D4 零既有判準符號命中、全 repo 無 `LOD` 縮寫。（A-60.12～14）
- [ ] WP-61 handoff 四項齊備（事件率分布／空洞分布／授權結論／構念歸屬結論）。<br>①②③ ✅；**④ OQ-60.4 構念歸屬待使用者拍板**（WP-61 T0 的第一件事，不阻塞本 WP 收尾）。

## Commit discipline

每個 task 單獨 commit；建議 subject 見各 task file。完成 task 後同步本清單與 [progress.md](progress.md)；WP 完成時同步 [`../README.md`](../README.md) §2 與 [`docs/exec-plan/README.md`](../../../README.md) §2 的 stage13 區塊。

⚠️ **worktree 紀律**：本 repo 目前有平行 session 在 stage12 作業，stage 層索引檔可能帶著他人的未提交變更。同一行衝突時用 `git show HEAD:<path>` → 套用自己的修改 → `git hash-object -w` → `git update-index --cacheinfo`，只 stage 自己那幾行。**絕不整檔 `git add`。**
