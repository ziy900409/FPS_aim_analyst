# T3 — t_detect / 偏心度離線推導 spec + 合成 fixture 驗證

> Part of [WP-21 detection-drill](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2 + **WP-16 exit**(v2 逐 tick aim/目標位置欄就緒——本 task 的推導輸入) |
| **Risk / Cplx** | Med / Med |
| **Touches** | ADD `docs/operational/analysis-t-detect.md`(spec)、`src/metrics/` dev 驗證器 + fixture 測試;MODIFY `docs/operational/schema.md`(交叉引用) |
| **狀態** | ✅ 2026-07-09 08:31Z PASS |

## Objective

把 GD-8 的 `t_detect` 定義變成**可執行的介面**(FR-C12):推導 spec(演算法 +
參數 + 邊界案例)落 `docs/operational/`,並以合成 fixture 證明「從真實匯出格式
推導 onset,誤差 ≤ 1 tick」——分析端(Python/R)照 spec 實作即與引擎對齊。

## In scope
- `analysis-t-detect.md` spec:
  - 輸入:v2 匯出(逐 tick `aim{yaw,pitch}` + 目標位置 + `t_visible` + spawn 事件)。
  - **偏心度**:`ε(t_spawn)` = aim@spawn 與目標中心的角距(公式 + 符號慣例)。
  - **t_detect**:`t_visible` 後首個「`dε/dt < −θ_v` 持續 k tick」的 tick;
    θ_v = 3 × 前刺激窗(spawn 前 500ms)`|dε/dt|` SD;k = 4 tick(OQ-S3-2 起點,
    標「暫定,pilot 校準」+ 敏感度分析建議)。
  - 邊界案例:未偵測(整段無 onset → 記 timeout,非缺失)、spawn 前窗不足
    (首 presentation)、`t_detect` < 人類 RT 下限(<100ms → 標 anticipation 旗標)。
  - 副指標:engagement time = `t_first_fire − t_visible`(免費,GD-8)。
- dev 驗證器(TS,`src/metrics/` 測試層級,非熱路徑):照 spec 實作推導,
  消費**真實匯出 JSON 格式**(round-trip:合成 aim 流 → recorder → export → 推導)。
- 合成 fixture:已知 onset 注入(平坦 aim + 已知 tick 起的定向轉動)×(快/慢 onset、
  高/低雜訊底)四組 → 推導誤差 ≤ 1 tick 斷言;未偵測/anticipation 邊界案例各一。
- `schema.md` 交叉引用(分析欄位 → spec 章節)。

## Out of scope
- 正式分析 pipeline(repo 外;spec 即介面)、θ_v/k 校準(pilot)、追蹤指標推導
  (GD-7 的 TOT/RMS ε 屬 WP-18/WP-22 消費面,spec 結構本檔預留章節但不填)。

## Steps

- [x] (2026-07-09 08:31Z) spec 初稿(演算法 + 參數 + 邊界案例 + 敏感度分析建議)。
- [x] (2026-07-09 08:31Z) dev 驗證器 + round-trip fixture 四組 + 邊界案例測試全綠。
- [x] (2026-07-09 08:31Z) 誤差斷言(合成已知 onset vs 推導值 ≤ 1 tick)證據記 progress。
- [x] (2026-07-09 08:31Z) schema.md 交叉引用;OQ-S3-2 參數落 spec(標暫定)。
- [x] (2026-07-09 08:31Z) `npx vitest run` 全綠。

## Definition of Done

- spec 完整(演算法可照抄實作);round-trip fixture 證明真實匯出格式可推導、
  誤差 ≤ 1 tick;邊界案例(timeout/anticipation/首窗不足)行為明確且有測試。

## Commit

`feat(wp-21): T3 t_detect/偏心度離線推導 spec + round-trip fixture 驗證(誤差 ≤ 1 tick)`
