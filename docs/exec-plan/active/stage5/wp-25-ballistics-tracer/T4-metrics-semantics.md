# T4 — 指標語意對帳 + lead 誤差離線 spec + 決定性回歸收編

> Part of [WP-25 ballistics-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3(hit 事件存在) |
| **Risk / Cplx** | Med / Med(語意漂移風險——文件與斷言雙防線) |
| **Touches** | MODIFY `src/metrics/compute.ts`(首發 outcome 消費 hit 事件,語意不變斷言)、`docs/operational/`(ADD `analysis-lead.md` spec;MODIFY 既有指標文件對帳)、[CONTEXT.md](../../../../../CONTEXT.md)(術語)、`tests/regression/`(收編)+ 結果頁 sanity |
| **狀態** | ⬜ |

## Objective

projectile 下既有指標語意釘死、新構念離線化(FR-E10):`t_fire`/`firstShot` 錨定
**不變**;`t_hit`/`timeOfFlightMs` 為新增觀測;lead(提前量)誤差為離線推導 spec
(引擎零新計算,GD-7 模式)。

## In scope

- **語意對帳(防線一:文件)**:
  - 首發命中率 = 首發 shot 的 outcome(由 `hit` 事件回填;hitscan 下 t_hit = t_fire,
    語意連續);
  - 時序指標(急停反應/停火對齊/切換時間)全部錨 `t_fire`,**不移錨**;
  - `timeOfFlightMs = t_hit − t_fire`(命中彈才有);
  - 上述入 CONTEXT.md §A 對帳(與本 task 同 commit)。
- **語意斷言(防線二:測試)**:hitscan/projectile 同輸入 fixture——
  `firstShot` 旗標序列與 `t_fire` 序列逐位相同(彈道模型不改 shot 層);
  首發 outcome 在 projectile 下由 hit 正確回填(命中/超時 miss 兩支)。
- **lead 誤差 spec(OQ-S5-5)**:`docs/operational/analysis-lead.md`——
  輸入 = 匯出 v2(逐 tick aim/目標/玩家位置 + fire/hit 事件 + `meta.weapon.bullet`);
  定義:開火瞬間「實際瞄準方向 vs 理想提前方向(依目標速度與飛行時間解析)」角差;
  合成 fixture 驗證(known 提前量 → 推導誤差界線);**引擎零新計算**。
- 決定性回歸收編:T3 projectile fixture 移入 `tests/regression/` 常備
  (跨 FPS + 重播);hitscan baseline 再確認零重錄。
- 結果頁 sanity(觀測):projectile fixture 下 `MetricsDashboard` 既有八指標
  無 NaN/語意爆走;`timeOfFlightMs` 分佈可從匯出離線算出(spec 範例)。

## Out of scope

- lead 晉升正式 pre-registered 指標(觸發 = pilot 構念有效)、結果頁新區塊
  (分析端離線先行)。

## Steps

- [ ] 語意對帳落 CONTEXT.md + 既有指標文件。
- [ ] 語意斷言測試(shot 層逐位不變 + outcome 回填兩支)。
- [ ] `analysis-lead.md` spec + 合成 fixture 驗證。
- [ ] 決定性回歸收編 + baseline 零重錄確認。
- [ ] 結果頁手動 sanity 記 progress。
- [ ] `npm run test:ci` exit 0。

## Definition of Done

- CONTEXT 語意對帳入帳;語意斷言綠;lead spec + fixture 綠(誤差界線明確);
  回歸收編綠;`test:ci` exit 0。

## Commit

`docs+test(wp-25): T4 指標語意對帳(t_fire 錨定不變/t_hit 新增)+ lead 離線 spec`
