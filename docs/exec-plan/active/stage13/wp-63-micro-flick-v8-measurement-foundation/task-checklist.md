# WP-63 — Task checklist

> 主規格：[README.md](README.md) · 進度：[progress.md](progress.md)
> 規則：一 task = 一垂直切片 = 一原子 commit；**先驗證再 commit**；當前 task 未 commit 不開下一個（[CLAUDE.md §3](../../../../../CLAUDE.md)）。

## Tasks

- [ ] **T0** — [Entry gate](T0-entry-gate.md)：編號重查、上游驗證、基線實測、OQ-63.1 收斂 · 0.5 d · Low
- [ ] **T1** — [零散布武器宣告](T1-zero-spread-weapon.md)：v8 `weaponId: 'usp_s_laser'` + 斷代 + 彈匣旗標契約 · 1.5 d · Med
- [ ] **T2** — [Mouse gain 修復](T2-mouse-gain-refresh.md)：KI-035 / BD-035 · 1 d · Med
- [ ] **T3** — [窗界 primitive](T3-target-window-primitive.md)：`buildTargetWindows()` + `aliveAt()` · 2.5 d · **High**
- [ ] **T4** — [L0 + L3](T4-outcome-and-selection.md)：結果層 + 選擇策略層（`nearest-2` / `nearest-3`）· 2 d · Med
- [ ] **T5** — [L1 幾何層](T5-intent-attributed-geometry.md)：意圖歸屬 + 角誤差 + 首發重定義 + 修正時間拆解 · 2.5 d · **High**
- [ ] **T6** — [L2 + 方向](T6-threshold-free-and-direction.md)：免閾值描述子 + 方向預測曲線 · 2.5 d · Med
- [ ] **T7** — [Harness + 紀律](T7-synthetic-harness-and-discipline.md)：七種故障型態 + FPS parity + 敏感度 + 採集紀律 · 2.5 d · Med
- [ ] **T-exit** — [Exit gate](T-exit-gate.md)：FR／NFR 對帳、diff 稽核、GD-39 入帳、索引更新 · 0.5 d

**合計**：12–16.5 dev-days

## 並行性

```
T0 ──┬── T1 ──┐
     ├── T2 ──┤
     └── T3 ──┼── T4 ──┐
              ├── T5 ──┼── T7 ── T-exit
              └── T6 ──┘
```

T1／T2／T3 互不相依可完全並行；T4／T5／T6 皆只相依 T3，亦可並行。

## 每個 task 完成時（協議 §3.4）

- [ ] 更新 [progress.md](progress.md)：Progress / Decision Log / Surprises / Open Questions
- [ ] 把本檔對應的 Done box 翻 ✅
- [ ] 與程式碼切片一起 stage 並以 task 檔內的 commit 訊息提交

## Gate 快查

| Gate | 條件 |
|---|---|
| T0 → 其餘 | 四項基線指令 exit 0 且數字入帳；OQ-63.1 有答案 |
| T3 → T4/T5/T6 | 窗數不變式綠 + NFR-63.4 符號掃描 count === 0 |
| T7 → T-exit | 四 FPS 逐位一致 + 七份故障 fixture 全綠 |
| T-exit | 每條 FR／NFR 有指令/斷言證據（非主觀語句） |
