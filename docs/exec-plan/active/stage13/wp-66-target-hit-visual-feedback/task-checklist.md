# WP-66 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 決策 GD-42（草稿，T-exit 入帳）

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Entry gate：編號重查／基線凍結／OQ-66.1～66.4 收斂 | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ⬜ | **T1** `TargetHitRing` + `SimLoop` 兩處寫入 + 決定性斷言 | [T1-target-hit-ring.md](T1-target-hit-ring.md) | T0 | **Med** |
| ⬜ | **T2** `TargetView` 逐 mesh material + 命中態衰減 | [T2-target-view-hit-flash.md](T2-target-view-hit-flash.md) | T1 | Med |
| ⬜ | **T3** `targets.hitFeedback?` + schema + metadata + 四處 wiring | [T3-config-gate-and-wiring.md](T3-config-gate-and-wiring.md) | T2 | Med |
| ⬜ | **T4** 在指名 tracking drill 啟用 + 效度斷代明帳 | [T4-enable-on-tracking-drills.md](T4-enable-on-tracking-drills.md) | T3 | **Med** |
| ⬜ | **T5** 零 importer 掃描／focused e2e／A/B frame-time／全量回歸 | [T5-regression-and-e2e.md](T5-regression-and-e2e.md) | T4 | Med |
| ⬜ | **T-exit** WP-66 驗收（A-66.1～A-66.12）+ GD-42 入帳 | [T-exit-gate.md](T-exit-gate.md) | T1–T5 | Low |

## 建議執行順序

```
T0 ──▶ T1 ──▶ T2 ──▶ T3 ──▶ T4 ──▶ T5 ──▶ T-exit
```

線性相依，**不建議並行**：T2 需要 T1 的 ring 才有東西可讀，T3 需要 T2 的 `setHitFeedback()` 才有東西可 gate，T4 是 T3 的一次值變更，T5 只有在組裝完成後才有東西可量。

## Package Definition of Done

- [ ] 受試者情境「在指名的 tracking drill 開火 → 命中當下目標亮起 → 停火或打偏後熄滅」在實機可完整走通，並在換 drill／換場景兩條路徑行為一致
- [ ] 未指名的 drill **逐位不變**：材質三屬性、`meta` 鍵集合、未涉 `meta` 鍵面的 golden fixture 三者皆與本 WP 前相同
- [ ] 命中回饋消費的是**既有**命中判定：`HitDetector`／`ballisticRaycast`／`targetAabb`／`sweptHitTest` 的 diff 為空，`SimLoop` 只多兩行寫入
- [ ] 脫靶／隔牆／未過速度閘／逾射程一律**不亮**，且各有反證測試
- [ ] 命中態跟 `TargetState.id` 走，不跟 mesh pool 槽位走（槽位洩漏專測綠）
- [ ] `TargetView` 對 `SharedState` 零寫入（`sync()` 前後 ring 全欄位 `Object.is` 不變）
- [ ] 環形格內容在 `src/data/`、`src/metrics/`、`research/` **零 importer**，且由常駐測試守著
- [ ] 同一輸入序列跨 ≥ 4 種 render FPS，環形格 `total`／`cursor`／逐槽 `id`/`seq` 逐位一致
- [ ] 啟用清單逐字等於 T0 收斂結果；`hold_track_v1` 與所有 formal assessment 協定未被啟用、`protocolVersion` 零變更
- [ ] 效度斷代在 `progress.md`、stage13 README、GD-42 三處留下同一句可稽核摘要
- [ ] A/B frame-time p95 增量 ≤ 0.2 ms、over-budget window 不增、draw call 相同
- [ ] `npm run typecheck` ×2、`npx vitest run`、`npx playwright test --workers=1`、`npm run build` 四項皆 exit 0

## Commit discipline

每個 task 單獨 commit；subject 見各 task file。完成 task 後同步本清單、[progress.md](progress.md) 與上層 [stage13 README](../README.md)。

> ⚠️ **平行 session 提醒**：[stage13 README](../README.md) 與 [`exec-plan/README.md`](../../../README.md) 是多個 session 共編的索引檔。翻狀態時若撞到同一行衝突，只 stage 自己那幾行，不要整檔覆蓋。
