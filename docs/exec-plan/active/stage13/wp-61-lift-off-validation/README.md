# WP-61 — 抬滑鼠判準可分性驗證與校準

> 2026-09-09 R2 結果收斂的範圍草案；尚未開工，參數及量化驗收門檻待 T0 凍結。上層：[Stage 13](../README.md)。

## 問題與證據

[WP-60 R2 紀錄](../wp-60-raw-mouse-sample-capture/progress.md)顯示 lift 與 pause 都有秒級取樣空洞，兩組 >1 s 空洞範圍分別為 1257.4–1850.4 與 1066.0–1363.3 ms；oneshot 最大 270.4 ms。時間間隙只能提出候選事件，不能直接標記為感測器離地。

本 WP 先回答「空洞前後運動學，能否在真人標註資料上區分 lift 與 pause/正常急停」，再決定是否移植及校準 PA Stage 2 Kinematic Spike Trimming／Stage 3 Hover Jitter Rejection。方法可借鑑，有效性尚未證明；整段 tinyPct、zeroDelta 與單輪最大空洞都不足以建立判準。

## 開工相依

- WP-60 T-exit 四項 handoff 齊備；R2 摘要已補，F6 等剩餘驗收仍由 WP-60 完成。
- 高刷（≥144 Hz）真人標註 cohort，沿用[錄製規格](../../../../operational/spider-wide-recording-spec.md)，補齊下列事件級資料。
- OQ-60.4 於本 WP T0 拍板：既有角速度停滯構念與新候選判準的名稱、型別及關係，不默認取代既有指標。

## 工作切片

| 切片 | 交付與判定 |
|---|---|
| T0 資料與評估契約 | 保存有序 dtUs/dx/dy、時間基準、Pointer Lock 起訖及獨立的抬起/落下、停住/恢復時間標註；標註不可由空洞反推。記錄 OS/瀏覽器、滑鼠/DPI/輪詢率、顯示更新率、drill、版本及取樣健康度。按受測者或 session 隔離校準/驗證集；調參前凍結事件匹配容差、precision/recall/F1 及各對照组誤報率的驗收數值。 |
| T1 可分性稽核 | 以中性 gap 原語建立 baseline，依 Pointer Lock 記錄排除已知中斷並保留理由。比較 gap-only、加入前後速度/加速度與 Stage 2、再加入 Stage 3 的消融結果。釐清特徵單位、實際 dt 與 DPI/增益依賴，PA px/s、px/s² 及 nominal 1 ms 常數不得直接搬用。 |
| T2 有條件實作與校準 | 保留驗證資料達到 T0 門檻後，才凍結參數、交付版本化純函式判準、合成邊界 fixture 與必要 parity。PA 參數/fixture 記名來源與版本；真人逐筆資料不進 repo。 |
| T-exit 結論與去向 | 報告各組混淆、漏報、誤報、不確定性與各步增益。未達門檻則交付不可可靠分離或證據不足的結論，保留 gap/segment 與研究結果，不晉升抬鼠指標。 |

cohort 需包含 lift、自然 pause、oneshot 與重複 session。保留原始時間順序，起始等待與 lock 中斷依事先標註規則處理，不從排序後最大值挑除；無法標註的事件可列 unknown。

## 範圍邊界與待辦

- WP-60 負責擷取、時間間隙原語與限制；本 WP 負責可分性與判準驗證。
- 不用本輪最大值調出剛好分開的門檻；Stage 2/3 不視為保證可行。
- 未過 reliability gate 不進教練報告（C-D3）；既有 `deriveRepositioningSuspicion()` 語意維持，OQ-60.4 另行定案（C-D4）。
- Python/TS 雙實作依 OQ-60.6 及晉升範圍決定。

- [ ] WP-60 T-exit 四項證據齊備。
- [ ] 收集帶獨立標註、硬體及版本資訊的 cohort。
- [ ] T0 凍結構念、資料切分與量化驗收門檻。
- [ ] 完成 gap-only 與 Stage 2/3 增量驗證，再決定是否進 T2。
