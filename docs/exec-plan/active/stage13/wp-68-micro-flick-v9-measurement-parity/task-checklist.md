# WP-68 — Task checklist

> 主規格：[README.md](README.md) · 進度：[progress.md](progress.md)
> 規則：一 task = 一垂直切片 = 一原子 commit；**先驗證再 commit**；當前 task 未 commit 不開下一個（[CLAUDE.md §3](../../../../../CLAUDE.md)）。

## Tasks

- [x] ✅ **T0** — [Entry gate](T0-entry-gate.md)：編號重查、上游驗證、基線實測、`endCondition` schema 複核、OQ-68.2 收斂 · 0.5 d · Low —— 2026-09-14 完成，見 [progress §T0](progress.md)
- [x] ✅ **T1** — [零散布武器宣告](T1-zero-spread-weapon.md)：v9 `weaponId: 'usp_s_laser'` + roster 登記 + 斷代 · 1 d · Med —— 2026-09-14 完成，見 [progress §T1](progress.md)
- [x] ✅ **T2** — [計時制右界](T2-time-limited-valid-span.md)：`validSpanMs` 依 `endCondition` 分流 + v9 FPS parity · 1 d · **High** —— 2026-09-14 完成，見 [progress §T2](progress.md)
- [x] ✅ **T-exit** — [Exit gate](T-exit-gate.md)：FR／NFR 對帳、diff 稽核、GD-45 入帳、五處索引更新 · 0.5 d —— 2026-09-14 完成，見 [progress §T-exit](progress.md)。⚠️ 本 gate 查出並修復 T2 引入的靜默缺陷（`shotAccuracy` > 1），見 progress §TE.0

**合計**：3 dev-days

## 並行性

```
T0 ── T1 ── T2 ── T-exit
```

**全線串行**。T2 的 v8 逐位不變斷言必須建立在 T1 已落地的基準上 —— 兩個變因同時動，比對就無法歸因。

## 每個 task 完成時（協議 §3.4）

- [ ] 更新 [progress.md](progress.md)：Progress / Decision Log / Surprises / Open Questions
- [ ] 把本檔對應的 Done box 翻 ✅
- [ ] 與程式碼切片一起 stage 並以 task 檔內的 commit 訊息提交

## Gate 快查

| Gate | 條件 |
|---|---|
| T0 → T1 | 四項基線指令（含 GD-44 兩層 Playwright）exit 0 且數字入帳；`endCondition` 是否進匯出 schema 有答案；OQ-68.2 有答案或預設假設明帳 |
| T1 → T2 | spawn trace 逐位相同（且兩邊實際開火）+ rng 呼叫數 === 0 |
| T2 → T-exit | v8 四量逐位不變 + v9 四 FPS 逐位一致 + 右界差值入帳 |
| T-exit | 每條 FR／NFR 有指令／斷言證據（非主觀語句） |

## 本 WP 特有的兩個陷阱（開工前先讀）

1. **不要順手改 `DrillMetricRegistry`** —— [KI-037](../../../../known_issue/KI-037-valid-duration-includes-countdown.md) 看起來和 T2 是同一個問題，但它在另一條路徑（history／assessment 投影）、談的是**左界**（倒數），且有自己的 `BD` 號與修法。T-exit 會以 `git diff` 為空稽核這件事。
2. **v9 的靶比 v8 小 10%**（角半徑約 1.118° vs 1.242°）。直接照抄 WP-63 harness 的瞄準 offset 常數**可能讓 v9 全部失手**，於是四層指標全空、逐位比對變成比兩個空殼。T2 的非空對空前置就是擋這件事的。
