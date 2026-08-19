# WP-36 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ⬜ | **T0** entry gate(驗 WP-33 T-exit;讀碼確認 §0 對帳結論;拍板排程落點 + `zone`/`Meta.spawn.spiderShot` 欄位命名;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | WP-33 T-exit ✅ | Low |
| ⬜ | **T1** `DrillConfig.spiderShot` + schema 驗證 + `TargetManager` center-peripheral 排程分支 + `zone` 事件欄位 + `Meta.spawn.spiderShot` 回顯 | [T1-schedule-engine.md](T1-schedule-engine.md) | T0 | **Med–High** |
| ⬜ | **T2** `spider-shot-v1` drill config + `D_deg`/`W_deg`/象限/`targetConditionCell` 離線推導 | [T2-condition-cell.md](T2-condition-cell.md) | T1 | Med |
| ⬜ | **T3** 五類指標組裝(切換反應/移動執行/停止控制/首發/節奏) | [T3-five-metrics.md](T3-five-metrics.md) | T2 | Med |
| ⬜ | **T-exit** 驗收:每次 transition 保存方向/角距/角尺寸;`analysis-spider-shot.md` 定稿;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T3 | — |

**T1 是關鍵路徑與風險集中點**(唯一觸碰 `TargetManager` 熱路徑分支 + 唯一真正新幾何);一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-36 狀態列更新,並確認四個測試家族 WP(34/35/36/37)T-exit 進度供 WP-38 entry 判斷。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的四條紀律

1. **既有 L/R 交替與 seeded spawn 行為零回溯相容成本**:`config.spiderShot` 省略時 `TargetManager`/`schema.ts` 逐位等同現行行為;既有 `TargetManager.test.ts`/`schema.test.ts`/`DrillLoader.test.ts`/WP-21 seeded spawn 相關測試**零修改**全綠是機械判準。
2. **不得修改 `sequence.alternation` 型別或語意**:新排程原語一律走新的 top-level `spiderShot` 欄位(C-D4 精神延伸)。
3. **既有幾何/首發/追蹤判定禁第二定義**:`D_deg` 複用既有夾角公式、首發判定複用 `buildPeekWindows`、on-target 判定複用 `trackingDerivation.ts`;`W_deg` 是唯一新公式,輸入限定 GD-7 單一 hitbox 來源。
4. **象限分箱是呈現層標籤,不是相容鍵欄位**:門檻調整不觸發 `protocolVersion` 升版。
